#!/usr/bin/env python3
"""
Pressing Room — Batch Match Ingestion Script

Ingests all CSV match files, then trains the xG model and builds all aggregates.
Run this once after Sprint 0 to populate the database before building API endpoints.

Usage:
    python scripts/ingest_all_matches.py /path/to/csv/directory
    python scripts/ingest_all_matches.py /path/to/csv/directory --dry-run
    python scripts/ingest_all_matches.py /path/to/csv/directory --skip-aggregates
    python scripts/ingest_all_matches.py /path/to/csv/directory --verbose

Sequence:
  1. Validate + ingest each CSV into events_raw / matches / teams
  2. Train xG model on all shots
  3. Back-fill xG values for all shots in events_raw
  4. Compute team_match_stats for all matches
  5. Rebuild team_season_stats (standings)
  6. Rebuild player_season_stats (top scorers)
  7. Run QA checks
  8. Print summary report

Exit codes:
  0 — all ingestion and aggregation succeeded
  1 — some files failed validation (partial success)
  2 — critical error (DB unreachable, no files found)
"""

import asyncio
import logging
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncpg
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

from app.config import settings


def setup_logging(verbose: bool = False) -> None:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )
    if not verbose:
        logging.getLogger("asyncpg").setLevel(logging.WARNING)


def print_header(csv_dir: Path, dry_run: bool) -> None:
    print()
    print("═" * 70)
    print("  PRESSING ROOM — Batch Ingestion")
    print("═" * 70)
    print(f"  Directory: {csv_dir}")
    print(f"  Database:  {str(settings.DATABASE_URL)[:50]}...")
    print(f"  Dry run:   {dry_run}")
    print("═" * 70)
    print()


async def phase_ingest(csv_dir: Path, conn: asyncpg.Connection, dry_run: bool) -> dict:
    """Phase 1: Ingest all CSV files."""
    from pipeline.ingest import ingest_match

    csv_files = sorted(csv_dir.glob("*.csv"))
    if not csv_files:
        raise RuntimeError(f"No CSV files found in {csv_dir}")

    print(f"  Found {len(csv_files)} CSV files")
    print()

    success, failed, skipped = [], [], []

    for i, filepath in enumerate(csv_files, 1):
        prefix = f"  [{i:3d}/{len(csv_files)}]"
        if dry_run:
            print(f"{prefix} DRY RUN: {filepath.name}")
            success.append(filepath.name)
            continue

        result = await ingest_match(filepath, conn)
        if result["success"]:
            inserted = result["rows_inserted"]
            sk = result["rows_skipped"]
            status = f"✓ {inserted:4d} rows" if inserted > 0 else f"→ skip ({sk} exist)"
            print(f"{prefix} {status}  {filepath.stem[:50]}")
            if result["rows_inserted"] > 0:
                success.append(filepath.name)
            else:
                skipped.append(filepath.name)
        else:
            print(f"{prefix} ✗ FAILED: {filepath.name}")
            for e in result["errors"]:
                print(f"             {e}")
            failed.append(filepath.name)

    return {"success": success, "failed": failed, "skipped": skipped}


async def phase_xg(conn: asyncpg.Connection) -> dict:
    """Phase 2: Train xG model and back-fill scores."""
    from pipeline.xg_model import train_xg_model, backfill_xg_in_db

    print()
    print("  Phase 2: xG Model Training")
    print("  " + "─" * 40)

    # Load all shots from DB
    rows = await conn.fetch("""
        SELECT id, x, y, team_position, event,
               qualifiers->>'Head' AS "Head",
               qualifiers->>'Penalty' AS "Penalty",
               qualifiers->>'Big Chance' AS "Big Chance",
               qualifiers->>'Regular play' AS "Regular play",
               qualifiers->>'Assisted' AS "Assisted",
               qualifiers->>'Box-centre' AS "Box-centre",
               qualifiers->>'Box-right' AS "Box-right",
               qualifiers->>'Box-left' AS "Box-left",
               qualifiers->>'Small box-centre' AS "Small box-centre"
        FROM events_raw
        WHERE macro_category = 'shot'
    """)

    if not rows:
        print("  ✗ No shots found in events_raw. Ingest matches first.")
        return {"success": False}

    print(f"  Training on {len(rows)} shots from events_raw...")
    shots_df = pd.DataFrame([dict(r) for r in rows])

    t0 = time.time()
    artifact = train_xg_model(shots_df)
    t1 = time.time()

    cal = artifact["calibration"]
    print(f"  ✓ Model trained in {t1-t0:.1f}s")
    print(f"    Shots: {artifact['n_shots']:,} | Goals: {artifact['n_goals']:,} ({artifact['goal_rate']*100:.1f}%)")
    print(f"    Penalty xG:        {cal['penalty_xg']:.3f} (floor: {artifact['penalty_floor']:.3f})")
    print(f"    Central header xG: {cal['central_header_xg']:.3f}")
    print(f"    Long-range xG:     {cal['longrange_xg']:.3f}")

    # Back-fill xG in DB
    print()
    print("  Back-filling xG values in events_raw...")
    from pipeline.xg_model import load_model
    import asyncpg as _asyncpg

    class _FakePool:
        def acquire(self):
            return _AcquireCtx(conn)

    class _AcquireCtx:
        def __init__(self, c): self._c = c
        async def __aenter__(self): return self._c
        async def __aexit__(self, *a): pass

    updated = await backfill_xg_in_db(_FakePool(), artifact)
    print(f"  ✓ {updated:,} shot rows updated with xG values")

    return {"success": True, "n_shots": artifact["n_shots"]}


async def phase_aggregates(
    conn: asyncpg.Connection, competition_id: str, season: str
) -> dict:
    """Phase 3: Compute all team-level aggregates."""
    from pipeline.aggregates import (
        compute_team_match_stats, upsert_team_match_stats,
        rebuild_team_season_stats, rebuild_player_season_stats,
    )
    from pipeline.normalize import prepare_dataframe

    print()
    print("  Phase 3: Aggregate Computation")
    print("  " + "─" * 40)

    # Get all match IDs
    match_ids = await conn.fetch(
        "SELECT match_id FROM matches WHERE competition_id = $1 AND season = $2 ORDER BY local_date",
        competition_id, season,
    )
    print(f"  Computing team_match_stats for {len(match_ids)} matches...")

    for i, row in enumerate(match_ids, 1):
        mid = row["match_id"]
        # Load events for this match
        events = await conn.fetch(
            "SELECT * FROM events_raw WHERE match_id = $1",
            mid,
        )
        if not events:
            continue
        df = pd.DataFrame([dict(e) for e in events])

        stats_list = compute_team_match_stats(df, mid)
        for stats in stats_list:
            await upsert_team_match_stats(conn, stats)

        if i % 20 == 0:
            print(f"    {i}/{len(match_ids)} matches processed...")

    print(f"  ✓ team_match_stats complete")

    print("  Rebuilding team_season_stats...")
    n_teams = await rebuild_team_season_stats(conn, competition_id, season)
    print(f"  ✓ {n_teams} teams in standings")

    print("  Rebuilding player_season_stats...")
    n_players = await rebuild_player_season_stats(conn, competition_id, season)
    print(f"  ✓ {n_players} players in scoring table")

    return {"teams": n_teams, "players": n_players}


async def phase_qa(conn: asyncpg.Connection, competition_id: str, season: str) -> bool:
    """Phase 4: Run QA checks."""
    from pipeline.qa import run_all_qa

    print()
    print("  Phase 4: Data Quality Checks")
    print("  " + "─" * 40)

    results = await run_all_qa(conn, competition_id, season)
    all_passed = True

    for r in results:
        icon = "✓" if r.passed else ("✗" if r.severity == "ERROR" else "⚠")
        print(f"  {icon} {r.name}: {r.detail}")
        if not r.passed and r.severity == "ERROR":
            all_passed = False

    return all_passed


async def run(csv_dir: Path, dry_run: bool, skip_aggregates: bool, verbose: bool) -> int:
    """Main batch ingestion flow. Returns exit code."""
    setup_logging(verbose)
    print_header(csv_dir, dry_run)

    t_start = time.time()

    # Connect
    try:
        conn = await asyncpg.connect(dsn=settings.DATABASE_URL)
    except Exception as exc:
        print(f"  ✗ Database connection failed: {exc}")
        return 2

    try:
        # Phase 1: Ingest
        print("  Phase 1: CSV Ingestion")
        print("  " + "─" * 40)
        ingest_results = await phase_ingest(csv_dir, conn, dry_run)

        print()
        print(f"  Ingestion summary:")
        print(f"    ✓ New:    {len(ingest_results['success'])}")
        print(f"    → Skip:  {len(ingest_results['skipped'])}")
        print(f"    ✗ Failed: {len(ingest_results['failed'])}")

        if not ingest_results["success"] and not ingest_results["skipped"]:
            print("  No matches ingested. Check CSV files and database connection.")
            return 2

        if dry_run:
            print()
            print("  Dry run complete. No data written.")
            return 0

        # Phase 2: xG model
        xg_result = await phase_xg(conn)

        # Phase 3: Aggregates
        if not skip_aggregates:
            agg_result = await phase_aggregates(
                conn, settings.COMPETITION_ID, settings.DEFAULT_SEASON
            )

        # Phase 4: QA
        qa_passed = await phase_qa(
            conn, settings.COMPETITION_ID, settings.DEFAULT_SEASON
        )

    finally:
        await conn.close()

    t_total = time.time() - t_start

    # Final summary
    print()
    print("═" * 70)
    print(f"  COMPLETE in {t_total:.0f}s")
    if ingest_results["failed"]:
        print(f"  ⚠ {len(ingest_results['failed'])} files failed — check logs above")
        print()
        return 1
    print("  All done. Ready for Sprint 1 API development.")
    print("═" * 70)
    print()
    return 0


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(
        description="Batch ingest all Pressing Room match CSVs"
    )
    parser.add_argument("csv_dir", help="Directory containing match CSV files")
    parser.add_argument("--dry-run", action="store_true",
                        help="Validate only, no DB writes")
    parser.add_argument("--skip-aggregates", action="store_true",
                        help="Skip aggregate computation (ingest only)")
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args()

    csv_dir = Path(args.csv_dir)
    if not csv_dir.exists():
        print(f"\n  ✗ Directory not found: {csv_dir}")
        sys.exit(2)

    exit_code = asyncio.run(
        run(csv_dir, args.dry_run, args.skip_aggregates, args.verbose)
    )
    sys.exit(exit_code)


if __name__ == "__main__":
    main()

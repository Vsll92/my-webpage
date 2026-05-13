#!/usr/bin/env python3
"""
Pressing Room — One-Match Ingestion Script

Ingests a single match CSV file into the database.
Run this to test the pipeline on one file before running the full batch.

Usage:
    python scripts/ingest_one_match.py path/to/match.csv
    python scripts/ingest_one_match.py path/to/match.csv --verbose

The script will:
  1. Load and validate the CSV
  2. Normalize coordinates (away team x-flip)
  3. Insert into events_raw, matches, teams
  4. Print counts and a summary

Exit codes:
  0 — success
  1 — validation failed
  2 — database error
  3 — file not found
"""
import asyncio
import logging
import sys
from pathlib import Path

# Allow running from the backend/ directory
sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncpg
from dotenv import load_dotenv

load_dotenv()  # Load .env file

from app.config import settings


def setup_logging(verbose: bool = False) -> None:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )
    # Quiet down asyncpg's verbose connection logs unless debugging
    if not verbose:
        logging.getLogger("asyncpg").setLevel(logging.WARNING)


def print_banner(filepath: Path) -> None:
    print()
    print("═" * 60)
    print("  PRESSING ROOM — One-Match Ingestion")
    print("═" * 60)
    print(f"  File: {filepath.name}")
    print(f"  DB:   {settings.DATABASE_URL[:40]}...")
    print("═" * 60)
    print()


def print_result(result: dict, meta: dict | None = None) -> None:
    print()
    if result["success"]:
        print("  ✅  INGESTION SUCCESSFUL")
    else:
        print("  ❌  INGESTION FAILED")

    print()
    print(f"  match_id:      {result.get('match_id', 'unknown')}")
    if meta:
        print(f"  match:         {meta.get('home_team_name')} vs {meta.get('away_team_name')}")
        print(f"  week:          {meta.get('week')}")
        print(f"  score:         {meta.get('home_goals')} – {meta.get('away_goals')}")
        print(f"  formation:     {meta.get('home_formation')} / {meta.get('away_formation')}")

    print(f"  rows inserted: {result.get('rows_inserted', 0)}")
    print(f"  rows skipped:  {result.get('rows_skipped', 0)} (already existed)")

    if result.get("errors"):
        print()
        print("  Errors:")
        for err in result["errors"]:
            print(f"    • {err}")

    print()
    print("═" * 60)
    print()


async def run_ingestion(filepath: Path, verbose: bool) -> int:
    """Main async ingestion flow. Returns exit code."""
    from pipeline.validate import validate_match_df
    from pipeline.normalize import prepare_dataframe, extract_match_metadata  # noqa
    from pipeline.ingest import ingest_match, extract_match_metadata

    import pandas as pd

    print_banner(filepath)

    # ── 1. Load ───────────────────────────────────────────────────────────────
    print("  Step 1: Loading CSV...")
    try:
        df_raw = pd.read_csv(filepath, low_memory=False)
        print(f"          Loaded {len(df_raw):,} rows, {len(df_raw.columns)} columns")
    except Exception as exc:
        print(f"\n  ❌ Cannot read file: {exc}")
        return 3

    # ── 2. Validate ───────────────────────────────────────────────────────────
    print("  Step 2: Validating...")
    validation = validate_match_df(df_raw, str(filepath))

    if validation.warnings:
        for w in validation.warnings:
            print(f"          ⚠ {w}")

    if not validation.is_valid:
        print()
        print("  ❌ VALIDATION FAILED:")
        for err in validation.errors:
            print(f"     • {err}")
        print()
        return 1

    print(f"          ✓ Validation passed (match_id: {df_raw['match_id'].iloc[0]})")

    # ── 3. Connect to DB ──────────────────────────────────────────────────────
    print("  Step 3: Connecting to database...")
    try:
        conn = await asyncpg.connect(dsn=settings.DATABASE_URL)
        print("          ✓ Connected")
    except Exception as exc:
        print(f"\n  ❌ Database connection failed: {exc}")
        print(f"     DATABASE_URL: {settings.DATABASE_URL[:50]}...")
        return 2

    # ── 4. Extract metadata preview ───────────────────────────────────────────
    print("  Step 4: Extracting match metadata...")
    try:
        from pipeline.normalize import prepare_dataframe
        df_prepared = prepare_dataframe(df_raw)
        meta = extract_match_metadata(df_prepared)
        print(f"          ✓ {meta['home_team_name']} {meta['home_goals']} – "
              f"{meta['away_goals']} {meta['away_team_name']}")
        print(f"            Week {meta['week']} | "
              f"Formation: {meta['home_formation']} / {meta['away_formation']}")
    except Exception as exc:
        print(f"  ⚠ Metadata extraction preview failed: {exc}")
        meta = None

    # ── 5. Ingest ─────────────────────────────────────────────────────────────
    print("  Step 5: Ingesting into database...")
    try:
        result = await ingest_match(filepath, conn)
    except Exception as exc:
        print(f"\n  ❌ Ingestion raised an exception: {exc}")
        if verbose:
            import traceback
            traceback.print_exc()
        await conn.close()
        return 2
    finally:
        await conn.close()

    # ── 6. Verify ─────────────────────────────────────────────────────────────
    if result["success"]:
        print(f"          ✓ {result['rows_inserted']:,} rows inserted")

    # ── 7. Print result ───────────────────────────────────────────────────────
    print_result(result, meta)

    return 0 if result["success"] else 1


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(
        description="Ingest one Pressing Room match CSV into the database",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("filepath", help="Path to the match CSV file")
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable debug logging",
    )
    args = parser.parse_args()

    setup_logging(verbose=args.verbose)

    filepath = Path(args.filepath)
    if not filepath.exists():
        print(f"\n  ❌ File not found: {filepath}")
        sys.exit(3)

    if not filepath.suffix.lower() == ".csv":
        print(f"\n  ❌ Expected a .csv file, got: {filepath.suffix}")
        sys.exit(3)

    exit_code = asyncio.run(run_ingestion(filepath, args.verbose))
    sys.exit(exit_code)


if __name__ == "__main__":
    main()

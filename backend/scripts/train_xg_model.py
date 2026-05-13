#!/usr/bin/env python3
"""
Pressing Room — xG Model Training Script

Trains the xG logistic regression model on all shots currently in events_raw.
Saves the model to models/xg_v1.pkl.

Run this:
  1. After initial batch ingestion of all CSVs
  2. After adding new seasons (retraining improves accuracy)

Usage:
    python scripts/train_xg_model.py
    python scripts/train_xg_model.py --dry-run  (calibration report only, no save)

The script prints a calibration report so you can verify model sanity
before back-filling xG values in the database.
"""

import asyncio
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncpg
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

from app.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


async def main(dry_run: bool = False) -> int:
    from pipeline.xg_model import train_xg_model, backfill_xg_in_db

    print()
    print("═" * 60)
    print("  PRESSING ROOM — xG Model Training")
    print("═" * 60)

    # Connect to database
    try:
        conn = await asyncpg.connect(dsn=settings.DATABASE_URL)
    except Exception as exc:
        print(f"\n  ✗ Database connection failed: {exc}")
        return 1

    try:
        # Load all shots from events_raw
        print("\n  Loading shots from events_raw...")
        rows = await conn.fetch("""
            SELECT id, x, y, team_position, event,
                   qualifiers->>'Head'         AS "Head",
                   qualifiers->>'Penalty'       AS "Penalty",
                   qualifiers->>'Big Chance'    AS "Big Chance",
                   qualifiers->>'Regular play'  AS "Regular play",
                   qualifiers->>'Assisted'      AS "Assisted",
                   qualifiers->>'Box-centre'    AS "Box-centre",
                   qualifiers->>'Box-right'     AS "Box-right",
                   qualifiers->>'Box-left'      AS "Box-left",
                   qualifiers->>'Small box-centre' AS "Small box-centre"
            FROM events_raw
            WHERE macro_category = 'shot'
        """)

        if not rows:
            print("  ✗ No shots found in events_raw.")
            print("    Run scripts/ingest_all_matches.py first.")
            return 1

        shots_df = pd.DataFrame([dict(r) for r in rows])
        print(f"  Found {len(shots_df):,} shots")
        print(f"  Goals: {(shots_df['event'] == 'Goal').sum():,} "
              f"({100*(shots_df['event']=='Goal').mean():.1f}%)")

        if dry_run:
            print("\n  Dry run — training model but not saving or back-filling...")

        # Train
        print("\n  Training logistic regression model...")
        artifact = train_xg_model(shots_df)

        # Print calibration report
        print("\n  ── Calibration Report ───────────────────────────────")
        cal = artifact["calibration"]
        print(f"  Penalty xG:         {cal['penalty_xg']:.3f}  (target: ~0.76)")
        print(f"  Central header xG:  {cal['central_header_xg']:.3f}  (target: >0.30)")
        print(f"  Long-range xG:      {cal['longrange_xg']:.3f}  (target: <0.08)")
        print(f"  Penalty floor used: {artifact['penalty_floor']:.3f}")

        # Calibration pass/fail
        pen_ok    = cal["penalty_xg"] >= 0.60
        header_ok = cal["central_header_xg"] >= 0.20
        long_ok   = cal["longrange_xg"] <= 0.15
        all_ok    = pen_ok and header_ok and long_ok

        print()
        print(f"  {'✓' if pen_ok else '⚠'} Penalty xG:  {'OK' if pen_ok else 'LOW — floor applied'}")
        print(f"  {'✓' if header_ok else '⚠'} Header xG:  {'OK' if header_ok else 'LOWER THAN EXPECTED'}")
        print(f"  {'✓' if long_ok else '⚠'} Long-range: {'OK' if long_ok else 'HIGHER THAN EXPECTED'}")

        if not all_ok:
            print("\n  ⚠  Model calibration warnings above.")
            print("     This is expected with a small dataset (~3,600 shots).")
            print("     The model improves significantly with 2+ seasons.")
            print("     Penalty floor is applied as a safeguard.")
            print("     Document this in the Methodology page.")

        if dry_run:
            print("\n  Dry run complete. No data written.")
            return 0

        # Back-fill xG values
        print("\n  Back-filling xG values in events_raw...")

        class _Pool:
            def acquire(self): return _Ctx(conn)

        class _Ctx:
            def __init__(self, c): self._c = c
            async def __aenter__(self): return self._c
            async def __aexit__(self, *a): pass

        updated = await backfill_xg_in_db(_Pool(), artifact)
        print(f"  ✓ {updated:,} shot rows updated")

        # Summary stats on the back-filled values
        stats = await conn.fetchrow("""
            SELECT
                COUNT(*) AS total_shots,
                ROUND(AVG(xg_value)::numeric, 4) AS avg_xg,
                ROUND(MIN(xg_value)::numeric, 4) AS min_xg,
                ROUND(MAX(xg_value)::numeric, 4) AS max_xg,
                ROUND(SUM(xg_value)::numeric, 2) AS total_xg
            FROM events_raw
            WHERE macro_category = 'shot' AND xg_value IS NOT NULL
        """)

        if stats:
            print(f"\n  xG Distribution:")
            print(f"    Total shots: {stats['total_shots']:,}")
            print(f"    Total xG:    {stats['total_xg']}")
            print(f"    Average xG:  {stats['avg_xg']}")
            print(f"    Min xG:      {stats['min_xg']}")
            print(f"    Max xG:      {stats['max_xg']}")

            # Sanity: compare total xG to total goals
            total_goals = await conn.fetchval(
                "SELECT COUNT(*) FROM events_raw WHERE event = 'Goal'"
            )
            if total_goals and stats["total_xg"]:
                ratio = float(stats["total_xg"]) / float(total_goals)
                print(f"\n    Total goals: {total_goals:,}")
                print(f"    xG/goals ratio: {ratio:.2f} (target: 0.80–1.20)")
                if 0.70 <= ratio <= 1.30:
                    print("    ✓ xG calibration looks reasonable")
                else:
                    print("    ⚠ xG/goals ratio is outside expected range")
                    print("      This may indicate coordinate normalization issues.")

    finally:
        await conn.close()

    print()
    print("═" * 60)
    print("  Model training complete.")
    print(f"  Saved to: models/xg_v1.pkl")
    print("═" * 60)
    print()
    return 0


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Train the Pressing Room xG model")
    parser.add_argument("--dry-run", action="store_true",
                        help="Train and show calibration report, but don't save or back-fill")
    args = parser.parse_args()

    code = asyncio.run(main(dry_run=args.dry_run))
    sys.exit(code)

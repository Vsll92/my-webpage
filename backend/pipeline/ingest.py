"""
Match event ingestion: CSV → events_raw table.

Sprint 0 scope:
  - Validate CSV
  - Normalize coordinates
  - Insert into events_raw
  - Upsert match metadata into matches table
  - Upsert team records into teams table

Sprint 1 additions (not here yet):
  - xG model scoring
  - team_match_stats aggregation
  - player_season_stats aggregation
"""

import asyncio
import json
import logging
from datetime import datetime, date, time
from pathlib import Path

import asyncpg
import pandas as pd

from pipeline.validate import validate_match_df
from pipeline.normalize import prepare_dataframe

logger = logging.getLogger(__name__)

# ── SQL statements ────────────────────────────────────────────────────────────

UPSERT_TEAM_SQL = """
    INSERT INTO teams (team_id, team_name, team_code, competition_id)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (team_id) DO UPDATE
        SET team_name = EXCLUDED.team_name,
            team_code  = EXCLUDED.team_code
"""

UPSERT_MATCH_SQL = """
    INSERT INTO matches (
        match_id, competition_id, season, week,
        local_date, local_time,
        home_team_id, home_team_name,
        away_team_id, away_team_name,
        home_goals, away_goals,
        home_formation, away_formation,
        venue_id, venue_name,
        status
    ) VALUES (
        $1, $2, $3, $4,
        $5, $6,
        $7, $8,
        $9, $10,
        $11, $12,
        $13, $14,
        $15, $16,
        'completed'
    )
    ON CONFLICT (match_id) DO UPDATE
        SET home_goals      = EXCLUDED.home_goals,
            away_goals      = EXCLUDED.away_goals,
            home_formation  = EXCLUDED.home_formation,
            away_formation  = EXCLUDED.away_formation
"""

INSERT_EVENT_SQL = """
    INSERT INTO events_raw (
        match_id, competition_id, season, week, local_date,
        general_id, event_id, event, type_id, macro_category,
        period_id, time_min, time_sec,
        team_id, team_name, team_position,
        player_id, player_name, position, formation,
        x, y, pass_end_x, pass_end_y,
        outcome, zone,
        qualifiers,
        xg_value, shot_outcome,
        is_progressive_pass, is_box_entry
    ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13,
        $14, $15, $16,
        $17, $18, $19, $20,
        $21, $22, $23, $24,
        $25, $26,
        $27,
        $28, $29,
        $30, $31
    )
    ON CONFLICT (match_id, general_id)
    WHERE general_id IS NOT NULL
    DO NOTHING
"""

CHECK_EXISTING_SQL = """
    SELECT COUNT(*) FROM events_raw WHERE match_id = $1
"""

# ── Helper functions ──────────────────────────────────────────────────────────

def _safe_int(val) -> int | None:
    """Convert a value to int, returning None on failure."""
    try:
        return int(val)
    except (TypeError, ValueError):
        return None


def _safe_float(val) -> float | None:
    """Convert a value to float, returning None on failure."""
    try:
        f = float(val)
        return None if pd.isna(f) else f
    except (TypeError, ValueError):
        return None


def _safe_str(val) -> str | None:
    """Convert a value to str, returning None for NaN/None."""
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    return str(val).strip() or None


def to_python_date(value):
    """Convert strings like '2024-11-03' to Python date objects."""
    if value is None or value == "":
        return None
    if isinstance(value, date):
        return value
    return datetime.fromisoformat(str(value)).date()


def to_python_time(value):
    """Convert strings like '20:45' or '20:45:00' to Python time objects."""
    if value is None or value == "":
        return None
    if isinstance(value, time):
        return value

    value_str = str(value).strip()

    if len(value_str) == 5:
        return datetime.strptime(value_str, "%H:%M").time()

    return datetime.strptime(value_str, "%H:%M:%S").time()


def extract_match_metadata(df: pd.DataFrame) -> dict:
    """
    Extract match-level metadata from event rows.

    Goals are counted from Goal events.
    Formation is extracted from the 'formation' column on the first event per team.
    """
    first = df.iloc[0]

    match_id = str(first["match_id"])
    competition_id = _safe_str(first.get("competition_id"))
    season = _safe_str(first.get("season")) or "25-26"
    week = _safe_int(first.get("week"))
    local_date = _safe_str(first.get("local_date"))
    local_time = _safe_str(first.get("local_time"))
    venue_id = _safe_str(first.get("venue_id"))
    venue_name = _safe_str(first.get("venue_name"))

    home_events = df[df["team_position"] == "home"]
    away_events = df[df["team_position"] == "away"]

    home_team_id = _safe_str(home_events["team_id"].iloc[0]) if len(home_events) else None
    home_team_name = _safe_str(home_events["team_name"].iloc[0]) if len(home_events) else None
    home_team_code = (
        _safe_str(home_events["team_code"].iloc[0])
        if "team_code" in df.columns and len(home_events)
        else None
    )

    away_team_id = _safe_str(away_events["team_id"].iloc[0]) if len(away_events) else None
    away_team_name = _safe_str(away_events["team_name"].iloc[0]) if len(away_events) else None
    away_team_code = (
        _safe_str(away_events["team_code"].iloc[0])
        if "team_code" in df.columns and len(away_events)
        else None
    )

    goal_events = df[df["event"] == "Goal"]
    home_goals = len(goal_events[goal_events["team_position"] == "home"])
    away_goals = len(goal_events[goal_events["team_position"] == "away"])

    def get_formation(team_df: pd.DataFrame) -> str | None:
        if "formation" not in team_df.columns:
            return None
        vals = team_df["formation"].dropna().unique()
        return str(int(vals[0])) if len(vals) > 0 else None

    home_formation = get_formation(home_events)
    away_formation = get_formation(away_events)

    return {
        "match_id": match_id,
        "competition_id": competition_id,
        "season": season,
        "week": week,
        "local_date": local_date,
        "local_time": local_time,
        "home_team_id": home_team_id,
        "home_team_name": home_team_name,
        "home_team_code": home_team_code,
        "away_team_id": away_team_id,
        "away_team_name": away_team_name,
        "away_team_code": away_team_code,
        "home_goals": home_goals,
        "away_goals": away_goals,
        "home_formation": home_formation,
        "away_formation": away_formation,
        "venue_id": venue_id,
        "venue_name": venue_name,
    }


def build_event_records(df: pd.DataFrame, meta: dict) -> list[tuple]:
    """
    Convert the prepared DataFrame into a list of tuples for asyncpg executemany().

    Column order must exactly match INSERT_EVENT_SQL parameter order.
    """
    records = []

    for _, row in df.iterrows():
        qualifiers_val = row.get("qualifiers")
        qualifiers_json = json.dumps(qualifiers_val) if qualifiers_val else None

        record = (
            # Match context
            meta["match_id"],                            # $1
            meta["competition_id"],                      # $2
            meta["season"],                              # $3
            meta["week"],                                # $4
            meta["local_date"],                          # $5  <- now real Python date
            # Event identity
            _safe_int(row.get("general_id")),            # $6
            _safe_int(row.get("event_id")),              # $7
            _safe_str(row.get("event")),                 # $8
            _safe_int(row.get("type_id")),               # $9
            _safe_str(row.get("macro_category")),        # $10
            # Time
            _safe_int(row.get("period_id")),             # $11
            _safe_int(row.get("time_min")),              # $12
            _safe_int(row.get("time_sec")),              # $13
            # Team & Player
            _safe_str(row.get("team_id")),               # $14
            _safe_str(row.get("team_name")),             # $15
            _safe_str(row.get("team_position")),         # $16
            _safe_str(row.get("player_id")),             # $17
            _safe_str(row.get("player_name")),           # $18
            _safe_str(row.get("position")),              # $19
            _safe_str(row.get("formation")),             # $20
            # Coordinates
            _safe_float(row.get("x")),                   # $21
            _safe_float(row.get("y")),                   # $22
            _safe_float(row.get("pass_end_x")),          # $23
            _safe_float(row.get("pass_end_y")),          # $24
            # Outcome
            _safe_int(row.get("outcome")),               # $25
            _safe_str(row.get("zone")),                  # $26
            # Qualifiers JSONB
            qualifiers_json,                             # $27
            # Derived fields
            _safe_float(row.get("xg_value")),            # $28
            _safe_str(row.get("shot_outcome")),          # $29
            bool(row.get("is_progressive_pass", False)), # $30
            bool(row.get("is_box_entry", False)),        # $31
        )
        records.append(record)

    return records


# ── Main ingestion function ───────────────────────────────────────────────────

async def ingest_match(filepath: Path, conn: asyncpg.Connection) -> dict:
    """
    Ingest a single match CSV file into the database.

    Args:
        filepath: Path to the CSV file
        conn: Active asyncpg connection

    Returns:
        dict with keys: success, match_id, rows_inserted, skipped, errors

    The function is idempotent: re-running with the same file is safe.
    Existing rows (matched by match_id + general_id) are skipped via ON CONFLICT DO NOTHING.
    """
    result = {
        "success": False,
        "match_id": None,
        "rows_inserted": 0,
        "rows_skipped": 0,
        "errors": [],
    }

    # ── Load CSV ──────────────────────────────────────────────────────────────
    try:
        df_raw = pd.read_csv(filepath, low_memory=False)
    except Exception as exc:
        result["errors"].append(f"Could not read CSV: {exc}")
        logger.error("[%s] Failed to read CSV: %s", filepath.name, exc)
        return result

    # ── Validate ──────────────────────────────────────────────────────────────
    validation = validate_match_df(df_raw, str(filepath))
    if not validation.is_valid:
        result["errors"] = validation.errors
        logger.error("[%s] Validation failed — skipping ingestion", filepath.name)
        return result

    # ── Check if already ingested ─────────────────────────────────────────────
    match_id = str(df_raw["match_id"].iloc[0])
    result["match_id"] = match_id

    existing_count = await conn.fetchval(CHECK_EXISTING_SQL, match_id)
    if existing_count and existing_count > 0:
        logger.info(
            "[%s] Already ingested (%d rows exist) — will upsert match metadata only",
            match_id,
            existing_count,
        )
        result["rows_skipped"] = existing_count

    # ── Prepare (normalize + transform) ──────────────────────────────────────
    try:
        df_prepared = prepare_dataframe(df_raw)
    except Exception as exc:
        result["errors"].append(f"Preparation failed: {exc}")
        logger.error("[%s] prepare_dataframe() raised: %s", match_id, exc, exc_info=True)
        return result

    # Replace pandas NaN/NaT with Python None for safer inserts
    df_prepared = df_prepared.where(df_prepared.notna(), None)

    # ── Extract metadata ──────────────────────────────────────────────────────
    meta = extract_match_metadata(df_prepared)

    # Convert match-level date/time once and reuse everywhere
    meta["local_date"] = to_python_date(meta["local_date"])
    meta["local_time"] = to_python_time(meta["local_time"])

    # ── Upsert teams + match + events ────────────────────────────────────────
    async with conn.transaction():
        if meta["home_team_id"]:
            await conn.execute(
                UPSERT_TEAM_SQL,
                meta["home_team_id"],
                meta["home_team_name"],
                meta.get("home_team_code"),
                meta["competition_id"],
            )

        if meta["away_team_id"]:
            await conn.execute(
                UPSERT_TEAM_SQL,
                meta["away_team_id"],
                meta["away_team_name"],
                meta.get("away_team_code"),
                meta["competition_id"],
            )

        await conn.execute(
            UPSERT_MATCH_SQL,
            meta["match_id"],
            meta["competition_id"],
            meta["season"],
            meta["week"],
            meta["local_date"],
            meta["local_time"],
            meta["home_team_id"],
            meta["home_team_name"],
            meta["away_team_id"],
            meta["away_team_name"],
            meta["home_goals"],
            meta["away_goals"],
            meta["home_formation"],
            meta["away_formation"],
            meta["venue_id"],
            meta["venue_name"],
        )

        if existing_count == 0:
            records = build_event_records(df_prepared, meta)
            await conn.executemany(INSERT_EVENT_SQL, records)
            result["rows_inserted"] = len(records)
        else:
            result["rows_inserted"] = 0

    result["success"] = True
    logger.info(
        "[%s] Ingestion complete: %d rows inserted, %d skipped",
        match_id,
        result["rows_inserted"],
        result["rows_skipped"],
    )
    return result


# Optional local test helper
async def _main():
    from app.database import create_pool, close_pool, get_pool

    csv_path = Path("data/raw/sample.csv")  # replace if needed

    await create_pool()
    pool = get_pool()

    async with pool.acquire() as conn:
        result = await ingest_match(csv_path, conn)
        print(result)

    await close_pool()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(_main())
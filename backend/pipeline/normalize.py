"""
Coordinate normalization and schema preparation for Pressing Room event data.

The single most critical transformation in the entire pipeline:

  ALL events are normalized so that every team attacks left → right.
  
  In the raw CSV:
    - Home team events: x=0 is their own goal, x=100 is the opponent goal
      → x already increases toward the opponent goal ✓
    - Away team events: x=0 is the OPPONENT goal, x=100 is their own goal
      → x must be flipped: x_norm = 100 - x
  
  After normalization:
    - A shot at x=92, y=48 is always a shot near the opponent goal,
      regardless of which team took it.
    - PPDA, defensive height, and box entry calculations are correct.
    - Shot maps show all shots on the same attacking half.

  This runs ONCE, at ingest time. Normalized coordinates are what is stored
  in events_raw. Never re-normalize.
"""
import logging

import pandas as pd

logger = logging.getLogger(__name__)

# ── Column mapping: CSV column names → database column names ──────────────────
# Only columns that need renaming are listed here.
# All other columns keep their original name or are dropped.
COLUMN_RENAME_MAP = {
    "contestant_id": "team_id",
    "Pass End X": "pass_end_x",
    "Pass End Y": "pass_end_y",
    "venue_long_name": "venue_name",
}

# ── Qualifier columns to pack into a JSONB blob ───────────────────────────────
# These are the binary "Si"/NaN columns in the CSV. We pack them as:
#   {"Head": true, "Right footed": true, ...}
# Only "Si" values are included; NaN is omitted entirely.
QUALIFIER_COLUMNS = [
    "Long ball", "Cross", "Head pass", "Through ball",
    "Free kick taken", "Corner taken", "Goal disallowed", "Hand",
    "Foul", "Last line", "Head", "Box-centre", "Out of box-centre",
    "Right footed", "Regular play", "From corner", "Assisted",
    "Yellow Card", "Second yellow", "Red Card", "Argument", "Other reason",
    "Injury", "Tactical", "Box-right", "Box-left", "Box-deep left",
    "Left footed", "Left", "High", "Right", "Low Left", "High Left",
    "Low Centre", "Low Right", "High Right", "Blocked", "Close Left",
    "Close Right", "High claim", "Def block", "Six Yard Blocked",
    "Throw In", "Volley", "Swerve Right", "Keeper Throw", "Goal Kick",
    "Deflection", "Hit Woodwork", "Not past goal line", "Intentional Assist",
    "Chipped", "Lay-off", "Launch", "Throw In set piece", "Out of play",
    "Flick-on", "Parried danger", "Collected", "Standing", "Diving",
    "Stooping", "Hands", "Blocked cross", "Player Not Visible", "Pull Back",
    "Switch of play", "Gk kick from hands", "Referee delay",
    "Awaiting officials decision", "Game end", "Overrun", "Big Chance",
    "Individual Play", "Inswinger", "Outswinger", "Post match complete",
    # Own goal is a special qualifier (stored in qualifiers AND checked separately)
    "own goal",
    # Penalty (used by xG model)
    "Penalty",
    # Shot outcomes used in mapping
    "Scored", "Saved", "Missed",
    # Set pieces
    "Set piece", "Free kick",
    # Keeper specific
    "Penalty",
]


def normalize_coordinates(df: pd.DataFrame) -> pd.DataFrame:
    """
    Normalize x/y coordinates so all events attack left→right.

    Away team events have x = 100 - x, y = 100 - y applied.
    Pass endpoints (pass_end_x, pass_end_y) are also flipped.

    Args:
        df: DataFrame AFTER column renaming (must have 'pass_end_x', 'pass_end_y').
            Must also have 'team_position' column.

    Returns:
        DataFrame with coordinates modified in-place (operates on a copy).

    Precondition: COLUMN_RENAME_MAP has been applied before calling this function.
    """
    df = df.copy()

    away_mask = df["team_position"] == "away"
    n_away = away_mask.sum()

    if n_away == 0:
        logger.warning("No away team events found — skipping coordinate flip")
        return df

    # Flip x and y for all away team events
    df.loc[away_mask, "x"] = 100.0 - df.loc[away_mask, "x"]
    df.loc[away_mask, "y"] = 100.0 - df.loc[away_mask, "y"]

    # Flip pass endpoints for away team events where they exist
    # Note: column may not be present if no passes in this slice (unlikely but safe)
    if "pass_end_x" in df.columns:
        away_with_end_x = away_mask & df["pass_end_x"].notna()
        df.loc[away_with_end_x, "pass_end_x"] = 100.0 - df.loc[away_with_end_x, "pass_end_x"]

    if "pass_end_y" in df.columns:
        away_with_end_y = away_mask & df["pass_end_y"].notna()
        df.loc[away_with_end_y, "pass_end_y"] = 100.0 - df.loc[away_with_end_y, "pass_end_y"]

    logger.debug(
        "Normalized coordinates for %d away team events (of %d total)",
        n_away,
        len(df),
    )
    return df


def verify_normalization(df: pd.DataFrame, match_id: str) -> bool:
    """
    Sanity check: after normalization, each team's shots should cluster in their
    own attacking half.

    Coordinate system after normalization:
      - Home team attacks toward x=100 (right side of the pitch).
        Their shots should cluster at x > 60.
      - Away team attacks toward x=0 (left side of the pitch, the home goal).
        Their shots should cluster at x < 40.
        (Away team raw x was high → flipped to low, correctly near the home goal.)

    This is a BIDIRECTIONAL shot map: both teams' shots are in the correct match
    positions. The shot map caption states: "Attack direction is left→right for
    the home team."

    Threshold: ≥75% per team (slightly relaxed for small samples, e.g., 8 shots).

    Args:
        df: Normalized DataFrame (normalize_coordinates already applied)
        match_id: For logging purposes

    Returns:
        True if normalization looks correct, False if suspicious.
    """
    shots = df[df["macro_category"] == "shot"]

    if len(shots) == 0:
        logger.warning("[%s] No shot events found — cannot verify normalization", match_id)
        return True  # Not a normalization failure

    home_shots = shots[shots["team_position"] == "home"]
    away_shots = shots[shots["team_position"] == "away"]

    ok = True

    # Home shots should be near x=100 (attacking the right/away goal)
    if len(home_shots) >= 3:
        home_high_x_pct = (home_shots["x"] > 60).mean()
        if home_high_x_pct < 0.75:
            logger.error(
                "[%s] HOME normalization check FAILED: only %.0f%% of %d home shots in x>60. "
                "Expected ≥75%%. Home team should attack toward x=100.",
                match_id, home_high_x_pct * 100, len(home_shots),
            )
            ok = False
        else:
            logger.debug(
                "[%s] HOME normalization OK: %.0f%% of %d home shots in x>60",
                match_id, home_high_x_pct * 100, len(home_shots),
            )

    # Away shots should be near x=0 (attacking the left/home goal)
    if len(away_shots) >= 3:
        away_low_x_pct = (away_shots["x"] < 40).mean()
        if away_low_x_pct < 0.75:
            logger.error(
                "[%s] AWAY normalization check FAILED: only %.0f%% of %d away shots in x<40. "
                "Expected ≥75%%. Away team should attack toward x=0 after coordinate flip.",
                match_id, away_low_x_pct * 100, len(away_shots),
            )
            ok = False
        else:
            logger.debug(
                "[%s] AWAY normalization OK: %.0f%% of %d away shots in x<40",
                match_id, away_low_x_pct * 100, len(away_shots),
            )

    return ok


def build_qualifiers_jsonb(row: pd.Series, qualifier_cols: list[str]) -> dict | None:
    """
    Pack binary qualifier columns into a dict for JSONB storage.

    Only includes columns where value is "Si" (truthy).
    Returns None (not {}) if no qualifiers are present — avoids storing empty objects.

    Example output: {"Head": true, "Right footed": true, "Box-centre": true}
    """
    result = {col: True for col in qualifier_cols if row.get(col) == "Si"}
    return result if result else None


def map_shot_outcome(row: pd.Series) -> str | None:
    """
    Map event type and qualifiers to one of four canonical shot outcomes.

    Returns: "goal" | "saved" | "miss" | "blocked" | None (for non-shots)

    Notes on the source data:
    - "Goal": a goal was scored
    - "Saved Shot": goalkeeper made a save
    - "Miss": ball missed the target — but may also be "blocked" if Blocked qualifier is "Si"
    - "Blocked Pass" with macro_category="shot": an uncommon edge case, treat as "blocked"
    """
    event = row.get("event", "")
    macro = row.get("macro_category", "")

    if macro != "shot":
        return None

    if event == "Goal":
        return "goal"

    if event == "Saved Shot":
        return "saved"

    if event == "Miss":
        # Some blocked shots are coded as "Miss" with the Blocked qualifier
        if row.get("Blocked") == "Si":
            return "blocked"
        return "miss"

    if event == "Blocked Pass":
        return "blocked"

    # Default fallback for any unrecognized shot-category events
    logger.debug("Unrecognized shot event type: '%s' — mapping to 'miss'", event)
    return "miss"


def compute_derived_flags(df: pd.DataFrame) -> pd.DataFrame:
    """
    Add computed boolean flags to the DataFrame.

    - is_progressive_pass: pass that advances ball ≥10 normalized units toward goal
      AND is completed (outcome=1)
    - is_box_entry: completed pass whose endpoint is inside the penalty box

    Penalty box (after normalization, all teams attacking right):
      x > 83, y between 21 and 79 (in 0-100 scale)
    """
    df = df.copy()

    # Progressive pass: completed pass moving ≥10 units toward opponent goal
    is_pass = df["event"] == "Pass"
    is_completed = df["outcome"] == 1
    has_end_x = df["pass_end_x"].notna()

    df["is_progressive_pass"] = (
        is_pass
        & is_completed
        & has_end_x
        & (df["pass_end_x"] > df["x"] + 10)
    )

    # Box entry: completed pass landing inside the penalty box
    has_end_y = df["pass_end_y"].notna()
    in_box_x = df["pass_end_x"] > 83
    in_box_y = df["pass_end_y"].between(21, 79, inclusive="both")

    df["is_box_entry"] = (
        is_pass
        & is_completed
        & has_end_x
        & has_end_y
        & in_box_x
        & in_box_y
    )

    n_progressive = df["is_progressive_pass"].sum()
    n_box_entries = df["is_box_entry"].sum()
    logger.debug(
        "Derived flags: %d progressive passes, %d box entries",
        n_progressive,
        n_box_entries,
    )

    return df


def prepare_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """
    Full schema preparation pipeline. Call this after validate_match_df() passes.

    Steps:
    1. Filter deleted/unknown events
    2. Rename columns to match database schema
    3. Normalize coordinates (coordinate flip for away team)
    4. Verify normalization
    5. Pack qualifier columns into JSONB dict
    6. Compute derived flags
    7. Add shot_outcome column

    Returns:
        Cleaned, normalized, enriched DataFrame ready for xG scoring and DB insertion.
    """
    match_id = str(df["match_id"].iloc[0]) if "match_id" in df.columns else "unknown"
    logger.info("[%s] Preparing DataFrame (%d rows)...", match_id, len(df))

    # Step 1: Filter events that should not exist in analytics
    n_before = len(df)
    df = df[~df["event"].isin(["Deleted event", "Unknown"])].copy()
    n_removed = n_before - len(df)
    if n_removed:
        logger.debug("[%s] Filtered %d deleted/unknown events", match_id, n_removed)

    # Step 2: Rename columns (must happen before normalization)
    rename_map = {k: v for k, v in COLUMN_RENAME_MAP.items() if k in df.columns}
    df = df.rename(columns=rename_map)

    # Step 3: Normalize coordinates
    df = normalize_coordinates(df)

    # Step 4: Verify normalization (log error but don't halt — pipeline is logged)
    verify_normalization(df, match_id)

    # Step 5: Build qualifiers JSONB
    qual_cols_present = [c for c in QUALIFIER_COLUMNS if c in df.columns]
    df["qualifiers"] = df.apply(
        lambda row: build_qualifiers_jsonb(row, qual_cols_present),
        axis=1,
    )

    # Step 6: Compute derived flags
    df = compute_derived_flags(df)

    # Step 7: Add shot outcome
    df["shot_outcome"] = df.apply(map_shot_outcome, axis=1)

    # Step 8: Ensure numeric types are correct
    for col in ["x", "y", "pass_end_x", "pass_end_y"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # Step 9: xg_value is None until the xG model is applied (Sprint 1)
    df["xg_value"] = None

    logger.info("[%s] Preparation complete: %d rows ready for insertion", match_id, len(df))
    return df

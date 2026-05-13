"""
CSV validation for Pressing Room match event files.

Validates a single match DataFrame before any transformation occurs.
Fails loudly: returns False and prints specific errors. Never silently passes bad data.

Expected filename format: {week}_{home_team}_{away_team}_{match_id}_with_categories.csv
"""
import logging
from pathlib import Path
from typing import NamedTuple

import pandas as pd

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────

# Columns that must be present — if any are missing, the file is rejected
REQUIRED_COLUMNS = [
    "general_id",
    "event_id",
    "event",
    "type_id",
    "period_id",
    "time_min",
    "time_sec",
    "contestant_id",    # raw name for team_id before renaming
    "team_name",
    "team_position",    # "home" | "away"
    "player_id",
    "player_name",
    "x",
    "y",
    "outcome",
    "match_id",
    "local_date",
    "local_time",
    "week",
    "competition_id",
    "macro_category",
]

# Coordinate bounds — Opta data uses a 0–100 scale but coordinates can legitimately
# exceed the boundary by ±2 (e.g., a ball that goes out of play at -1.8 or 101.8).
# We validate against a ±3 tolerance to catch truly corrupt data while accepting
# the real boundary events seen in the Ligue 1 data.
X_BOUNDS = (-3.0, 103.0)
Y_BOUNDS = (-3.0, 103.0)

# Sanity checks on row counts
MIN_EVENTS_PER_MATCH = 400    # Anything below this suggests a truncated file
MAX_EVENTS_PER_MATCH = 5000   # Anything above this suggests a corrupt/concatenated file

# Expected team_position values
VALID_TEAM_POSITIONS = {"home", "away"}

# Expected macro_category values from the Ligue 1 data
KNOWN_MACRO_CATEGORIES = {
    "possession",
    "defending",
    "shot",
    "dribble_duel",
    "feed_meta",
    "foul_card",
    "match_admin",
    "goalkeeper",
    "offside",
    "stoppage_restart",
}


# ── Result type ───────────────────────────────────────────────────────────────

class ValidationResult(NamedTuple):
    is_valid: bool
    errors: list[str]       # ERROR-level: file must be rejected
    warnings: list[str]     # WARNING-level: file can be ingested, but worth logging


# ── Main validation function ──────────────────────────────────────────────────

def validate_match_df(df: pd.DataFrame, source_path: str = "unknown") -> ValidationResult:
    """
    Validate a raw match event DataFrame loaded from CSV.

    Args:
        df: Raw DataFrame as loaded by pd.read_csv()
        source_path: Path string for error messages (used for logging only)

    Returns:
        ValidationResult with is_valid=True only if no ERROR-level issues found.

    Note: This function does NOT modify the DataFrame. Transformation happens in normalize.py.
    """
    errors: list[str] = []
    warnings: list[str] = []

    # ── 1. Required column presence ───────────────────────────────────────────
    missing_cols = [col for col in REQUIRED_COLUMNS if col not in df.columns]
    if missing_cols:
        errors.append(f"Missing required columns: {missing_cols}")
        # Cannot proceed with other checks if core columns are absent
        return ValidationResult(False, errors, warnings)

    # ── 2. Row count sanity ───────────────────────────────────────────────────
    n_rows = len(df)
    if n_rows < MIN_EVENTS_PER_MATCH:
        errors.append(
            f"Too few rows: {n_rows} (minimum {MIN_EVENTS_PER_MATCH}). "
            "File may be truncated."
        )
    elif n_rows > MAX_EVENTS_PER_MATCH:
        warnings.append(
            f"High row count: {n_rows} (maximum expected {MAX_EVENTS_PER_MATCH}). "
            "Check for duplicate or concatenated files."
        )

    # ── 3. match_id must be unique (single match per file) ────────────────────
    unique_match_ids = df["match_id"].dropna().unique()
    if len(unique_match_ids) == 0:
        errors.append("Column 'match_id' contains no valid values.")
    elif len(unique_match_ids) > 1:
        errors.append(
            f"Multiple match_ids in one file: {unique_match_ids.tolist()}. "
            "Each CSV must contain exactly one match."
        )

    # ── 4. Both teams present ─────────────────────────────────────────────────
    positions = set(df["team_position"].dropna().unique())
    if "home" not in positions:
        errors.append("No home team events found (team_position='home' missing).")
    if "away" not in positions:
        errors.append("No away team events found (team_position='away' missing).")

    invalid_positions = positions - VALID_TEAM_POSITIONS
    if invalid_positions:
        warnings.append(f"Unexpected team_position values: {invalid_positions}")

    # ── 5. Coordinate bounds ──────────────────────────────────────────────────
    x_vals = pd.to_numeric(df["x"], errors="coerce").dropna()
    if len(x_vals) > 0:
        if x_vals.min() < X_BOUNDS[0] - 1 or x_vals.max() > X_BOUNDS[1] + 1:
            errors.append(
                f"x coordinates out of range [{X_BOUNDS[0]}, {X_BOUNDS[1]}]: "
                f"found min={x_vals.min():.1f}, max={x_vals.max():.1f}"
            )
    else:
        warnings.append("No valid x coordinates found in file.")

    y_vals = pd.to_numeric(df["y"], errors="coerce").dropna()
    if len(y_vals) > 0:
        if y_vals.min() < Y_BOUNDS[0] - 1 or y_vals.max() > Y_BOUNDS[1] + 1:
            errors.append(
                f"y coordinates out of range [{Y_BOUNDS[0]}, {Y_BOUNDS[1]}]: "
                f"found min={y_vals.min():.1f}, max={y_vals.max():.1f}"
            )

    # ── 6. outcome values ─────────────────────────────────────────────────────
    outcome_vals = df["outcome"].dropna().unique()
    invalid_outcomes = set(outcome_vals) - {0, 1, 0.0, 1.0}
    if invalid_outcomes:
        warnings.append(f"Unexpected outcome values: {invalid_outcomes}")

    # ── 7. period_id values ───────────────────────────────────────────────────
    period_vals = set(df["period_id"].dropna().unique())
    if not period_vals.intersection({1, 2, 3, 4, 5}):
        errors.append(f"No valid period_id values found: {period_vals}")

    # ── 8. macro_category sanity ─────────────────────────────────────────────
    macro_vals = set(df["macro_category"].dropna().unique())
    unknown_macros = macro_vals - KNOWN_MACRO_CATEGORIES
    if unknown_macros:
        warnings.append(
            f"Unknown macro_category values: {unknown_macros}. "
            "May indicate a schema update in the source data."
        )

    # ── 9. local_date parseable ───────────────────────────────────────────────
    try:
        pd.to_datetime(df["local_date"].iloc[0])
    except Exception:
        errors.append(
            f"local_date '{df['local_date'].iloc[0]}' is not a parseable date."
        )

    # ── 10. week must be a positive integer ───────────────────────────────────
    try:
        week_val = int(df["week"].iloc[0])
        if week_val < 1 or week_val > 38:
            warnings.append(f"Unusual week number: {week_val} (expected 1–38 for Ligue 1)")
    except (ValueError, TypeError):
        errors.append(f"week column is not numeric: {df['week'].iloc[0]!r}")

    # ── Result ────────────────────────────────────────────────────────────────
    is_valid = len(errors) == 0

    if errors:
        logger.error("[VALIDATION FAILED] %s — %d error(s):", source_path, len(errors))
        for e in errors:
            logger.error("  ERROR: %s", e)
    if warnings:
        logger.warning("[VALIDATION WARNINGS] %s — %d warning(s):", source_path, len(warnings))
        for w in warnings:
            logger.warning("  WARN: %s", w)
    if is_valid and not warnings:
        logger.debug("[VALIDATION OK] %s — %d rows", source_path, n_rows)

    return ValidationResult(is_valid, errors, warnings)

"""
Pressing Room — xG (Expected Goals) Model

Logistic regression trained on all shot events from events_raw.
Features: distance, angle, body part, penalty, big chance, play context.

Design decisions:
  - Model runs OFFLINE (not at query time). Results are stored in events_raw.xg_value.
  - Penalty floor: if model understimates penalties (common on small datasets),
    we apply a hard minimum of 0.76 to penalty kicks.
  - Model file is stored as models/xg_v1.pkl. It is large — gitignored.
  - Model is labeled "V1" in the Methodology page; we acknowledge the small training set.
  - Re-run after more seasons are added to improve accuracy.

Coordinate contract:
  - x and y must be NORMALIZED (prepare_dataframe() already called).
  - Home goal is at (0, 50), away goal is at (100, 50) in 0-100 space.
  - Home shots should be at x > 60, away shots at x < 40.
  - xG is computed from the SHOOTING team's perspective (distance/angle to opponent goal).
    For home shots: distance to goal at x=100.
    For away shots: distance to goal at x=0.
"""

import logging
from math import sqrt, atan2, pi
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────

# Pitch dimensions in meters (used for distance calculation)
PITCH_LENGTH = 105.0
PITCH_WIDTH  = 68.0

# Where the opponent goal centre is in normalized 0-100 space
# For home team: they shoot toward x=100 (the right goal)
# For away team: they shoot toward x=0 (the left goal, in normalized space)
HOME_GOAL = (100.0, 50.0)  # home team shoots at this
AWAY_GOAL = (0.0, 50.0)    # away team shoots at this

# Model storage path
MODEL_DIR  = Path(__file__).parent.parent / "models"
MODEL_PATH = MODEL_DIR / "xg_v1.pkl"

# Penalty xG floor — enforced in post-processing if model underestimates
# Research consensus: penalty xG ≈ 0.76
PENALTY_XG_FLOOR = 0.76


# ── Feature extraction ────────────────────────────────────────────────────────

def extract_shot_features(row: pd.Series) -> list[float]:
    """
    Extract 8 features from a shot event row (coordinates must already be normalized).

    Features:
      1. distance_m    — distance to goal in metres
      2. angle_norm    — angle to goal, normalized to [0, 1]
      3. is_header     — 1 if headed shot
      4. is_penalty    — 1 if penalty kick
      5. is_big_chance — 1 if marked as big chance in Opta data
      6. is_open_play  — 1 if regular play (not set piece)
      7. is_assisted   — 1 if shot was from an assist
      8. is_in_box     — 1 if shot originated inside the penalty box

    Coordinate note:
      Home shots attack toward x=100. Away shots attack toward x=0.
      We compute distance/angle to the CORRECT goal for each team.
    """
    x = float(row.get("x", 50.0) or 50.0)
    y = float(row.get("y", 50.0) or 50.0)
    team_pos = str(row.get("team_position", "home"))

    # Convert to metres
    x_m = (x / 100.0) * PITCH_LENGTH
    y_m = (y / 100.0) * PITCH_WIDTH

    # Goal position in metres (opponent goal)
    if team_pos == "home":
        goal_x_m = PITCH_LENGTH   # x=100 → 105m
        goal_y_m = PITCH_WIDTH / 2.0  # y=50 → 34m
    else:
        goal_x_m = 0.0             # x=0 → 0m
        goal_y_m = PITCH_WIDTH / 2.0

    # Distance from shot position to goal centre
    distance_m = sqrt((x_m - goal_x_m) ** 2 + (y_m - goal_y_m) ** 2)

    # Angle: absolute angle from goal centre, normalized to [0, 1]
    # atan2(dy, dx) — angle of 0 means straight on, π/2 means side angle
    raw_angle = abs(atan2(abs(y_m - goal_y_m), abs(x_m - goal_x_m)))
    angle_norm = raw_angle / (pi / 2.0)

    # Binary qualifiers (Si = "Si", otherwise absent)
    def is_si(col: str) -> float:
        return 1.0 if row.get(col) == "Si" else 0.0

    is_header     = is_si("Head")
    is_penalty    = is_si("Penalty")
    is_big_chance = is_si("Big Chance")
    is_open_play  = is_si("Regular play")
    is_assisted   = is_si("Assisted")

    # In-box: shot from inside the penalty box area
    # Box x > 83 for home, x < 17 for away (in normalized 0-100 space)
    is_in_box = 0.0
    box_cols = ["Box-centre", "Box-right", "Box-left",
                "Box-deep right", "Box-deep left", "Small box-centre",
                "Small box-right", "Small box-left"]
    if any(row.get(c) == "Si" for c in box_cols):
        is_in_box = 1.0
    else:
        # Fallback: derive from coordinates
        if team_pos == "home" and x > 83:
            is_in_box = 1.0
        elif team_pos == "away" and x < 17:
            is_in_box = 1.0

    return [
        distance_m,    # 1
        angle_norm,    # 2
        is_header,     # 3
        is_penalty,    # 4
        is_big_chance, # 5
        is_open_play,  # 6
        is_assisted,   # 7
        is_in_box,     # 8
    ]


# ── Model training ────────────────────────────────────────────────────────────

def train_xg_model(shots_df: pd.DataFrame) -> dict:
    """
    Train the xG logistic regression model.

    Args:
        shots_df: DataFrame of shot events. Must have been through prepare_dataframe().
                  Requires: x, y, team_position, event, and qualifier columns.

    Returns:
        Artifact dict: {"model": Pipeline, "penalty_floor": float, "n_shots": int, "n_goals": int}
    """
    logger.info("Training xG model on %d shots...", len(shots_df))

    X: list[list[float]] = []
    y: list[int] = []
    skipped = 0

    for _, row in shots_df.iterrows():
        try:
            features = extract_shot_features(row)
            label = 1 if row.get("event") == "Goal" else 0
            X.append(features)
            y.append(label)
        except Exception as exc:
            skipped += 1
            logger.debug("Skipping shot row: %s", exc)

    if skipped:
        logger.warning("Skipped %d shot rows during feature extraction", skipped)

    X_arr = np.array(X, dtype=np.float64)
    y_arr = np.array(y, dtype=np.int32)

    n_goals = int(y_arr.sum())
    n_shots = len(y_arr)
    goal_rate = n_goals / n_shots if n_shots > 0 else 0.0

    logger.info("  Dataset: %d shots, %d goals (%.1f%% conversion)", n_shots, n_goals, goal_rate * 100)

    if n_shots < 200:
        logger.warning(
            "Small training set (%d shots). Model accuracy will be limited. "
            "Retrain after adding more seasons.",
            n_shots
        )

    # Regularized logistic regression in a StandardScaler pipeline
    # C=1.0 (default L2) avoids heavy overfitting on the small dataset
    # class_weight='balanced' compensates for the ~8% goal rate imbalance
    model = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", LogisticRegression(
            C=1.0,
            max_iter=1000,
            class_weight="balanced",
            solver="lbfgs",
            random_state=42,
        )),
    ])
    model.fit(X_arr, y_arr)

    # ── Calibration checks ────────────────────────────────────────────────────
    # Penalty: x=88, y=50, team_position=home, Penalty=Si
    penalty_row = pd.Series({
        "x": 88.0, "y": 50.0, "team_position": "home",
        "Head": None, "Penalty": "Si", "Big Chance": None,
        "Regular play": None, "Assisted": None,
        "Box-centre": "Si",
    })
    penalty_features = extract_shot_features(penalty_row)
    penalty_xg = float(model.predict_proba([penalty_features])[0][1])

    # Central 6-yard header: x=94, y=50, team_position=home, Head=Si
    header_row = pd.Series({
        "x": 94.0, "y": 50.0, "team_position": "home",
        "Head": "Si", "Penalty": None, "Big Chance": "Si",
        "Regular play": "Si", "Assisted": "Si",
        "Box-centre": "Si",
    })
    header_xg = float(model.predict_proba([extract_shot_features(header_row)])[0][1])

    # Long-range speculative: x=65, y=50, team_position=home
    longrange_row = pd.Series({
        "x": 65.0, "y": 50.0, "team_position": "home",
        "Head": None, "Penalty": None, "Big Chance": None,
        "Regular play": "Si", "Assisted": None,
        "Box-centre": None,
    })
    longrange_xg = float(model.predict_proba([extract_shot_features(longrange_row)])[0][1])

    logger.info("  Calibration checks:")
    logger.info("    Penalty xG:         %.3f (expected: ~0.76)", penalty_xg)
    logger.info("    Central header xG:  %.3f (expected: >0.30)", header_xg)
    logger.info("    Long-range xG:      %.3f (expected: <0.08)", longrange_xg)

    # Warn if penalty xG is clearly wrong
    if penalty_xg < 0.55:
        logger.warning(
            "Penalty xG (%.3f) is below 0.55 — model may be miscalibrated. "
            "Will apply penalty floor of %.2f.",
            penalty_xg, PENALTY_XG_FLOOR
        )

    # Effective penalty floor: use model value if it's reasonable, otherwise hard floor
    effective_penalty_floor = max(penalty_xg, PENALTY_XG_FLOOR)

    artifact = {
        "model": model,
        "penalty_floor": effective_penalty_floor,
        "n_shots": n_shots,
        "n_goals": n_goals,
        "goal_rate": goal_rate,
        "calibration": {
            "penalty_xg": penalty_xg,
            "central_header_xg": header_xg,
            "longrange_xg": longrange_xg,
        },
    }

    # ── Save model ────────────────────────────────────────────────────────────
    MODEL_DIR.mkdir(exist_ok=True)
    joblib.dump(artifact, MODEL_PATH)
    logger.info("  Model saved to %s", MODEL_PATH)

    return artifact


# ── Model scoring ─────────────────────────────────────────────────────────────

def load_model() -> dict:
    """Load the trained model artifact from disk."""
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"xG model not found at {MODEL_PATH}. "
            "Run scripts/train_xg_model.py first."
        )
    return joblib.load(MODEL_PATH)


def score_shot(row: pd.Series, artifact: dict) -> float:
    """
    Score a single shot row. Returns xG value in [0, 1].

    Post-processing:
      - Penalty floor applied if shot is a penalty kick.
      - Value clamped to [0.01, 0.99] to avoid log(0) in downstream calculations.
    """
    features = extract_shot_features(row)
    model = artifact["model"]
    xg = float(model.predict_proba([features])[0][1])

    # Apply penalty floor
    if row.get("Penalty") == "Si":
        xg = max(xg, artifact["penalty_floor"])

    # Clamp to valid probability range
    return round(max(0.01, min(0.99, xg)), 4)


def score_all_shots(shots_df: pd.DataFrame, artifact: dict | None = None) -> pd.Series:
    """
    Score all rows in a shots DataFrame. Returns a Series of xG values.

    Args:
        shots_df: DataFrame of shot-category events (macro_category == 'shot')
        artifact: Optional pre-loaded artifact. If None, loads from disk.

    Returns:
        pd.Series of float xG values, indexed like shots_df.
    """
    if artifact is None:
        artifact = load_model()

    xg_values = []
    for _, row in shots_df.iterrows():
        try:
            xg_values.append(score_shot(row, artifact))
        except Exception as exc:
            logger.warning("Failed to score shot (id=%s): %s", row.get("general_id"), exc)
            xg_values.append(None)

    return pd.Series(xg_values, index=shots_df.index)


# ── Backfill existing database ────────────────────────────────────────────────

async def backfill_xg_in_db(pool, artifact: dict | None = None) -> int:
    """
    Score all shots in events_raw that have xg_value = NULL.
    Updates in batches of 500 for efficiency.

    Returns:
        Number of rows updated.
    """
    import asyncpg

    if artifact is None:
        artifact = load_model()

    logger.info("Loading unscored shots from events_raw...")

    SELECT_SQL = """
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
          AND xg_value IS NULL
    """

    UPDATE_SQL = "UPDATE events_raw SET xg_value = $1 WHERE id = $2"

    async with pool.acquire() as conn:
        rows = await conn.fetch(SELECT_SQL)
        logger.info("Found %d unscored shots", len(rows))

        if not rows:
            return 0

        # Score all shots
        updates = []
        for row in rows:
            row_series = pd.Series(dict(row))
            try:
                xg = score_shot(row_series, artifact)
                updates.append((xg, row["id"]))
            except Exception as exc:
                logger.warning("Failed to score shot id=%d: %s", row["id"], exc)

        # Batch update
        await conn.executemany(UPDATE_SQL, updates)
        logger.info("Updated %d shot xG values in events_raw", len(updates))

    return len(updates)

"""
Unit tests for coordinate normalization — the most critical pipeline step.

These tests MUST pass before any shot map is rendered.
Run: pytest tests/test_normalize.py -v

The key invariant: after normalization, ≥80% of shot events should have x > 60.
"""
import sys
from pathlib import Path

import pandas as pd
import pytest

# Allow imports from backend/ root
sys.path.insert(0, str(Path(__file__).parent.parent))

from pipeline.normalize import (
    normalize_coordinates,
    verify_normalization,
    map_shot_outcome,
    compute_derived_flags,
    build_qualifiers_jsonb,
    prepare_dataframe,
)
from pipeline.validate import validate_match_df


# ── Fixtures ──────────────────────────────────────────────────────────────────

def make_minimal_df(n_events: int = 10) -> pd.DataFrame:
    """Create a minimal valid DataFrame for testing."""
    return pd.DataFrame({
        "general_id": range(1, n_events + 1),
        "event_id": range(1, n_events + 1),
        "event": ["Pass"] * n_events,
        "type_id": [1] * n_events,
        "period_id": [1] * n_events,
        "time_min": [5] * n_events,
        "time_sec": [0] * n_events,
        "team_id": ["home_team"] * (n_events // 2) + ["away_team"] * (n_events // 2),
        "team_name": ["Home FC"] * (n_events // 2) + ["Away FC"] * (n_events // 2),
        "team_position": ["home"] * (n_events // 2) + ["away"] * (n_events // 2),
        "player_id": ["p1"] * n_events,
        "player_name": ["Player One"] * n_events,
        "x": [30.0] * n_events,
        "y": [50.0] * n_events,
        "pass_end_x": [40.0] * n_events,
        "pass_end_y": [55.0] * n_events,
        "outcome": [1] * n_events,
        "zone": ["Center"] * n_events,
        "macro_category": ["possession"] * n_events,
        "formation": ["4231"] * n_events,
        "position": [None] * n_events,
        "qualifiers": [None] * n_events,
    })


def make_shot_df(home_shots: list[tuple], away_shots: list[tuple]) -> pd.DataFrame:
    """
    Create a DataFrame with shot events at given coordinates.

    home_shots: [(x, y), ...] — raw CSV coordinates for home team
    away_shots: [(x, y), ...] — raw CSV coordinates for away team

    In the raw CSV, home team x increases toward the away goal (correct already).
    Away team x=90 means they are 10 units from their own goal (= 10 units from the home goal).
    """
    records = []

    for i, (x, y) in enumerate(home_shots):
        records.append({
            "general_id": i + 1,
            "event_id": i + 1,
            "event": "Miss",
            "type_id": 13,
            "period_id": 1,
            "time_min": 30,
            "time_sec": 0,
            "team_id": "home_team",
            "team_name": "Home FC",
            "team_position": "home",
            "player_id": "p1",
            "player_name": "Home Player",
            "x": x,
            "y": y,
            "pass_end_x": None,
            "pass_end_y": None,
            "outcome": 0,
            "zone": "Center",
            "macro_category": "shot",
            "formation": "4231",
            "position": "CF",
        })

    for i, (x, y) in enumerate(away_shots):
        # Away team shots in raw CSV: x=90 means they are shooting from near the home goal
        # (from THEIR perspective x increases toward the home goal)
        records.append({
            "general_id": len(home_shots) + i + 1,
            "event_id": len(home_shots) + i + 1,
            "event": "Miss",
            "type_id": 13,
            "period_id": 1,
            "time_min": 45,
            "time_sec": 0,
            "team_id": "away_team",
            "team_name": "Away FC",
            "team_position": "away",
            "player_id": "p2",
            "player_name": "Away Player",
            "x": x,
            "y": y,
            "pass_end_x": None,
            "pass_end_y": None,
            "outcome": 0,
            "zone": "Center",
            "macro_category": "shot",
            "formation": "433",
            "position": "CF",
        })

    return pd.DataFrame(records)


# ── Tests: normalize_coordinates ─────────────────────────────────────────────

class TestNormalizeCoordinates:

    def test_home_team_coordinates_unchanged(self):
        """Home team events should have their original coordinates preserved."""
        df = make_minimal_df(4)
        df.loc[df["team_position"] == "home", "x"] = 30.0
        df.loc[df["team_position"] == "home", "y"] = 50.0

        result = normalize_coordinates(df)

        home_rows = result[result["team_position"] == "home"]
        assert (home_rows["x"] == 30.0).all(), "Home team x should be unchanged"
        assert (home_rows["y"] == 50.0).all(), "Home team y should be unchanged"

    def test_away_team_x_is_flipped(self):
        """Away team x should be 100 - original_x after normalization."""
        df = make_minimal_df(4)
        df.loc[df["team_position"] == "away", "x"] = 30.0  # raw away x

        result = normalize_coordinates(df)

        away_rows = result[result["team_position"] == "away"]
        assert (away_rows["x"] == 70.0).all(), "Away x should be 100 - 30 = 70"

    def test_away_team_y_is_flipped(self):
        """Away team y should be 100 - original_y after normalization."""
        df = make_minimal_df(4)
        df.loc[df["team_position"] == "away", "y"] = 20.0

        result = normalize_coordinates(df)

        away_rows = result[result["team_position"] == "away"]
        assert (away_rows["y"] == 80.0).all(), "Away y should be 100 - 20 = 80"

    def test_pass_end_x_flipped_for_away(self):
        """Pass endpoints for away team must also be flipped."""
        df = make_minimal_df(4)
        df.loc[df["team_position"] == "away", "pass_end_x"] = 25.0

        result = normalize_coordinates(df)

        away_rows = result[result["team_position"] == "away"]
        assert (away_rows["pass_end_x"] == 75.0).all(), "Away pass_end_x should be 100 - 25 = 75"

    def test_pass_end_nan_not_flipped(self):
        """NaN pass endpoints should remain NaN after normalization."""
        df = make_minimal_df(4)
        df.loc[df["team_position"] == "away", "pass_end_x"] = float("nan")

        result = normalize_coordinates(df)

        away_rows = result[result["team_position"] == "away"]
        assert away_rows["pass_end_x"].isna().all(), "NaN pass_end_x should stay NaN"

    def test_normalization_is_symmetric(self):
        """Applying normalization twice should return original coordinates."""
        df = make_minimal_df(4)
        df.loc[df["team_position"] == "away", "x"] = 35.0
        df.loc[df["team_position"] == "away", "y"] = 60.0

        once = normalize_coordinates(df)
        twice = normalize_coordinates(once)

        away_rows_original = df[df["team_position"] == "away"]
        away_rows_twice = twice[twice["team_position"] == "away"]

        assert (away_rows_original["x"].values == away_rows_twice["x"].values).all()
        assert (away_rows_original["y"].values == away_rows_twice["y"].values).all()

    def test_shot_attack_direction(self):
        """
        THE CRITICAL TEST: after normalization, each team's shots cluster in
        their own attacking half.

        Coordinate system (after normalization):
          - Home team attacks toward x=100 (their shots: x > 60)
          - Away team attacks toward x=0  (their shots: x < 40)

        This is BIDIRECTIONAL: the shot map shows both teams in their actual
        match positions. Home attacks right, away attacks left.

        Home shots at x=85: near the AWAY goal (x=100). Unchanged. ✓
        Away shots at raw x=85: from THEIR perspective near the HOME goal.
          After flip: 100 - 85 = 15 → x=15 in normalized space → near x=0 ✓
        """
        # Home shots near their attacking goal (x high = near opponent goal)
        home_shots = [(85.0, 45.0), (90.0, 50.0), (88.0, 35.0), (82.0, 55.0)]
        # Away shots: raw x high = near home goal from away perspective = THEIR attacking goal
        away_shots = [(88.0, 48.0), (92.0, 50.0), (85.0, 55.0), (86.0, 40.0)]

        df = make_shot_df(home_shots, away_shots)
        result = normalize_coordinates(df)

        home_result = result[result["team_position"] == "home"]
        away_result = result[result["team_position"] == "away"]

        # Home shots should be near x=100 (attacking right)
        home_high_x_pct = (home_result["x"] > 60).mean()
        assert home_high_x_pct >= 0.75, (
            f"Only {home_high_x_pct:.0%} of home shots are in x > 60 after normalization. "
            "Home team should attack toward x=100."
        )

        # Away shots should be near x=0 (attacking left = attacking the home goal)
        away_low_x_pct = (away_result["x"] < 40).mean()
        assert away_low_x_pct >= 0.75, (
            f"Only {away_low_x_pct:.0%} of away shots are in x < 40 after normalization. "
            "Away team should attack toward x=0 after coordinate flip."
        )


# ── Tests: verify_normalization ───────────────────────────────────────────────

class TestVerifyNormalization:

    def test_returns_true_when_each_team_in_correct_half(self):
        """
        Home shots at high x (near x=100), away shots at low x (near x=0).
        This is the correct post-normalization state.
        """
        df = make_shot_df(
            home_shots=[(85.0, 50.0)] * 5,   # home: high x ✓
            away_shots=[(85.0, 50.0)] * 5,   # away raw: high x → after flip: low x ✓
        )
        df_norm = normalize_coordinates(df)
        assert verify_normalization(df_norm, "test_match") is True

    def test_returns_false_when_home_shots_on_wrong_side(self):
        """If home shots are at low x, normalization is wrong."""
        df = make_shot_df(
            home_shots=[(85.0, 50.0)] * 5,
            away_shots=[(85.0, 50.0)] * 5,
        )
        df_norm = normalize_coordinates(df)
        # Manually corrupt home shots to wrong side (low x)
        home_mask = df_norm["team_position"] == "home"
        df_norm.loc[home_mask, "x"] = 15.0  # wrong: should be high x for home
        assert verify_normalization(df_norm, "test_match") is False

    def test_returns_false_when_away_shots_on_wrong_side(self):
        """If away shots end up at high x after normalization, coordinate flip failed."""
        df = make_shot_df(
            home_shots=[(85.0, 50.0)] * 5,
            away_shots=[(15.0, 50.0)] * 5,  # raw x=15 → after flip: 85 → WRONG (should be low)
        )
        df_norm = normalize_coordinates(df)
        # At raw x=15 for away → flip gives 85 → away shots at x=85 = wrong side
        assert verify_normalization(df_norm, "test_match") is False

    def test_returns_true_when_no_shots(self):
        """If there are no shot events, normalization check is not applicable."""
        df = make_minimal_df(10)
        assert verify_normalization(df, "test_match") is True

    def test_real_data_passes(self):
        """
        Integration test: the real Le Havre vs Brest CSV should pass normalization.
        Skipped if the CSV isn't available (CI environment).
        """
        import os
        csv_path = os.path.join(
            os.path.dirname(__file__),
            "../../data/France League 1 25-26/"
            "10_Le Havre_Brest_7znx52cirafzl9sfcd5fcpd04_with_categories.csv"
        )
        if not os.path.exists(csv_path):
            import pytest
            pytest.skip("Real match CSV not available — skipping integration test")

        import pandas as pd
        from pipeline.normalize import prepare_dataframe
        df = pd.read_csv(csv_path, low_memory=False)
        df_prep = prepare_dataframe(df)
        assert verify_normalization(df_prep, "real_data_test") is True


# ── Tests: map_shot_outcome ───────────────────────────────────────────────────

class TestMapShotOutcome:

    def make_shot_row(self, event: str, **qualifiers) -> pd.Series:
        row = pd.Series({
            "event": event,
            "macro_category": "shot",
            "Blocked": None,
        })
        row.update(qualifiers)
        return row

    def test_goal_maps_to_goal(self):
        row = self.make_shot_row("Goal")
        assert map_shot_outcome(row) == "goal"

    def test_saved_shot_maps_to_saved(self):
        row = self.make_shot_row("Saved Shot")
        assert map_shot_outcome(row) == "saved"

    def test_miss_without_blocked_is_miss(self):
        row = self.make_shot_row("Miss")
        assert map_shot_outcome(row) == "miss"

    def test_miss_with_blocked_si_is_blocked(self):
        row = self.make_shot_row("Miss", Blocked="Si")
        assert map_shot_outcome(row) == "blocked"

    def test_blocked_pass_is_blocked(self):
        row = self.make_shot_row("Blocked Pass")
        assert map_shot_outcome(row) == "blocked"

    def test_non_shot_returns_none(self):
        row = pd.Series({
            "event": "Pass",
            "macro_category": "possession",
        })
        assert map_shot_outcome(row) is None


# ── Tests: compute_derived_flags ─────────────────────────────────────────────

class TestDerivedFlags:

    def test_progressive_pass_flagged(self):
        df = pd.DataFrame([{
            "event": "Pass",
            "outcome": 1,
            "x": 40.0,
            "pass_end_x": 55.0,  # 55 > 40 + 10 ✓
            "pass_end_y": 50.0,
        }])
        result = compute_derived_flags(df)
        assert result["is_progressive_pass"].iloc[0] is True

    def test_non_progressive_pass_not_flagged(self):
        df = pd.DataFrame([{
            "event": "Pass",
            "outcome": 1,
            "x": 40.0,
            "pass_end_x": 48.0,  # 48 < 40 + 10 ✗
            "pass_end_y": 50.0,
        }])
        result = compute_derived_flags(df)
        assert result["is_progressive_pass"].iloc[0] is False

    def test_incomplete_pass_not_progressive(self):
        df = pd.DataFrame([{
            "event": "Pass",
            "outcome": 0,  # not completed
            "x": 40.0,
            "pass_end_x": 60.0,
            "pass_end_y": 50.0,
        }])
        result = compute_derived_flags(df)
        assert result["is_progressive_pass"].iloc[0] is False

    def test_box_entry_flagged(self):
        df = pd.DataFrame([{
            "event": "Pass",
            "outcome": 1,
            "x": 70.0,
            "pass_end_x": 88.0,  # > 83 ✓
            "pass_end_y": 50.0,  # between 21-79 ✓
        }])
        result = compute_derived_flags(df)
        assert result["is_box_entry"].iloc[0] is True

    def test_box_entry_outside_y_range_not_flagged(self):
        df = pd.DataFrame([{
            "event": "Pass",
            "outcome": 1,
            "x": 70.0,
            "pass_end_x": 88.0,
            "pass_end_y": 10.0,  # < 21, outside box ✗
        }])
        result = compute_derived_flags(df)
        assert result["is_box_entry"].iloc[0] is False


# ── Tests: qualifiers JSONB ───────────────────────────────────────────────────

class TestQualifiersJsonb:

    def test_si_values_included(self):
        row = pd.Series({"Head": "Si", "Right footed": "Si", "Penalty": None})
        result = build_qualifiers_jsonb(row, ["Head", "Right footed", "Penalty"])
        assert result == {"Head": True, "Right footed": True}

    def test_no_si_values_returns_none(self):
        row = pd.Series({"Head": None, "Right footed": None})
        result = build_qualifiers_jsonb(row, ["Head", "Right footed"])
        assert result is None

    def test_mixed_values(self):
        row = pd.Series({"Head": "Si", "Cross": None, "Big Chance": "Si"})
        result = build_qualifiers_jsonb(row, ["Head", "Cross", "Big Chance"])
        assert result == {"Head": True, "Big Chance": True}
        assert "Cross" not in result

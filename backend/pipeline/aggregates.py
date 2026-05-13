"""
Pressing Room — Aggregate Computation Pipeline

Computes all derived statistics from events_raw and stores them in:
  - team_match_stats    (one row per team per match)
  - team_season_stats   (one row per team per season — rebuilt weekly)
  - player_season_stats (one row per player per season)

PPDA coordinate contract (from real-data verification):
  After normalization, away team's events are flipped so x=0 = away's attacking direction.
  For PPDA:
    - Opponent passes in their OWN defensive territory = x > 40 (they're passing in their half)
    - Team pressing actions in opponent territory      = x > 40 (pressing in opponent half)

  Verified on Le Havre vs Brest: home PPDA = 7.33 (403 away passes / 55 home presses)
"""

import json
import logging
from typing import Any

import asyncpg
import pandas as pd

logger = logging.getLogger(__name__)

# ── Match-level aggregation ───────────────────────────────────────────────────

DEFENSIVE_EVENTS = {"Tackle", "Interception", "Ball recovery", "Foul", "Blocked Pass"}


def parse_qualifiers(q: Any) -> dict:
    """
    Normalize qualifiers into a Python dict.

    Handles:
    - dict
    - JSON string
    - None / NaN
    - invalid JSON
    """
    if q is None:
        return {}

    if isinstance(q, dict):
        return q

    if isinstance(q, str):
        q = q.strip()
        if not q:
            return {}
        try:
            parsed = json.loads(q)
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            return {}

    try:
        if pd.isna(q):
            return {}
    except Exception:
        pass

    return {}


def qualifier_is_true(q: dict, key: str) -> bool:
    """
    Interpret qualifier values robustly.

    Accepts:
    - True / False
    - 1 / 0
    - 'Si', 'Sí', 'Yes', 'True', '1', 'Y'
    """
    val = q.get(key)

    if val is None:
        return False

    if isinstance(val, bool):
        return val

    if isinstance(val, (int, float)):
        return val != 0

    if isinstance(val, str):
        return val.strip().lower() in {"si", "sí", "yes", "true", "1", "y"}

    return bool(val)


def compute_team_match_stats(df: pd.DataFrame, match_id: str) -> list[dict]:
    """
    Compute all match-level stats for both teams from a prepared event DataFrame.

    Args:
        df: Prepared DataFrame (from prepare_dataframe, WITH xg_value already scored)
        match_id: Match identifier for logging

    Returns:
        List of 2 dicts (home_stats, away_stats), each matching team_match_stats columns.
    """
    results = []

    for team_pos in ["home", "away"]:
        team_df = df[df["team_position"] == team_pos].copy()
        opponent_df = df[df["team_position"] != team_pos].copy()

        if len(team_df) == 0:
            logger.warning("[%s] No events for %s team", match_id, team_pos)
            continue

        team_id = str(team_df["team_id"].iloc[0])
        team_name = str(team_df["team_name"].iloc[0])
        opponent_id = str(opponent_df["team_id"].iloc[0]) if len(opponent_df) > 0 else None

        # Parse qualifiers once and reuse
        team_qualifiers = team_df["qualifiers"].apply(parse_qualifiers)
        opp_qualifiers = opponent_df["qualifiers"].apply(parse_qualifiers)

        team_own_goal_mask = team_qualifiers.apply(lambda q: qualifier_is_true(q, "own goal"))
        opp_own_goal_mask = opp_qualifiers.apply(lambda q: qualifier_is_true(q, "own goal"))
        team_free_kick_mask = team_qualifiers.apply(lambda q: qualifier_is_true(q, "Free kick taken"))

        # ── Goals ─────────────────────────────────────────────────────────────
        goals = len(
            team_df[
                (team_df["event"] == "Goal")
                & (~team_own_goal_mask)
            ]
        )

        own_goals_scored = len(
            team_df[
                (team_df["event"] == "Goal")
                & (team_own_goal_mask)
            ]
        )

        opponent_own_goals = len(
            opponent_df[
                (opponent_df["event"] == "Goal")
                & (opp_own_goal_mask)
            ]
        )

        goals_for = goals + opponent_own_goals

        opp_goals = len(
            opponent_df[
                (opponent_df["event"] == "Goal")
                & (~opp_own_goal_mask)
            ]
        )

        goals_against = opp_goals + own_goals_scored

        # ── Shots ─────────────────────────────────────────────────────────────
        shot_events = team_df[team_df["macro_category"] == "shot"]
        shots = len(shot_events)
        shots_on_target = len(
            shot_events[
                shot_events["event"].isin(["Goal", "Saved Shot"])
            ]
        )

        # ── xG ────────────────────────────────────────────────────────────────
        xg_val = float(shot_events["xg_value"].fillna(0).sum()) if shots > 0 else 0.0
        xg_for = round(xg_val, 2)

        opp_shots = opponent_df[opponent_df["macro_category"] == "shot"]
        xga = round(float(opp_shots["xg_value"].fillna(0).sum()), 2)

        xg_per_shot = round(xg_for / shots, 3) if shots > 0 else None

        # ── Passing ───────────────────────────────────────────────────────────
        pass_events = team_df[team_df["event"] == "Pass"]
        passes = len(pass_events)
        passes_completed = int((pass_events["outcome"] == 1).sum())
        pass_completion_pct = round(100.0 * passes_completed / passes, 1) if passes > 0 else None
        progressive_passes = int(team_df["is_progressive_pass"].fillna(False).sum())

        # ── PPDA ──────────────────────────────────────────────────────────────
        opp_passes_own_half = len(
            opponent_df[
                (opponent_df["event"] == "Pass")
                & (opponent_df["x"] > 40)
            ]
        )

        team_presses = len(
            team_df[
                (team_df["event"].isin(DEFENSIVE_EVENTS))
                & (team_df["x"] > 40)
            ]
        )

        ppda = round(opp_passes_own_half / team_presses, 2) if team_presses > 0 else None

        # ── Defensive height ──────────────────────────────────────────────────
        defending_df = team_df[team_df["macro_category"] == "defending"]
        defensive_height = round(float(defending_df["x"].mean()), 1) if len(defending_df) > 0 else None

        # ── Possession (pass-count proxy) ─────────────────────────────────────
        total_passes = len(df[df["event"] == "Pass"])
        possession_pct = round(100.0 * passes / total_passes, 1) if total_passes > 0 else 50.0

        # ── Other counts ─────────────────────────────────────────────────────
        box_entries = int(team_df["is_box_entry"].fillna(False).sum())
        corners = len(team_df[team_df["event"] == "Corner Awarded"])
        free_kicks = int(team_free_kick_mask.sum())

        aerials = team_df[team_df["event"] == "Aerial"]
        aerials_won = int((aerials["outcome"] == 1).sum())
        aerials_total = len(aerials)

        # ── Result ────────────────────────────────────────────────────────────
        if goals_for > goals_against:
            result = "W"
        elif goals_for < goals_against:
            result = "L"
        else:
            result = "D"

        results.append(
            {
                "match_id": match_id,
                "team_id": team_id,
                "team_name": team_name,
                "is_home": team_pos == "home",
                "opponent_id": opponent_id,
                "goals": goals_for,
                "goals_against": goals_against,
                "shots": shots,
                "shots_on_target": shots_on_target,
                "xg": xg_for,
                "xga": xga,
                "xg_per_shot": xg_per_shot,
                "passes": passes,
                "passes_completed": passes_completed,
                "pass_completion_pct": pass_completion_pct,
                "progressive_passes": progressive_passes,
                "ppda": ppda,
                "defensive_height": defensive_height,
                "possession_pct": possession_pct,
                "box_entries": box_entries,
                "corners": corners,
                "free_kicks": free_kicks,
                "aerials_won": aerials_won,
                "aerials_total": aerials_total,
                "result": result,
            }
        )

    return results


async def upsert_team_match_stats(conn: asyncpg.Connection, stats: dict) -> None:
    """Insert or update one team_match_stats row."""
    await conn.execute(
        """
        INSERT INTO team_match_stats (
            match_id, team_id, team_name, is_home, opponent_id,
            competition_id, season, week, local_date,
            goals, goals_against, shots, shots_on_target,
            xg, xga, xg_per_shot,
            passes, passes_completed, pass_completion_pct, progressive_passes,
            ppda, defensive_height, possession_pct,
            box_entries, corners, free_kicks,
            aerials_won, aerials_total, result
        )
        SELECT
            $1, $2, $3, $4, $5,
            m.competition_id, m.season, m.week, m.local_date,
            $6, $7, $8, $9,
            $10, $11, $12,
            $13, $14, $15, $16,
            $17, $18, $19,
            $20, $21, $22,
            $23, $24, $25
        FROM matches m WHERE m.match_id = $1
        ON CONFLICT (match_id, team_id) DO UPDATE SET
            goals = EXCLUDED.goals,
            goals_against = EXCLUDED.goals_against,
            shots = EXCLUDED.shots,
            shots_on_target = EXCLUDED.shots_on_target,
            xg = EXCLUDED.xg,
            xga = EXCLUDED.xga,
            xg_per_shot = EXCLUDED.xg_per_shot,
            passes = EXCLUDED.passes,
            passes_completed = EXCLUDED.passes_completed,
            pass_completion_pct = EXCLUDED.pass_completion_pct,
            progressive_passes = EXCLUDED.progressive_passes,
            ppda = EXCLUDED.ppda,
            defensive_height = EXCLUDED.defensive_height,
            possession_pct = EXCLUDED.possession_pct,
            box_entries = EXCLUDED.box_entries,
            corners = EXCLUDED.corners,
            free_kicks = EXCLUDED.free_kicks,
            aerials_won = EXCLUDED.aerials_won,
            aerials_total = EXCLUDED.aerials_total,
            result = EXCLUDED.result,
            computed_at = NOW()
        """,
        stats["match_id"],
        stats["team_id"],
        stats["team_name"],
        stats["is_home"],
        stats["opponent_id"],
        stats["goals"],
        stats["goals_against"],
        stats["shots"],
        stats["shots_on_target"],
        stats["xg"],
        stats["xga"],
        stats["xg_per_shot"],
        stats["passes"],
        stats["passes_completed"],
        stats["pass_completion_pct"],
        stats["progressive_passes"],
        stats["ppda"],
        stats["defensive_height"],
        stats["possession_pct"],
        stats["box_entries"],
        stats["corners"],
        stats["free_kicks"],
        stats["aerials_won"],
        stats["aerials_total"],
        stats["result"],
    )


# ── Season-level aggregation ──────────────────────────────────────────────────

async def rebuild_team_season_stats(
    conn: asyncpg.Connection,
    competition_id: str,
    season: str,
) -> int:
    """
    Full rebuild of team_season_stats from team_match_stats.
    Runs after each matchday. Returns number of teams updated.

    This uses SQL aggregation directly in the DB — far faster than Python loops.
    """
    logger.info("Rebuilding team_season_stats for %s %s...", competition_id, season)

    rows = await conn.fetch(
        """
        SELECT
            tms.team_id,
            MAX(tms.team_name) AS team_name,
            $1 AS competition_id,
            $2 AS season,
            COUNT(*) AS matches_played,
            SUM(CASE WHEN tms.result = 'W' THEN 1 ELSE 0 END) AS wins,
            SUM(CASE WHEN tms.result = 'D' THEN 1 ELSE 0 END) AS draws,
            SUM(CASE WHEN tms.result = 'L' THEN 1 ELSE 0 END) AS losses,
            SUM(CASE WHEN tms.result = 'W' THEN 3 WHEN tms.result = 'D' THEN 1 ELSE 0 END) AS points,
            SUM(tms.goals) AS goals_for,
            SUM(tms.goals_against) AS goals_against,
            SUM(tms.goals) - SUM(tms.goals_against) AS goal_diff,
            ROUND(SUM(tms.xg)::numeric, 2) AS xg_for,
            ROUND(SUM(tms.xga)::numeric, 2) AS xg_against,
            ROUND((SUM(tms.xg) - SUM(tms.xga))::numeric, 2) AS xg_diff,
            ROUND((SUM(tms.goals) - SUM(tms.xg))::numeric, 2) AS xg_delta,
            SUM(tms.shots) AS shots_for,
            SUM(tms.shots) AS shots_against,
            CASE WHEN SUM(tms.shots) > 0
                 THEN ROUND((SUM(tms.shots) / NULLIF(COUNT(*), 0))::numeric, 2)
                 ELSE NULL END AS shots_for_per90,
            ROUND(AVG(tms.ppda)::numeric, 2) AS ppda_season,
            ROUND(AVG(tms.defensive_height)::numeric, 1) AS def_action_height,
            ROUND(AVG(tms.possession_pct)::numeric, 1) AS possession_avg,
            SUM(tms.progressive_passes) AS progressive_passes
        FROM team_match_stats tms
        JOIN matches m ON m.match_id = tms.match_id
        WHERE m.competition_id = $1
          AND m.season = $2
        GROUP BY tms.team_id
        ORDER BY points DESC, goal_diff DESC, goals_for DESC
        """,
        competition_id,
        season,
    )

    if not rows:
        logger.warning("No team_match_stats found for %s %s", competition_id, season)
        return 0

    upsert_sql = """
        INSERT INTO team_season_stats (
            team_id, team_name, competition_id, season,
            matches_played, wins, draws, losses, points,
            goals_for, goals_against, goal_diff,
            xg_for, xg_against, xg_diff, xg_delta,
            shots_for, shots_for_per90,
            ppda_season, def_action_height, possession_avg,
            progressive_passes, league_position,
            last_refreshed
        ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $7, $8, $9,
            $10, $11, $12,
            $13, $14, $15, $16,
            $17, $18,
            $19, $20, $21,
            $22, $23,
            NOW()
        )
        ON CONFLICT (team_id, competition_id, season) DO UPDATE SET
            matches_played    = EXCLUDED.matches_played,
            wins              = EXCLUDED.wins,
            draws             = EXCLUDED.draws,
            losses            = EXCLUDED.losses,
            points            = EXCLUDED.points,
            goals_for         = EXCLUDED.goals_for,
            goals_against     = EXCLUDED.goals_against,
            goal_diff         = EXCLUDED.goal_diff,
            xg_for            = EXCLUDED.xg_for,
            xg_against        = EXCLUDED.xg_against,
            xg_diff           = EXCLUDED.xg_diff,
            xg_delta          = EXCLUDED.xg_delta,
            shots_for         = EXCLUDED.shots_for,
            shots_for_per90   = EXCLUDED.shots_for_per90,
            ppda_season       = EXCLUDED.ppda_season,
            def_action_height = EXCLUDED.def_action_height,
            possession_avg    = EXCLUDED.possession_avg,
            progressive_passes = EXCLUDED.progressive_passes,
            league_position   = EXCLUDED.league_position,
            last_refreshed    = NOW()
    """

    async with conn.transaction():
        for position, row in enumerate(rows, start=1):
            await conn.execute(
                upsert_sql,
                row["team_id"],
                row["team_name"],
                competition_id,
                season,
                row["matches_played"],
                row["wins"],
                row["draws"],
                row["losses"],
                row["points"],
                row["goals_for"],
                row["goals_against"],
                row["goal_diff"],
                row["xg_for"],
                row["xg_against"],
                row["xg_diff"],
                row["xg_delta"],
                row["shots_for"],
                row["shots_for_per90"],
                row["ppda_season"],
                row["def_action_height"],
                row["possession_avg"],
                row["progressive_passes"],
                position,
            )

    logger.info(
        "team_season_stats rebuilt: %d teams for %s %s",
        len(rows),
        competition_id,
        season,
    )
    return len(rows)


# ── Player aggregation ────────────────────────────────────────────────────────

async def rebuild_player_season_stats(
    conn: asyncpg.Connection,
    competition_id: str,
    season: str,
) -> int:
    """
    Rebuild player_season_stats from events_raw.

    Player minutes estimation:
      We don't have exact time-on-pitch from this event data.
      Approximation: matches * 90. This is imprecise but sufficient
      for V1 per-90 normalizations.
    """
    logger.info("Rebuilding player_season_stats for %s %s...", competition_id, season)

    rows = await conn.fetch(
        """
        WITH player_goals AS (
            SELECT
                player_id,
                SUM(1) AS goals,
                SUM(CASE WHEN (qualifiers->>'own goal')::boolean THEN 1 ELSE 0 END) AS own_goals,
                SUM(CASE WHEN (qualifiers->>'Penalty') = 'Si' THEN 1 ELSE 0 END) AS penalties
            FROM events_raw
            WHERE competition_id = $1 AND season = $2
              AND event = 'Goal'
            GROUP BY player_id
        ),
        player_assists AS (
            SELECT
                player_id,
                SUM(1) AS assists
            FROM events_raw
            WHERE competition_id = $1 AND season = $2
              AND (qualifiers->>'Intentional Assist') IS NOT NULL
              AND (qualifiers->>'Leading to goal') IS NOT NULL
            GROUP BY player_id
        ),
        player_shots AS (
            SELECT
                player_id,
                SUM(1) AS shots,
                SUM(CASE WHEN event IN ('Goal', 'Saved Shot') THEN 1 ELSE 0 END) AS shots_on_target,
                ROUND(SUM(COALESCE(xg_value, 0))::numeric, 2) AS xg,
                ROUND(SUM(
                    CASE WHEN (qualifiers->>'Penalty') IS NULL
                         THEN COALESCE(xg_value, 0) ELSE 0 END
                )::numeric, 2) AS npxg,
                SUM(CASE WHEN (qualifiers->>'Big Chance') IS NOT NULL THEN 1 ELSE 0 END) AS big_chances
            FROM events_raw
            WHERE competition_id = $1 AND season = $2
              AND macro_category = 'shot'
            GROUP BY player_id
        ),
        player_appearances AS (
            SELECT
                player_id,
                COUNT(DISTINCT match_id) AS matches,
                MAX(position) AS position,
                MAX(team_id) AS team_id,
                MAX(team_name) AS team_name
            FROM events_raw
            WHERE competition_id = $1 AND season = $2
              AND player_id IS NOT NULL
              AND player_name NOT IN ('', 'Unknown')
            GROUP BY player_id
        )
        SELECT
            pa.player_id,
            MAX(er.player_name) AS player_name,
            pa.team_id,
            pa.team_name,
            pa.position,
            pa.matches,
            pa.matches * 90 AS minutes,
            COALESCE(pg.goals, 0) - COALESCE(pg.own_goals, 0) AS goals,
            COALESCE(pst.assists, 0) AS assists,
            COALESCE(pg.penalties, 0) AS penalties_scored,
            COALESCE(pg.own_goals, 0) AS own_goals,
            COALESCE(ps.shots, 0) AS shots,
            COALESCE(ps.shots_on_target, 0) AS shots_on_target,
            COALESCE(ps.xg, 0) AS xg,
            COALESCE(ps.npxg, 0) AS npxg,
            CASE WHEN COALESCE(ps.shots, 0) > 0
                 THEN ROUND((ps.xg / ps.shots)::numeric, 3) ELSE NULL END AS xg_per_shot,
            ROUND((COALESCE(pg.goals, 0) - COALESCE(pg.own_goals, 0) - COALESCE(ps.npxg, 0))::numeric, 2)
                AS goals_above_xg,
            COALESCE(ps.big_chances, 0) AS big_chances
        FROM player_appearances pa
        JOIN events_raw er
          ON er.player_id = pa.player_id
         AND er.competition_id = $1
         AND er.season = $2
        LEFT JOIN player_goals pg ON pg.player_id = pa.player_id
        LEFT JOIN player_assists pst ON pst.player_id = pa.player_id
        LEFT JOIN player_shots ps ON ps.player_id = pa.player_id
        WHERE pa.player_id IS NOT NULL
        GROUP BY
            pa.player_id, pa.team_id, pa.team_name, pa.position, pa.matches,
            pg.goals, pg.own_goals, pg.penalties, pst.assists,
            ps.shots, ps.shots_on_target, ps.xg, ps.npxg, ps.big_chances
        HAVING pa.matches >= 1
        """,
        competition_id,
        season,
    )

    if not rows:
        logger.warning("No player data found for %s %s", competition_id, season)
        return 0

    upsert_sql = """
        INSERT INTO player_season_stats (
            player_id, player_name, team_id, team_name,
            competition_id, season, position,
            matches, minutes, goals, assists,
            penalties_scored, own_goals,
            shots, shots_on_target,
            xg, npxg, xg_per_shot, goals_above_xg,
            big_chances, last_refreshed
        ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $7,
            $8, $9, $10, $11,
            $12, $13,
            $14, $15,
            $16, $17, $18, $19,
            $20, NOW()
        )
        ON CONFLICT (player_id, competition_id, season) DO UPDATE SET
            player_name      = EXCLUDED.player_name,
            team_id          = EXCLUDED.team_id,
            goals            = EXCLUDED.goals,
            assists          = EXCLUDED.assists,
            shots            = EXCLUDED.shots,
            shots_on_target  = EXCLUDED.shots_on_target,
            xg               = EXCLUDED.xg,
            npxg             = EXCLUDED.npxg,
            xg_per_shot      = EXCLUDED.xg_per_shot,
            goals_above_xg   = EXCLUDED.goals_above_xg,
            big_chances      = EXCLUDED.big_chances,
            matches          = EXCLUDED.matches,
            last_refreshed   = NOW()
    """

    async with conn.transaction():
        for row in rows:
            await conn.execute(
                upsert_sql,
                row["player_id"],
                row["player_name"],
                row["team_id"],
                row["team_name"],
                competition_id,
                season,
                row["position"],
                row["matches"],
                row["minutes"],
                row["goals"],
                row["assists"],
                row["penalties_scored"],
                row["own_goals"],
                row["shots"],
                row["shots_on_target"],
                row["xg"],
                row["npxg"],
                row["xg_per_shot"],
                row["goals_above_xg"],
                row["big_chances"],
            )

    logger.info(
        "player_season_stats rebuilt: %d players for %s %s",
        len(rows),
        competition_id,
        season,
    )
    return len(rows)
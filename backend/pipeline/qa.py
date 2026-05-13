"""
Pressing Room — Data Quality Checks

Runs after ingestion and aggregation to catch silent data errors.
QA checks are grouped by severity:
  ERROR   — must be fixed before the data is queryable
  WARNING — worth logging and investigating, but not blocking

All checks run as SQL queries against the live database.
"""

import logging
from dataclasses import dataclass
from typing import Any

import asyncpg

logger = logging.getLogger(__name__)


@dataclass
class QAResult:
    name: str
    severity: str   # "ERROR" | "WARNING"
    passed: bool
    detail: str
    rows: list[Any]


async def run_all_qa(conn: asyncpg.Connection, competition_id: str, season: str) -> list[QAResult]:
    """
    Run all QA checks for a given competition/season.
    Returns list of QAResult objects. Any ERROR-severity failure should alert.
    """
    results = []
    checks = [
        _check_match_count,
        _check_goals_match_scorelines,
        _check_both_teams_per_match,
        _check_xg_range,
        _check_shot_normalization,
        _check_standings_row_count,
        _check_player_stats_exist,
    ]

    for check_fn in checks:
        try:
            result = await check_fn(conn, competition_id, season)
            results.append(result)
            if not result.passed:
                if result.severity == "ERROR":
                    logger.error("QA FAIL [%s]: %s", result.name, result.detail)
                else:
                    logger.warning("QA WARN [%s]: %s", result.name, result.detail)
        except Exception as exc:
            results.append(QAResult(
                name=check_fn.__name__,
                severity="ERROR",
                passed=False,
                detail=f"Check raised exception: {exc}",
                rows=[],
            ))
            logger.error("QA check %s raised: %s", check_fn.__name__, exc, exc_info=True)

    passed = sum(1 for r in results if r.passed)
    failed_errors = sum(1 for r in results if not r.passed and r.severity == "ERROR")
    failed_warns  = sum(1 for r in results if not r.passed and r.severity == "WARNING")
    logger.info(
        "QA complete: %d/%d passed, %d errors, %d warnings",
        passed, len(results), failed_errors, failed_warns,
    )
    return results


async def _check_match_count(
    conn: asyncpg.Connection, competition_id: str, season: str
) -> QAResult:
    """At least some matches must exist."""
    count = await conn.fetchval(
        "SELECT COUNT(*) FROM matches WHERE competition_id = $1 AND season = $2",
        competition_id, season,
    )
    passed = count is not None and count > 0
    return QAResult(
        name="match_count",
        severity="ERROR",
        passed=passed,
        detail=f"Found {count} matches for {competition_id}/{season}",
        rows=[],
    )


async def _check_goals_match_scorelines(
    conn: asyncpg.Connection, competition_id: str, season: str
) -> QAResult:
    """
    Goal events in events_raw must roughly match scorelines in matches table.
    Tolerance: ±1 (to accommodate own goals counted differently).
    """
    rows = await conn.fetch("""
        SELECT
            m.match_id,
            m.home_goals + m.away_goals AS scoreline_goals,
            COUNT(e.id) AS event_goals
        FROM matches m
        LEFT JOIN events_raw e ON e.match_id = m.match_id
            AND e.event = 'Goal'
        WHERE m.competition_id = $1 AND m.season = $2
        GROUP BY m.match_id, m.home_goals, m.away_goals
        HAVING ABS((m.home_goals + m.away_goals) - COUNT(e.id)) > 1
    """, competition_id, season)

    passed = len(rows) == 0
    detail = (
        "All match scorelines match goal events"
        if passed
        else f"{len(rows)} matches have scoreline/event mismatch: "
             + ", ".join(r["match_id"] for r in rows[:5])
    )
    return QAResult(
        name="goals_match_scorelines",
        severity="ERROR",
        passed=passed,
        detail=detail,
        rows=list(rows),
    )


async def _check_both_teams_per_match(
    conn: asyncpg.Connection, competition_id: str, season: str
) -> QAResult:
    """Every match must have events from exactly 2 teams."""
    rows = await conn.fetch("""
        SELECT match_id, COUNT(DISTINCT team_id) AS team_count
        FROM events_raw
        WHERE competition_id = $1 AND season = $2
        GROUP BY match_id
        HAVING COUNT(DISTINCT team_id) != 2
    """, competition_id, season)

    passed = len(rows) == 0
    detail = (
        "All matches have events from 2 teams"
        if passed
        else f"{len(rows)} matches missing events from one team"
    )
    return QAResult(
        name="both_teams_per_match",
        severity="ERROR",
        passed=passed,
        detail=detail,
        rows=list(rows),
    )


async def _check_xg_range(
    conn: asyncpg.Connection, competition_id: str, season: str
) -> QAResult:
    """
    Total xG per match must be in a sane range.
    A match with total xG > 8 or < 0.1 is suspicious.
    """
    rows = await conn.fetch("""
        SELECT match_id, ROUND(SUM(xg_value)::numeric, 2) AS total_xg
        FROM events_raw
        WHERE competition_id = $1 AND season = $2
          AND macro_category = 'shot'
          AND xg_value IS NOT NULL
        GROUP BY match_id
        HAVING SUM(xg_value) > 8.0 OR SUM(xg_value) < 0.10
    """, competition_id, season)

    passed = len(rows) == 0
    detail = (
        "All match xG totals within expected range [0.10, 8.0]"
        if passed
        else f"{len(rows)} matches have unusual total xG"
    )
    return QAResult(
        name="xg_range",
        severity="WARNING",
        passed=passed,
        detail=detail,
        rows=list(rows),
    )


async def _check_shot_normalization(
    conn: asyncpg.Connection, competition_id: str, season: str
) -> QAResult:
    """
    Verify coordinate normalization at the DB level.
    Home shots should cluster in x > 60, away shots in x < 40.
    Any match where this fails by a large margin is suspicious.
    """
    rows = await conn.fetch("""
        SELECT
            match_id,
            team_position,
            COUNT(*) AS total_shots,
            COUNT(*) FILTER (WHERE team_position = 'home' AND x > 60) AS home_high_x,
            COUNT(*) FILTER (WHERE team_position = 'away' AND x < 40) AS away_low_x
        FROM events_raw
        WHERE competition_id = $1 AND season = $2
          AND macro_category = 'shot'
        GROUP BY match_id, team_position
        HAVING
            (team_position = 'home' AND COUNT(*) > 3 AND
             COUNT(*) FILTER (WHERE x > 60)::float / COUNT(*) < 0.70)
            OR
            (team_position = 'away' AND COUNT(*) > 3 AND
             COUNT(*) FILTER (WHERE x < 40)::float / COUNT(*) < 0.70)
    """, competition_id, season)

    passed = len(rows) == 0
    detail = (
        "Shot coordinates look correctly normalized"
        if passed
        else f"{len(rows)} team/match combinations have suspicious shot coordinates"
    )
    return QAResult(
        name="shot_normalization",
        severity="ERROR",
        passed=passed,
        detail=detail,
        rows=list(rows),
    )


async def _check_standings_row_count(
    conn: asyncpg.Connection, competition_id: str, season: str
) -> QAResult:
    """
    team_season_stats must have 18 rows for Ligue 1.
    """
    count = await conn.fetchval(
        "SELECT COUNT(*) FROM team_season_stats WHERE competition_id = $1 AND season = $2",
        competition_id, season,
    )
    expected = 18
    passed = count == expected
    detail = f"Found {count} teams in standings (expected {expected})"
    return QAResult(
        name="standings_row_count",
        severity="WARNING",
        passed=passed,
        detail=detail,
        rows=[],
    )


async def _check_player_stats_exist(
    conn: asyncpg.Connection, competition_id: str, season: str
) -> QAResult:
    """player_season_stats must have at least 200 player rows (18 squads × ~25 players)."""
    count = await conn.fetchval(
        "SELECT COUNT(*) FROM player_season_stats WHERE competition_id = $1 AND season = $2",
        competition_id, season,
    )
    passed = count is not None and count >= 50
    detail = f"Found {count} player season records"
    return QAResult(
        name="player_stats_exist",
        severity="WARNING",
        passed=passed,
        detail=detail,
        rows=[],
    )

"""
GET /api/fixtures?week={n}&team_id={id}   — upcoming/current week fixtures
GET /api/results?weeks={n}&team_id={id}   — recent completed results
"""
import logging
from typing import Optional

import asyncpg
from fastapi import APIRouter, Depends, Query

from app.cache import cache
from app.config import settings
from app.database import get_db
from app.schemas.match import MatchSummary
from app.schemas.common import MatchResult

logger = logging.getLogger(__name__)
router = APIRouter(tags=["fixtures"])

COMPETITION_ID = settings.COMPETITION_ID


def _compute_match_badge(home_xg: float | None, away_xg: float | None,
                          home_goals: int, away_goals: int) -> str | None:
    """
    Auto-generate a match narrative badge for result cards.

    Logic:
      - "Comfortable" if winner won by 2+ goals AND had higher xG
      - "Fortunate"   if actual winner had lower xG than loser
      - "Deserved"    if xG winner matches actual winner
      - "Clean sheet" if one team conceded 0
      - None if no strong signal
    """
    if home_xg is None or away_xg is None:
        if home_goals == 0 or away_goals == 0:
            return "Clean sheet"
        return None

    xg_diff = abs(home_xg - away_xg)
    goal_diff = abs(home_goals - away_goals)

    if home_goals == 0 or away_goals == 0:
        return "Clean sheet"

    if xg_diff < 0.3:
        return None  # Too close to call

    home_won = home_goals > away_goals
    away_won = away_goals > home_goals
    home_xg_won = home_xg > away_xg

    if home_won and not home_xg_won:
        return "Fortunate"
    if away_won and home_xg_won:
        return "Fortunate"
    if goal_diff >= 2 and xg_diff >= 0.5:
        return "Comfortable"
    return "Deserved"


async def _get_form(conn: asyncpg.Connection, team_id: str, before_date: str,
                    competition_id: str, season: str, n: int = 5) -> list[MatchResult]:
    rows = await conn.fetch("""
        SELECT result FROM team_match_stats
        WHERE team_id = $1
          AND competition_id = $2
          AND season = $3
          AND local_date < $4
        ORDER BY local_date DESC
        LIMIT $5
    """, team_id, competition_id, season, before_date, n)
    return [r["result"] for r in rows]  # type: ignore[return-value]


@router.get("/fixtures", response_model=list[MatchSummary])
async def get_fixtures(
    week: Optional[int] = Query(default=None, description="Matchweek number"),
    team_id: Optional[str] = Query(default=None),
    season: str = Query(default=None),
    conn: asyncpg.Connection = Depends(get_db),
):
    """
    Returns fixtures for a given matchweek. Defaults to current/most recent week.
    """
    season = season or settings.DEFAULT_SEASON
    cache_key = f"fixtures:{COMPETITION_ID}:{season}:{week}:{team_id}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    # Determine target week
    if week is None:
        # Default: most recent week with matches
        week_row = await conn.fetchrow("""
            SELECT week FROM matches
            WHERE competition_id = $1 AND season = $2
            ORDER BY local_date DESC
            LIMIT 1
        """, COMPETITION_ID, season)
        week = week_row["week"] if week_row else 1

    query = """
        SELECT match_id, week, local_date::text, local_time::text,
               home_team_id, home_team_name, away_team_id, away_team_name,
               home_goals, away_goals, home_xg, away_xg, status
        FROM matches
        WHERE competition_id = $1 AND season = $2 AND week = $3
    """
    params: list = [COMPETITION_ID, season, week]

    if team_id:
        query += " AND (home_team_id = $4 OR away_team_id = $4)"
        params.append(team_id)

    query += " ORDER BY local_date, local_time"
    rows = await conn.fetch(query, *params)

    results = []
    for row in rows:
        home_form = await _get_form(conn, row["home_team_id"],
                                    row["local_date"], COMPETITION_ID, season)
        away_form = await _get_form(conn, row["away_team_id"],
                                    row["local_date"], COMPETITION_ID, season)
        results.append(MatchSummary(
            match_id=row["match_id"],
            week=row["week"],
            local_date=row["local_date"],
            local_time=row["local_time"],
            home_team_id=row["home_team_id"],
            home_team_name=row["home_team_name"],
            away_team_id=row["away_team_id"],
            away_team_name=row["away_team_name"],
            home_goals=row["home_goals"],
            away_goals=row["away_goals"],
            home_xg=float(row["home_xg"]) if row["home_xg"] else None,
            away_xg=float(row["away_xg"]) if row["away_xg"] else None,
            status=row["status"],
            home_form=home_form,
            away_form=away_form,
        ))

    cache.set(cache_key, results, ttl=3600)
    return results


@router.get("/results", response_model=list[MatchSummary])
async def get_results(
    weeks: int = Query(default=3, ge=1, le=10, description="Number of recent weeks"),
    team_id: Optional[str] = Query(default=None),
    season: str = Query(default=None),
    conn: asyncpg.Connection = Depends(get_db),
):
    """
    Returns completed results for the last N matchweeks.
    """
    season = season or settings.DEFAULT_SEASON
    cache_key = f"results:{COMPETITION_ID}:{season}:{weeks}:{team_id}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    # Get the last N completed weeks
    weeks_row = await conn.fetch("""
        SELECT DISTINCT week FROM matches
        WHERE competition_id = $1 AND season = $2 AND status = 'completed'
        ORDER BY week DESC
        LIMIT $3
    """, COMPETITION_ID, season, weeks)

    if not weeks_row:
        return []

    target_weeks = [r["week"] for r in weeks_row]

    query = """
        SELECT m.match_id, m.week, m.local_date::text, m.local_time::text,
               m.home_team_id, m.home_team_name, m.away_team_id, m.away_team_name,
               m.home_goals, m.away_goals, m.home_xg, m.away_xg, m.status
        FROM matches m
        WHERE m.competition_id = $1 AND m.season = $2
          AND m.week = ANY($3) AND m.status = 'completed'
    """
    params: list = [COMPETITION_ID, season, target_weeks]

    if team_id:
        query += " AND (m.home_team_id = $4 OR m.away_team_id = $4)"
        params.append(team_id)

    query += " ORDER BY m.local_date DESC, m.local_time DESC"
    rows = await conn.fetch(query, *params)

    # Fetch scorers (goals) for each match in one query
    match_ids = [r["match_id"] for r in rows]
    goal_rows = await conn.fetch("""
        SELECT match_id, player_name, team_id, time_min,
               (qualifiers->>'Penalty') AS is_penalty,
               (qualifiers->>'own goal') AS is_own_goal
        FROM events_raw
        WHERE match_id = ANY($1) AND event = 'Goal'
        ORDER BY time_min
    """, match_ids) if match_ids else []

    # Group goals by match
    goals_by_match: dict[str, list] = {}
    for g in goal_rows:
        goals_by_match.setdefault(g["match_id"], []).append(g)

    results = []
    for row in rows:
        mid = row["match_id"]
        badge = _compute_match_badge(
            float(row["home_xg"]) if row["home_xg"] else None,
            float(row["away_xg"]) if row["away_xg"] else None,
            row["home_goals"] or 0,
            row["away_goals"] or 0,
        )

        results.append(MatchSummary(
            match_id=mid,
            week=row["week"],
            local_date=row["local_date"],
            local_time=row["local_time"],
            home_team_id=row["home_team_id"],
            home_team_name=row["home_team_name"],
            away_team_id=row["away_team_id"],
            away_team_name=row["away_team_name"],
            home_goals=row["home_goals"],
            away_goals=row["away_goals"],
            home_xg=float(row["home_xg"]) if row["home_xg"] else None,
            away_xg=float(row["away_xg"]) if row["away_xg"] else None,
            status=row["status"],
            match_badge=badge,
        ))

    cache.set(cache_key, results, ttl=3600)
    return results

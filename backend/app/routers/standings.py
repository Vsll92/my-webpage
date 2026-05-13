"""
GET /api/standings?season={s}&split={all|home|away}

Returns the full Ligue 1 standings for a given season.
Includes form strips and optional xG columns.
Cached for 6 hours — updated after each matchday pipeline run.
"""
import logging
from typing import Annotated, Literal, Optional

import asyncpg
from fastapi import APIRouter, Depends, Query

from app.cache import cache
from app.config import settings
from app.database import get_db
from app.schemas.standings import StandingRow, StandingsResponse
from app.schemas.common import MatchResult

logger = logging.getLogger(__name__)
router = APIRouter(tags=["standings"])


def _form_list(form_str: str | None) -> list[MatchResult]:
    """Convert a comma-separated form string to a typed list."""
    if not form_str:
        return []
    return [r.strip() for r in form_str.split(",") if r.strip() in ("W", "D", "L")]  # type: ignore[return-value]


@router.get("/standings", response_model=StandingsResponse)
async def get_standings(
    season: str = Query(default=None),
    conn: asyncpg.Connection = Depends(get_db),
):
    season = season or settings.DEFAULT_SEASON
    competition_id = settings.COMPETITION_ID
    cache_key = f"standings:{competition_id}:{season}"

    # Check cache
    cached = cache.get(cache_key)
    if cached:
        return cached

    # Fetch standings ordered by points → GD → GF (standard football tiebreaker)
    rows = await conn.fetch("""
        SELECT
            tss.team_id,
            tss.team_name,
            tss.league_position,
            tss.matches_played,
            tss.wins,
            tss.draws,
            tss.losses,
            tss.goals_for,
            tss.goals_against,
            tss.goal_diff,
            tss.points,
            tss.xg_for,
            tss.xg_against,
            tss.xg_diff,
            tss.xg_delta
        FROM team_season_stats tss
        WHERE tss.competition_id = $1
          AND tss.season = $2
        ORDER BY tss.points DESC, tss.goal_diff DESC, tss.goals_for DESC
    """, competition_id, season)

    if not rows:
        logger.warning("No standings data found for %s/%s", competition_id, season)
        return StandingsResponse(season=season, competition_id=competition_id, rows=[])

    # Fetch form (last 5 results) for each team
    form_rows = await conn.fetch("""
        SELECT
            tms.team_id,
            STRING_AGG(tms.result, ',' ORDER BY tms.local_date DESC) AS form_str
        FROM (
            SELECT team_id, result, local_date,
                   ROW_NUMBER() OVER (PARTITION BY team_id ORDER BY local_date DESC) AS rn
            FROM team_match_stats
            WHERE competition_id = $1 AND season = $2
        ) tms
        WHERE tms.rn <= 5
        GROUP BY tms.team_id
    """, competition_id, season)

    form_map: dict[str, list[MatchResult]] = {
        r["team_id"]: _form_list(r["form_str"])
        for r in form_rows
    }

    standing_rows = [
        StandingRow(
            position=row["league_position"] or (i + 1),
            team_id=row["team_id"],
            team_name=row["team_name"],
            played=row["matches_played"],
            won=row["wins"],
            drawn=row["draws"],
            lost=row["losses"],
            goals_for=row["goals_for"],
            goals_against=row["goals_against"],
            goal_diff=row["goal_diff"],
            points=row["points"],
            form=form_map.get(row["team_id"], []),
            xg_for=float(row["xg_for"]) if row["xg_for"] else None,
            xg_against=float(row["xg_against"]) if row["xg_against"] else None,
            xg_diff=float(row["xg_diff"]) if row["xg_diff"] else None,
            xg_delta=float(row["xg_delta"]) if row["xg_delta"] else None,
        )
        for i, row in enumerate(rows)
    ]

    response = StandingsResponse(
        season=season,
        competition_id=competition_id,
        rows=standing_rows,
    )
    cache.set(cache_key, response, ttl=settings.CACHE_TTL_SECONDS)
    return response

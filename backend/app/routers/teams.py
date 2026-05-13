"""
GET /api/teams/{team_id}/overview?season={s}&last_n={n}
"""
import logging
from typing import Optional

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from app.cache import cache
from app.config import settings
from app.database import get_db
from app.schemas.team import TeamOverview
from app.schemas.match import FormEntry

logger = logging.getLogger(__name__)
router = APIRouter(tags=["teams"])


@router.get("/teams/{team_id}/overview", response_model=TeamOverview)
async def get_team_overview(
    team_id: str,
    season: str = Query(default=None),
    last_n: int = Query(default=10, ge=3, le=38),
    conn: asyncpg.Connection = Depends(get_db),
):
    season = season or settings.DEFAULT_SEASON
    competition_id = settings.COMPETITION_ID
    cache_key = f"team_overview:{team_id}:{season}:{last_n}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    # Season stats
    row = await conn.fetchrow("""
        SELECT * FROM team_season_stats
        WHERE team_id = $1 AND competition_id = $2 AND season = $3
    """, team_id, competition_id, season)

    if not row:
        raise HTTPException(status_code=404, detail=f"Team {team_id} not found for {season}")

    # Form — last N matches
    form_rows = await conn.fetch("""
        SELECT tms.match_id, tms.local_date::text, tms.result,
               tms.goals, tms.goals_against, tms.xg, tms.xga,
               tms.is_home,
               CASE WHEN tms.is_home THEN m.away_team_name ELSE m.home_team_name END AS opponent_name
        FROM team_match_stats tms
        JOIN matches m ON m.match_id = tms.match_id
        WHERE tms.team_id = $1 AND tms.competition_id = $2 AND tms.season = $3
        ORDER BY tms.local_date DESC
        LIMIT $4
    """, team_id, competition_id, season, last_n)

    form = [
        FormEntry(
            match_id=r["match_id"],
            date=r["local_date"],
            opponent_name=r["opponent_name"],
            result=r["result"],
            goals_for=r["goals"],
            goals_against=r["goals_against"],
            xg=float(r["xg"]) if r["xg"] else None,
            xga=float(r["xga"]) if r["xga"] else None,
            is_home=r["is_home"],
        )
        for r in form_rows
    ]

    # Top scorers for this team
    scorer_rows = await conn.fetch("""
        SELECT player_id, player_name, goals, assists
        FROM player_season_stats
        WHERE team_id = $1 AND competition_id = $2 AND season = $3
          AND goals > 0
        ORDER BY goals DESC
        LIMIT 5
    """, team_id, competition_id, season)

    response = TeamOverview(
        team_id=row["team_id"],
        team_name=row["team_name"],
        season=season,
        league_position=row["league_position"] or 0,
        played=row["matches_played"],
        won=row["wins"],
        drawn=row["draws"],
        lost=row["losses"],
        goals_for=row["goals_for"],
        goals_against=row["goals_against"],
        points=row["points"],
        xg_for=float(row["xg_for"]) if row["xg_for"] else None,
        xg_against=float(row["xg_against"]) if row["xg_against"] else None,
        xg_delta=float(row["xg_delta"]) if row["xg_delta"] else None,
        shots_per90=float(row["shots_for_per90"]) if row["shots_for_per90"] else None,
        ppda=float(row["ppda_season"]) if row["ppda_season"] else None,
        def_action_height=float(row["def_action_height"]) if row["def_action_height"] else None,
        possession_avg=float(row["possession_avg"]) if row["possession_avg"] else None,
        form=form,
        top_scorers=[dict(r) for r in scorer_rows],
    )

    cache.set(cache_key, response, ttl=settings.CACHE_TTL_SECONDS)
    return response

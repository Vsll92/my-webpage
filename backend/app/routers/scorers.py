"""
GET /api/scorers?season={s}&min_apps={n}&limit={n}
"""
import asyncpg
from fastapi import APIRouter, Depends, Query
from app.cache import cache
from app.config import settings
from app.database import get_db
from app.schemas.scorer import ScorerRow, ScorersResponse

router = APIRouter(tags=["scorers"])


@router.get("/scorers", response_model=ScorersResponse)
async def get_scorers(
    season: str = Query(default=None),
    min_apps: int = Query(default=3, ge=1, description="Minimum appearances"),
    limit: int = Query(default=30, ge=5, le=100),
    conn: asyncpg.Connection = Depends(get_db),
):
    season = season or settings.DEFAULT_SEASON
    competition_id = settings.COMPETITION_ID
    cache_key = f"scorers:{competition_id}:{season}:{min_apps}:{limit}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    rows = await conn.fetch("""
        SELECT
            player_id, player_name, team_id, team_name, position,
            matches, minutes, goals, assists, shots, shots_on_target,
            xg, npxg, xg_per_shot, goals_above_xg, big_chances
        FROM player_season_stats
        WHERE competition_id = $1
          AND season = $2
          AND matches >= $3
          AND goals >= 0
        ORDER BY goals DESC, xg DESC
        LIMIT $4
    """, competition_id, season, min_apps, limit)

    scorer_rows = [
        ScorerRow(
            rank=i + 1,
            player_id=r["player_id"],
            player_name=r["player_name"],
            team_id=r["team_id"],
            team_name=r["team_name"],
            position=r["position"],
            matches=r["matches"],
            minutes=r["minutes"],
            goals=r["goals"],
            assists=r["assists"],
            shots=r["shots"],
            shots_on_target=r["shots_on_target"],
            shots_per90=round(r["shots"] * 90.0 / max(r["minutes"], 1), 2) if r["shots"] else None,
            xg=float(r["xg"]) if r["xg"] else None,
            npxg=float(r["npxg"]) if r["npxg"] else None,
            xg_per_shot=float(r["xg_per_shot"]) if r["xg_per_shot"] else None,
            goals_above_xg=float(r["goals_above_xg"]) if r["goals_above_xg"] else None,
            big_chances=r["big_chances"],
        )
        for i, r in enumerate(rows)
    ]

    response = ScorersResponse(season=season, rows=scorer_rows)
    cache.set(cache_key, response, ttl=settings.CACHE_TTL_SECONDS)
    return response

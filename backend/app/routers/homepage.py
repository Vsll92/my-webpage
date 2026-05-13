"""
GET /api/homepage  — single aggregated call for all homepage data.

Returns current matchweek fixtures + mini standings + top performers.
Cached 1 hour. This single endpoint replaces 3+ separate calls on the homepage.
"""
import asyncpg
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional

from app.cache import cache
from app.config import settings
from app.database import get_db
from app.schemas.match import MatchSummary
from app.schemas.standings import StandingRow
from app.schemas.common import MatchResult

router = APIRouter(tags=["homepage"])


class TopPerformer(BaseModel):
    player_name: str
    team_id: str
    team_name: str
    metric_label: str
    metric_value: float


class HomepageResponse(BaseModel):
    current_week: int
    fixtures: list[MatchSummary]
    standings_top8: list[StandingRow]
    top_performers: list[TopPerformer]


@router.get("/homepage", response_model=HomepageResponse)
async def get_homepage(
    conn: asyncpg.Connection = Depends(get_db),
):
    competition_id = settings.COMPETITION_ID
    season = settings.DEFAULT_SEASON
    cache_key = f"homepage:{competition_id}:{season}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    # ── Current week ──────────────────────────────────────────────────────────
    week_row = await conn.fetchrow("""
        SELECT week FROM matches
        WHERE competition_id = $1 AND season = $2
        ORDER BY local_date DESC LIMIT 1
    """, competition_id, season)
    current_week = week_row["week"] if week_row else 1

    # ── Fixtures for current week ──────────────────────────────────────────────
    match_rows = await conn.fetch("""
        SELECT match_id, week, local_date::text, local_time::text,
               home_team_id, home_team_name, away_team_id, away_team_name,
               home_goals, away_goals, home_xg, away_xg, status
        FROM matches
        WHERE competition_id = $1 AND season = $2 AND week = $3
        ORDER BY local_date, local_time
    """, competition_id, season, current_week)

    # Form for each team
    form_rows = await conn.fetch("""
        SELECT team_id,
               array_agg(result ORDER BY local_date DESC) AS form
        FROM (
            SELECT team_id, result, local_date,
                   ROW_NUMBER() OVER (PARTITION BY team_id ORDER BY local_date DESC) AS rn
            FROM team_match_stats
            WHERE competition_id = $1 AND season = $2
        ) t WHERE rn <= 5
        GROUP BY team_id
    """, competition_id, season)
    form_map: dict[str, list] = {r["team_id"]: r["form"] for r in form_rows}

    fixtures = [
        MatchSummary(
            match_id=r["match_id"],
            week=r["week"],
            local_date=r["local_date"],
            local_time=r["local_time"],
            home_team_id=r["home_team_id"],
            home_team_name=r["home_team_name"],
            away_team_id=r["away_team_id"],
            away_team_name=r["away_team_name"],
            home_goals=r["home_goals"],
            away_goals=r["away_goals"],
            home_xg=float(r["home_xg"]) if r["home_xg"] else None,
            away_xg=float(r["away_xg"]) if r["away_xg"] else None,
            status=r["status"],
            home_form=form_map.get(r["home_team_id"], [])[:5],
            away_form=form_map.get(r["away_team_id"], [])[:5],
        )
        for r in match_rows
    ]

    # ── Top 8 standings ────────────────────────────────────────────────────────
    standings_rows = await conn.fetch("""
        SELECT team_id, team_name, league_position,
               matches_played, wins, draws, losses,
               goals_for, goals_against, goal_diff, points,
               xg_for, xg_against, xg_diff, xg_delta
        FROM team_season_stats
        WHERE competition_id = $1 AND season = $2
        ORDER BY points DESC, goal_diff DESC
        LIMIT 8
    """, competition_id, season)

    standings_top8 = [
        StandingRow(
            position=r["league_position"] or (i+1),
            team_id=r["team_id"],
            team_name=r["team_name"],
            played=r["matches_played"],
            won=r["wins"],
            drawn=r["draws"],
            lost=r["losses"],
            goals_for=r["goals_for"],
            goals_against=r["goals_against"],
            goal_diff=r["goal_diff"],
            points=r["points"],
            form=form_map.get(r["team_id"], [])[:5],
            xg_for=float(r["xg_for"]) if r["xg_for"] else None,
            xg_delta=float(r["xg_delta"]) if r["xg_delta"] else None,
        )
        for i, r in enumerate(standings_rows)
    ]

    # ── Top performers this season ─────────────────────────────────────────────
    top_scorer = await conn.fetchrow("""
        SELECT player_name, team_id, team_name, goals
        FROM player_season_stats
        WHERE competition_id = $1 AND season = $2 AND goals > 0
        ORDER BY goals DESC LIMIT 1
    """, competition_id, season)

    top_assists = await conn.fetchrow("""
        SELECT player_name, team_id, team_name, assists
        FROM player_season_stats
        WHERE competition_id = $1 AND season = $2 AND assists > 0
        ORDER BY assists DESC LIMIT 1
    """, competition_id, season)

    top_xg = await conn.fetchrow("""
        SELECT player_name, team_id, team_name, npxg
        FROM player_season_stats
        WHERE competition_id = $1 AND season = $2 AND npxg > 0
        ORDER BY npxg DESC LIMIT 1
    """, competition_id, season)

    performers = []
    if top_scorer:
        performers.append(TopPerformer(
            player_name=top_scorer["player_name"],
            team_id=top_scorer["team_id"],
            team_name=top_scorer["team_name"],
            metric_label="Goals",
            metric_value=float(top_scorer["goals"]),
        ))
    if top_assists:
        performers.append(TopPerformer(
            player_name=top_assists["player_name"],
            team_id=top_assists["team_id"],
            team_name=top_assists["team_name"],
            metric_label="Assists",
            metric_value=float(top_assists["assists"]),
        ))
    if top_xg:
        performers.append(TopPerformer(
            player_name=top_xg["player_name"],
            team_id=top_xg["team_id"],
            team_name=top_xg["team_name"],
            metric_label="npxG",
            metric_value=float(top_xg["npxg"]),
        ))

    response = HomepageResponse(
        current_week=current_week,
        fixtures=fixtures,
        standings_top8=standings_top8,
        top_performers=performers,
    )
    cache.set(cache_key, response, ttl=3600)
    return response

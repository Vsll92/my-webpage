"""
GET /api/matches/{match_id}                  — match detail with facts + stats
GET /api/matches/{match_id}/shots            — shot data for shot map
GET /api/matches/{match_id}/xg-flow          — cumulative xG by minute
GET /api/matches/{match_id}/tactical         — tactical stats (Pro)
"""
import logging
from typing import Optional, Literal

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from app.cache import cache
from app.config import settings
from app.database import get_db
from app.schemas.match import (
    MatchDetail, MatchFacts, MatchStats, GoalEvent, CardEvent, SubEvent,
    LineupPlayer, ShotsResponse, ShotData,
    XGFlowResponse, XGPoint, XGGoal, TacticalResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["matches"])

SHOTS_TTL = settings.SHOTS_CACHE_TTL   # 24h for completed match data


@router.get("/matches/{match_id}", response_model=MatchDetail)
async def get_match_detail(
    match_id: str,
    conn: asyncpg.Connection = Depends(get_db),
):
    cache_key = f"match_detail:{match_id}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    # Match metadata
    match_row = await conn.fetchrow("""
        SELECT match_id, week, local_date::text, local_time::text,
               home_team_id, home_team_name, away_team_id, away_team_name,
               home_goals, away_goals, home_xg, away_xg,
               home_formation, away_formation, venue_name, attendance, status
        FROM matches WHERE match_id = $1
    """, match_id)

    if not match_row:
        raise HTTPException(status_code=404, detail=f"Match {match_id} not found")

    # ── Goals ─────────────────────────────────────────────────────────────────
    goal_rows = await conn.fetch("""
        SELECT player_name, team_id, time_min, period_id,
               (qualifiers->>'Penalty') AS is_penalty,
               (qualifiers->>'own goal') AS is_own_goal
        FROM events_raw
        WHERE match_id = $1 AND event = 'Goal'
        ORDER BY time_min
    """, match_id)

    goals = [
        GoalEvent(
            player_name=r["player_name"] or "Unknown",
            team_id=r["team_id"],
            minute=r["time_min"],
            period=r["period_id"],
            is_penalty=r["is_penalty"] == "true",
            is_own_goal=r["is_own_goal"] == "true",
        )
        for r in goal_rows
    ]

    # ── Cards ──────────────────────────────────────────────────────────────────
    card_rows = await conn.fetch("""
        SELECT player_name, team_id, time_min,
               (qualifiers->>'Yellow Card') AS yellow,
               (qualifiers->>'Red Card') AS red,
               (qualifiers->>'Second yellow') AS second_yellow
        FROM events_raw
        WHERE match_id = $1 AND event = 'Card'
        ORDER BY time_min
    """, match_id)

    cards = []
    for r in card_rows:
        if r["second_yellow"] == "Si":
            card_type = "second_yellow"
        elif r["red"] == "Si":
            card_type = "red"
        else:
            card_type = "yellow"
        cards.append(CardEvent(
            player_name=r["player_name"] or "Unknown",
            team_id=r["team_id"],
            minute=r["time_min"],
            card_type=card_type,
        ))

    # ── Substitutions ──────────────────────────────────────────────────────────
    # Match Player Off + Player on by minute within same team
    off_rows = await conn.fetch("""
        SELECT player_name, team_id, time_min,
               (qualifiers->>'Tactical') AS tactical,
               (qualifiers->>'Injury') AS injury
        FROM events_raw
        WHERE match_id = $1 AND event = 'Player Off'
        ORDER BY team_id, time_min
    """, match_id)

    on_rows = await conn.fetch("""
        SELECT player_name, team_id, time_min
        FROM events_raw
        WHERE match_id = $1 AND event = 'Player on'
        ORDER BY team_id, time_min
    """, match_id)

    # Pair off/on by team and minute order
    off_by_team: dict[str, list] = {}
    for r in off_rows:
        off_by_team.setdefault(r["team_id"], []).append(r)

    on_by_team: dict[str, list] = {}
    for r in on_rows:
        on_by_team.setdefault(r["team_id"], []).append(r)

    subs = []
    for team_id in set(list(off_by_team.keys()) + list(on_by_team.keys())):
        offs = off_by_team.get(team_id, [])
        ons = on_by_team.get(team_id, [])
        for i, off in enumerate(offs):
            on_player = ons[i]["player_name"] if i < len(ons) else "Unknown"
            reason = "injury" if off.get("injury") == "Si" else "tactical"
            subs.append(SubEvent(
                player_off=off["player_name"] or "Unknown",
                player_on=on_player,
                team_id=team_id,
                minute=off["time_min"],
                reason=reason,
            ))

    # ── Match stats ────────────────────────────────────────────────────────────
    stats_rows = await conn.fetch("""
        SELECT team_id,
               SUM(CASE WHEN event = 'Pass' THEN 1 ELSE 0 END) AS passes,
               SUM(CASE WHEN event = 'Pass' AND outcome = 1 THEN 1 ELSE 0 END) AS passes_completed,
               SUM(CASE WHEN macro_category = 'shot' THEN 1 ELSE 0 END) AS shots,
               SUM(CASE WHEN event IN ('Goal','Saved Shot') THEN 1 ELSE 0 END) AS sot,
               SUM(CASE WHEN event = 'Corner Awarded' THEN 1 ELSE 0 END) AS corners,
               SUM(CASE WHEN event = 'Foul' THEN 1 ELSE 0 END) AS fouls,
               SUM(CASE WHEN event = 'Pass' THEN 1 ELSE 0 END)::float /
                   NULLIF(SUM(CASE WHEN event = 'Pass' THEN 1 ELSE 0 END) OVER (), 0) * 100
                   AS possession_pct
        FROM events_raw
        WHERE match_id = $1
        GROUP BY team_id
    """, match_id)

    home_stats = next((r for r in stats_rows
                       if r["team_id"] == match_row["home_team_id"]), None)
    away_stats = next((r for r in stats_rows
                       if r["team_id"] == match_row["away_team_id"]), None)

    def _safe(row, col, default=0):
        return row[col] if row and row[col] is not None else default

    match_stats = MatchStats(
        home_shots=_safe(home_stats, "shots"),
        away_shots=_safe(away_stats, "shots"),
        home_shots_on_target=_safe(home_stats, "sot"),
        away_shots_on_target=_safe(away_stats, "sot"),
        home_possession=round(float(_safe(home_stats, "possession_pct", 50.0)), 1),
        away_possession=round(float(_safe(away_stats, "possession_pct", 50.0)), 1),
        home_passes=_safe(home_stats, "passes"),
        away_passes=_safe(away_stats, "passes"),
        home_pass_pct=round(100.0 * _safe(home_stats, "passes_completed") /
                            max(_safe(home_stats, "passes"), 1), 1),
        away_pass_pct=round(100.0 * _safe(away_stats, "passes_completed") /
                            max(_safe(away_stats, "passes"), 1), 1),
        home_corners=_safe(home_stats, "corners"),
        away_corners=_safe(away_stats, "corners"),
        home_fouls=_safe(home_stats, "fouls"),
        away_fouls=_safe(away_stats, "fouls"),
    )

    # ── Lineups ────────────────────────────────────────────────────────────────
    lineup_rows = await conn.fetch("""
        SELECT DISTINCT ON (player_id, team_id)
               player_id, player_name, team_id, position, formation
        FROM events_raw
        WHERE match_id = $1 AND player_id IS NOT NULL AND position IS NOT NULL
        ORDER BY player_id, team_id, time_min ASC
    """, match_id)

    def _build_lineup(team_id: str) -> list[LineupPlayer]:
        players = [r for r in lineup_rows if r["team_id"] == team_id]
        result = []
        sub_minutes = {r["player_off"]: r.minute for r in subs if r.team_id == team_id}
        for p in players:
            result.append(LineupPlayer(
                player_id=p["player_id"],
                player_name=p["player_name"],
                position=p["position"],
                is_starter=True,
                sub_off_minute=sub_minutes.get(p["player_name"]),
            ))
        return result

    response = MatchDetail(
        match_id=match_row["match_id"],
        week=match_row["week"],
        local_date=match_row["local_date"],
        local_time=match_row["local_time"],
        home_team_id=match_row["home_team_id"],
        home_team_name=match_row["home_team_name"],
        away_team_id=match_row["away_team_id"],
        away_team_name=match_row["away_team_name"],
        home_goals=match_row["home_goals"] or 0,
        away_goals=match_row["away_goals"] or 0,
        home_xg=float(match_row["home_xg"]) if match_row["home_xg"] else None,
        away_xg=float(match_row["away_xg"]) if match_row["away_xg"] else None,
        home_formation=match_row["home_formation"],
        away_formation=match_row["away_formation"],
        venue_name=match_row["venue_name"],
        attendance=match_row["attendance"],
        status=match_row["status"],
        facts=MatchFacts(goals=goals, cards=cards, substitutions=subs),
        stats=match_stats,
        home_lineup=_build_lineup(match_row["home_team_id"]),
        away_lineup=_build_lineup(match_row["away_team_id"]),
    )

    ttl = SHOTS_TTL if match_row["status"] == "completed" else 300
    cache.set(cache_key, response, ttl=ttl)
    return response


@router.get("/matches/{match_id}/shots", response_model=ShotsResponse)
async def get_match_shots(
    match_id: str,
    period: Optional[Literal["1", "2", "all"]] = Query(default="all"),
    team: Optional[Literal["home", "away", "all"]] = Query(default="all"),
    conn: asyncpg.Connection = Depends(get_db),
):
    cache_key = f"shots:{match_id}:{period}:{team}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    query = """
        SELECT id, player_name, team_id, team_position, time_min, period_id,
               x, y, xg_value, shot_outcome,
               (qualifiers->>'Head') AS is_header,
               (qualifiers->>'Penalty') AS is_penalty,
               zone
        FROM events_raw
        WHERE match_id = $1
          AND macro_category = 'shot'
    """
    params: list = [match_id]

    if period and period != "all":
        query += f" AND period_id = ${len(params)+1}"
        params.append(int(period))

    if team and team != "all":
        query += f" AND team_position = ${len(params)+1}"
        params.append(team)

    query += " ORDER BY time_min"

    rows = await conn.fetch(query, *params)

    # Fetch match row to determine which team is home
    match_row = await conn.fetchrow(
        "SELECT home_team_id FROM matches WHERE match_id = $1", match_id
    )
    home_team_id = match_row["home_team_id"] if match_row else None

    shots = [
        ShotData(
            id=r["id"],
            player_name=r["player_name"] or "Unknown",
            team_id=r["team_id"],
            is_home=r["team_id"] == home_team_id,
            minute=r["time_min"],
            period=r["period_id"],
            x=float(r["x"]) if r["x"] is not None else 50.0,
            y=float(r["y"]) if r["y"] is not None else 50.0,
            xg=float(r["xg_value"]) if r["xg_value"] else None,
            outcome=r["shot_outcome"] or "miss",
            is_header=r["is_header"] == "Si",
            is_penalty=r["is_penalty"] == "Si",
            zone=r["zone"],
        )
        for r in rows
    ]

    response = ShotsResponse(match_id=match_id, shots=shots)
    cache.set(cache_key, response, ttl=SHOTS_TTL)
    return response


@router.get("/matches/{match_id}/xg-flow", response_model=XGFlowResponse)
async def get_xg_flow(
    match_id: str,
    conn: asyncpg.Connection = Depends(get_db),
):
    """Returns cumulative xG by minute for both teams. Pro endpoint."""
    cache_key = f"xg_flow:{match_id}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    match_row = await conn.fetchrow("""
        SELECT home_team_id, home_team_name, away_team_id, away_team_name
        FROM matches WHERE match_id = $1
    """, match_id)

    if not match_row:
        raise HTTPException(status_code=404, detail="Match not found")

    shot_rows = await conn.fetch("""
        SELECT team_id, time_min, xg_value, event
        FROM events_raw
        WHERE match_id = $1 AND macro_category = 'shot' AND xg_value IS NOT NULL
        ORDER BY time_min
    """, match_id)

    home_id = match_row["home_team_id"]
    away_id = match_row["away_team_id"]

    # Build cumulative xG by minute (0–90+)
    def build_flow(team_id: str) -> tuple[list[XGPoint], list[XGGoal]]:
        team_shots = [r for r in shot_rows if r["team_id"] == team_id]
        points: list[XGPoint] = [XGPoint(minute=0, cumulative_xg=0.0)]
        goals: list[XGGoal] = []
        cumulative = 0.0

        for shot in team_shots:
            cumulative += float(shot["xg_value"])
            minute = shot["time_min"]
            points.append(XGPoint(minute=minute, cumulative_xg=round(cumulative, 3)))
            if shot["event"] == "Goal":
                goals.append(XGGoal(team_id=team_id, minute=minute,
                                    xg_at_time=round(float(shot["xg_value"]), 3)))

        # Add final point at 90 min
        if points[-1].minute < 90:
            points.append(XGPoint(minute=90, cumulative_xg=round(cumulative, 3)))

        return points, goals

    home_points, home_goals = build_flow(home_id)
    away_points, away_goals = build_flow(away_id)

    response = XGFlowResponse(
        match_id=match_id,
        home_team_id=home_id,
        away_team_id=away_id,
        home_team_name=match_row["home_team_name"],
        away_team_name=match_row["away_team_name"],
        home_xg_by_minute=home_points,
        away_xg_by_minute=away_points,
        goals=home_goals + away_goals,
    )

    cache.set(cache_key, response, ttl=SHOTS_TTL)
    return response


@router.get("/matches/{match_id}/tactical", response_model=TacticalResponse)
async def get_tactical(
    match_id: str,
    conn: asyncpg.Connection = Depends(get_db),
):
    """Pro: PPDA, defensive height, box entries for this match."""
    cache_key = f"tactical:{match_id}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    rows = await conn.fetch("""
        SELECT team_id, is_home, ppda, defensive_height,
               progressive_passes, box_entries
        FROM team_match_stats
        WHERE match_id = $1
    """, match_id)

    if not rows:
        raise HTTPException(status_code=404, detail="Match tactical data not found")

    home_row = next((r for r in rows if r["is_home"]), None)
    away_row = next((r for r in rows if not r["is_home"]), None)

    def _f(row, col):
        return float(row[col]) if row and row[col] else None
    def _i(row, col):
        return int(row[col]) if row and row[col] else 0

    response = TacticalResponse(
        home_ppda=_f(home_row, "ppda"),
        away_ppda=_f(away_row, "ppda"),
        home_def_height=_f(home_row, "defensive_height"),
        away_def_height=_f(away_row, "defensive_height"),
        home_progressive_passes=_i(home_row, "progressive_passes"),
        away_progressive_passes=_i(away_row, "progressive_passes"),
        home_box_entries=_i(home_row, "box_entries"),
        away_box_entries=_i(away_row, "box_entries"),
    )

    cache.set(cache_key, response, ttl=SHOTS_TTL)
    return response

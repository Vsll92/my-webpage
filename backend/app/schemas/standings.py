from pydantic import BaseModel
from typing import Optional
from .common import MatchResult


class StandingRow(BaseModel):
    position: int
    team_id: str
    team_name: str
    played: int
    won: int
    drawn: int
    lost: int
    goals_for: int
    goals_against: int
    goal_diff: int
    points: int
    form: list[MatchResult]       # last 5 results
    # Pro fields
    xg_for: Optional[float] = None
    xg_against: Optional[float] = None
    xg_diff: Optional[float] = None
    xg_delta: Optional[float] = None   # goals - xG (over/under performance)


class StandingsResponse(BaseModel):
    season: str
    competition_id: str
    rows: list[StandingRow]

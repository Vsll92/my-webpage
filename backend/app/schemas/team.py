from pydantic import BaseModel
from typing import Optional
from .common import MatchResult
from .match import FormEntry


class TeamOverview(BaseModel):
    team_id: str
    team_name: str
    season: str
    league_position: int
    played: int
    won: int
    drawn: int
    lost: int
    goals_for: int
    goals_against: int
    points: int
    # Pro fields
    xg_for: Optional[float] = None
    xg_against: Optional[float] = None
    xg_delta: Optional[float] = None
    shots_per90: Optional[float] = None
    ppda: Optional[float] = None
    def_action_height: Optional[float] = None
    possession_avg: Optional[float] = None
    form: list[FormEntry] = []
    top_scorers: list[dict] = []


class TeamSummary(BaseModel):
    team_id: str
    team_name: str
    team_code: Optional[str] = None
    league_position: Optional[int] = None
    form: list[MatchResult] = []

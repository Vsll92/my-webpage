from pydantic import BaseModel
from typing import Optional, Literal
from .common import MatchResult, ShotOutcome


class FormEntry(BaseModel):
    match_id: str
    date: str
    opponent_name: str
    result: MatchResult
    goals_for: int
    goals_against: int
    xg: Optional[float] = None
    xga: Optional[float] = None
    is_home: bool


class MatchSummary(BaseModel):
    match_id: str
    week: int
    local_date: str
    local_time: Optional[str] = None
    home_team_id: str
    home_team_name: str
    away_team_id: str
    away_team_name: str
    home_goals: Optional[int] = None
    away_goals: Optional[int] = None
    home_xg: Optional[float] = None
    away_xg: Optional[float] = None
    status: Literal["upcoming", "completed", "postponed", "live"]
    home_form: list[MatchResult] = []
    away_form: list[MatchResult] = []
    # Optional Pro context for fixture cards
    match_badge: Optional[str] = None   # "Comfortable", "Fortunate", "Upset", etc.


class GoalEvent(BaseModel):
    player_name: str
    team_id: str
    minute: int
    period: int
    is_penalty: bool = False
    is_own_goal: bool = False


class CardEvent(BaseModel):
    player_name: str
    team_id: str
    minute: int
    card_type: Literal["yellow", "second_yellow", "red"]


class SubEvent(BaseModel):
    player_off: str
    player_on: str
    team_id: str
    minute: int
    reason: Literal["tactical", "injury", "unknown"]


class MatchFacts(BaseModel):
    goals: list[GoalEvent]
    cards: list[CardEvent]
    substitutions: list[SubEvent]


class MatchStats(BaseModel):
    home_shots: int
    away_shots: int
    home_shots_on_target: int
    away_shots_on_target: int
    home_possession: float
    away_possession: float
    home_passes: int
    away_passes: int
    home_pass_pct: Optional[float] = None
    away_pass_pct: Optional[float] = None
    home_corners: int
    away_corners: int
    home_fouls: int
    away_fouls: int
    home_ppda: Optional[float] = None
    away_ppda: Optional[float] = None
    home_def_height: Optional[float] = None
    away_def_height: Optional[float] = None
    home_progressive_passes: Optional[int] = None
    away_progressive_passes: Optional[int] = None
    home_box_entries: Optional[int] = None
    away_box_entries: Optional[int] = None


class LineupPlayer(BaseModel):
    player_id: str
    player_name: str
    position: Optional[str] = None
    jersey_number: Optional[int] = None
    is_starter: bool
    sub_on_minute: Optional[int] = None
    sub_off_minute: Optional[int] = None


class MatchDetail(BaseModel):
    match_id: str
    week: int
    local_date: str
    local_time: Optional[str] = None
    home_team_id: str
    home_team_name: str
    away_team_id: str
    away_team_name: str
    home_goals: int
    away_goals: int
    home_xg: Optional[float] = None
    away_xg: Optional[float] = None
    home_formation: Optional[str] = None
    away_formation: Optional[str] = None
    venue_name: Optional[str] = None
    attendance: Optional[int] = None
    status: str
    facts: MatchFacts
    stats: MatchStats
    home_lineup: list[LineupPlayer] = []
    away_lineup: list[LineupPlayer] = []


class ShotData(BaseModel):
    id: int
    player_name: str
    team_id: str
    is_home: bool
    minute: int
    period: int
    x: float
    y: float
    xg: Optional[float] = None
    outcome: ShotOutcome
    is_header: bool = False
    is_penalty: bool = False
    zone: Optional[str] = None


class ShotsResponse(BaseModel):
    match_id: str
    shots: list[ShotData]


class XGPoint(BaseModel):
    minute: int
    cumulative_xg: float


class XGGoal(BaseModel):
    team_id: str
    minute: int
    xg_at_time: float


class XGFlowResponse(BaseModel):
    match_id: str
    home_team_id: str
    away_team_id: str
    home_team_name: str
    away_team_name: str
    home_xg_by_minute: list[XGPoint]
    away_xg_by_minute: list[XGPoint]
    goals: list[XGGoal]


class TacticalResponse(BaseModel):
    home_ppda: Optional[float]
    away_ppda: Optional[float]
    home_def_height: Optional[float]
    away_def_height: Optional[float]
    home_progressive_passes: int
    away_progressive_passes: int
    home_box_entries: int
    away_box_entries: int

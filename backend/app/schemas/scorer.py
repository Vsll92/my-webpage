from pydantic import BaseModel
from typing import Optional


class ScorerRow(BaseModel):
    rank: int
    player_id: str
    player_name: str
    team_id: str
    team_name: str
    position: Optional[str] = None
    matches: int
    minutes: int
    goals: int
    assists: int
    shots: int
    shots_on_target: int
    shots_per90: Optional[float] = None
    # Pro fields
    xg: Optional[float] = None
    npxg: Optional[float] = None
    xg_per_shot: Optional[float] = None
    goals_above_xg: Optional[float] = None
    big_chances: Optional[int] = None


class ScorersResponse(BaseModel):
    season: str
    rows: list[ScorerRow]

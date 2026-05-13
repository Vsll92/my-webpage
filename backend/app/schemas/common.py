"""
Shared Pydantic types used across all API response schemas.
"""
from typing import Literal
from pydantic import BaseModel

MatchResult = Literal["W", "D", "L"]
ShotOutcome = Literal["goal", "saved", "miss", "blocked"]
TeamPosition = Literal["home", "away"]

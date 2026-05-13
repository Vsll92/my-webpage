"""
Health check endpoint.

Used by Railway/Vercel deployment health checks and for local verification
that the database connection is live.
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.database import check_connection

logger = logging.getLogger(__name__)
router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: str                    # "ok" | "degraded"
    timestamp: str
    database: bool
    version: str = "0.1.0"
    environment: str = "development"


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Returns 200 if the API and database are operational.
    Returns 503 if the database is unreachable.

    Used by:
    - Railway deployment health probes
    - Sprint 0 acceptance checklist verification
    - Monitoring scripts
    """
    from app.config import settings

    db_ok = await check_connection()

    response = HealthResponse(
        status="ok" if db_ok else "degraded",
        timestamp=datetime.now(timezone.utc).isoformat(),
        database=db_ok,
        version="0.1.0",
        environment=settings.ENVIRONMENT,
    )

    if not db_ok:
        logger.warning("Health check: database unreachable")
        raise HTTPException(
            status_code=503,
            detail=response.model_dump(),
        )

    return response


@router.get("/health/ping")
async def ping():
    """Lightweight ping — no DB check. Used for uptime probes."""
    return {"pong": True}

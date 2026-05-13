"""
Pressing Room — FastAPI application entry point.

Sprint 0: health check, CORS, GZip, lifespan pool management.
Routers for data pages are added from Sprint 1 onwards.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.config import settings
from app.database import create_pool, close_pool


# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=settings.LOG_LEVEL.upper(),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup: open DB pool.
    Shutdown: close DB pool.
    FastAPI calls this automatically.
    """
    logger.info("Starting Pressing Room API (environment=%s)", settings.ENVIRONMENT)
    await create_pool()
    yield
    logger.info("Shutting down Pressing Room API")
    await close_pool()


# ── Application ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="Pressing Room API",
    description="Football analytics API — France Ligue 1",
    version="0.1.0",
    # Disable docs in production to reduce attack surface
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    lifespan=lifespan,
)

# ── Middleware (order matters: outermost runs first) ──────────────────────────
# 1. GZip — compress responses > 1KB
app.add_middleware(GZipMiddleware, minimum_size=1000)

# 2. CORS — must come after GZip in the stack
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET"],           # Read-only API in V1
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
from app.routers import (
    health,
    standings,
    fixtures,
    scorers,
    teams,
    matches,
    homepage,
)

app.include_router(health.router,    prefix="/api")
app.include_router(homepage.router,  prefix="/api")
app.include_router(fixtures.router,  prefix="/api")
app.include_router(standings.router, prefix="/api")
app.include_router(scorers.router,   prefix="/api")
app.include_router(teams.router,     prefix="/api")
app.include_router(matches.router,   prefix="/api")

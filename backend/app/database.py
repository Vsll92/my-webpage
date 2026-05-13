"""
Async PostgreSQL connection pool using asyncpg.

Usage:
  - Call create_pool() in the app lifespan startup.
  - Call close_pool() in the app lifespan shutdown.
  - Use get_db() as a FastAPI dependency in route handlers.
  - Use get_raw_conn() for pipeline scripts that run outside FastAPI.
"""
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import asyncpg

from app.config import settings

logger = logging.getLogger(__name__)

# Global pool — initialized once at startup
_pool: asyncpg.Pool | None = None


async def create_pool() -> None:
    """Create the connection pool. Called once at application startup."""
    global _pool
    if _pool is not None:
        logger.warning("Pool already exists — skipping creation")
        return

    logger.info("Creating database connection pool...")
    _pool = await asyncpg.create_pool(
        dsn=settings.DATABASE_URL,
        min_size=2,
        max_size=10,
        command_timeout=30,
        # Register custom type codecs if needed later
    )
    logger.info("Database pool created successfully")


async def close_pool() -> None:
    """Close the connection pool. Called once at application shutdown."""
    global _pool
    if _pool is None:
        return
    await _pool.close()
    _pool = None
    logger.info("Database pool closed")


def get_pool() -> asyncpg.Pool:
    """Return the pool, raising if not yet initialized."""
    if _pool is None:
        raise RuntimeError(
            "Database pool is not initialized. "
            "Ensure create_pool() was called in the app lifespan."
        )
    return _pool


async def get_db() -> AsyncGenerator[asyncpg.Connection, None]:
    """
    FastAPI dependency: yields a checked-out connection from the pool.

    Usage in a route:
        async def my_route(conn: asyncpg.Connection = Depends(get_db)):
            row = await conn.fetchrow("SELECT 1")
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        yield conn


@asynccontextmanager
async def get_raw_conn():
    """
    Context manager for pipeline scripts running outside FastAPI.
    Creates a temporary pool if the global one isn't initialized.

    Usage:
        async with get_raw_conn() as conn:
            await conn.execute("INSERT INTO ...")
    """
    if _pool is not None:
        async with _pool.acquire() as conn:
            yield conn
    else:
        # One-off connection for pipeline scripts
        conn = await asyncpg.connect(dsn=settings.DATABASE_URL)
        try:
            yield conn
        finally:
            await conn.close()


async def check_connection() -> bool:
    """Health check: verify the pool can actually reach the database."""
    try:
        pool = get_pool()
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        return True
    except Exception as exc:
        logger.error("Database health check failed: %s", exc)
        return False

"""
In-process TTL cache for API responses.

No Redis in Sprint 0. A simple dict with expiry timestamps is sufficient
for a single-process deployment. Replace with Redis in V1.1 if needed.

Thread safety: asyncio is single-threaded, so dict operations are safe
within a single uvicorn worker. If you scale to multiple workers later,
move to Redis.
"""
import time
import logging
from typing import Any

logger = logging.getLogger(__name__)


class TTLCache:
    """
    Simple in-process TTL cache.

    Keys expire after `ttl` seconds. Expired entries are evicted lazily
    (on next access or on explicit invalidation calls).
    """

    def __init__(self) -> None:
        # { key: (value, expiry_timestamp) }
        self._store: dict[str, tuple[Any, float]] = {}

    def get(self, key: str) -> Any | None:
        """Return the cached value, or None if missing or expired."""
        if key not in self._store:
            return None
        value, expiry = self._store[key]
        if time.time() >= expiry:
            del self._store[key]
            return None
        return value

    def set(self, key: str, value: Any, ttl: int) -> None:
        """Store a value with a TTL in seconds."""
        self._store[key] = (value, time.time() + ttl)

    def delete(self, key: str) -> None:
        """Explicitly remove a key."""
        self._store.pop(key, None)

    def invalidate_prefix(self, prefix: str) -> int:
        """Remove all keys that start with `prefix`. Returns count removed."""
        keys_to_remove = [k for k in self._store if k.startswith(prefix)]
        for k in keys_to_remove:
            del self._store[k]
        if keys_to_remove:
            logger.debug("Cache invalidated %d keys with prefix '%s'", len(keys_to_remove), prefix)
        return len(keys_to_remove)

    def clear(self) -> None:
        """Wipe the entire cache."""
        self._store.clear()

    @property
    def size(self) -> int:
        """Current number of cached entries (including expired ones not yet evicted)."""
        return len(self._store)


# Module-level singleton — import this everywhere
cache = TTLCache()

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import diskcache

_CACHE_DIR = Path.home() / ".cache" / "skyroute" / "searches"
_DEFAULT_TTL = 3600  # 1 hour

_cache: diskcache.Cache | None = None


def _get_cache() -> diskcache.Cache:
    global _cache
    if _cache is None:
        _cache = diskcache.Cache(str(_CACHE_DIR))
    return _cache


def cache_key(origin: str, dest: str, date: str, **params: Any) -> str:
    parts = f"{origin}-{dest}-{date}"
    if params:
        parts += "-" + json.dumps(params, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(parts.encode()).hexdigest()[:16]


def get(key: str) -> Any | None:
    return _get_cache().get(key)


def put(key: str, value: Any, ttl: int = _DEFAULT_TTL) -> None:
    _get_cache().set(key, value, expire=ttl)


def clear() -> None:
    c = _get_cache()
    c.clear()


def stats() -> dict[str, Any]:
    c = _get_cache()
    return {
        "size": len(c),
        "directory": str(_CACHE_DIR),
        "volume": c.volume(),
    }

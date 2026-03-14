from __future__ import annotations

import hashlib
import json
import threading
import time
from pathlib import Path
from typing import Any

_CACHE_DIR = Path.home() / ".cache" / "opensky" / "searches"
_LEGACY_CACHE_DIR = Path.home() / ".cache" / "skyroute" / "searches"
_DEFAULT_TTL = 3600  # 1 hour

_cache_lock = threading.Lock()


def _ensure_cache_dir() -> None:
    if not _CACHE_DIR.exists() and _LEGACY_CACHE_DIR.exists():
        _CACHE_DIR.parent.mkdir(parents=True, exist_ok=True)
        try:
            _LEGACY_CACHE_DIR.replace(_CACHE_DIR)
        except Exception:
            _CACHE_DIR.mkdir(parents=True, exist_ok=True)
            for legacy_file in _LEGACY_CACHE_DIR.glob("*.json"):
                target = _CACHE_DIR / legacy_file.name
                if not target.exists():
                    target.write_text(legacy_file.read_text())
    _CACHE_DIR.mkdir(parents=True, exist_ok=True)
    try:
        _CACHE_DIR.chmod(0o700)
    except Exception:
        # Best-effort; skip on restricted filesystems
        pass


def cache_key(origin: str, dest: str, date: str, **params: Any) -> str:
    parts = f"{origin}-{dest}-{date}"
    if params:
        parts += "-" + json.dumps(params, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(parts.encode()).hexdigest()[:16]


def _serialize(value: Any) -> Any:
    try:
        from opensky.models import FlightResult, RoundTripResult
    except Exception:
        return value

    if isinstance(value, list) and value:
        if all(isinstance(v, FlightResult) for v in value):
            return {"__type__": "FlightResultList", "items": [v.model_dump() for v in value]}
        if all(isinstance(v, RoundTripResult) for v in value):
            return {"__type__": "RoundTripResultList", "items": [v.model_dump() for v in value]}
    return value


def _deserialize(value: Any) -> Any:
    if isinstance(value, dict):
        if value.get("__type__") == "FlightResultList":
            try:
                from opensky.models import FlightResult
            except Exception:
                return value
            return [FlightResult.model_validate(v) for v in value.get("items", [])]
        if value.get("__type__") == "RoundTripResultList":
            try:
                from opensky.models import RoundTripResult
            except Exception:
                return value
            return [RoundTripResult.model_validate(v) for v in value.get("items", [])]
    return value


def get(key: str) -> Any | None:
    _ensure_cache_dir()
    path = _CACHE_DIR / f"{key}.json"
    if not path.exists():
        return None
    with _cache_lock:
        try:
            data = json.loads(path.read_text())
            expires_at = data.get("expires_at")
            if expires_at and time.time() > expires_at:
                path.unlink(missing_ok=True)
                return None
            return _deserialize(data.get("value"))
        except Exception:
            path.unlink(missing_ok=True)
            return None


def put(key: str, value: Any, ttl: int = _DEFAULT_TTL) -> None:
    _ensure_cache_dir()
    payload = {
        "expires_at": time.time() + ttl,
        "value": _serialize(value),
    }
    path = _CACHE_DIR / f"{key}.json"
    tmp = _CACHE_DIR / f"{key}.json.tmp"
    with _cache_lock:
        tmp.write_text(json.dumps(payload))
        tmp.replace(path)


def age_seconds(key: str) -> int | None:
    """Return seconds since this cache entry was written, or None if not cached/expired."""
    path = _CACHE_DIR / f"{key}.json"
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text())
        expires_at = data.get("expires_at")
        if not expires_at:
            return None
        age = int(_DEFAULT_TTL - (expires_at - time.time()))
        if age < 0:
            return None  # entry expired
        return age
    except Exception:
        return None


def clear() -> None:
    _ensure_cache_dir()
    with _cache_lock:
        for p in _CACHE_DIR.glob("*.json"):
            p.unlink(missing_ok=True)


def stats() -> dict[str, Any]:
    _ensure_cache_dir()
    files = list(_CACHE_DIR.glob("*.json"))
    return {
        "size": len(files),
        "directory": str(_CACHE_DIR),
        "volume": sum(p.stat().st_size for p in files),
    }

from opensky import cache


def test_cache_key_deterministic():
    k1 = cache.cache_key("BLR", "HAM", "2026-03-10", seat="ECONOMY")
    k2 = cache.cache_key("BLR", "HAM", "2026-03-10", seat="ECONOMY")
    assert k1 == k2


def test_cache_key_differs_by_params():
    k1 = cache.cache_key("BLR", "HAM", "2026-03-10", seat="ECONOMY")
    k2 = cache.cache_key("BLR", "HAM", "2026-03-10", seat="BUSINESS")
    assert k1 != k2


def test_cache_key_differs_by_route():
    k1 = cache.cache_key("BLR", "HAM", "2026-03-10")
    k2 = cache.cache_key("DEL", "HAM", "2026-03-10")
    assert k1 != k2


def test_put_get_cycle():
    key = cache.cache_key("TEST", "TEST", "9999-01-01", test=True)
    cache.put(key, [{"price": 100}])
    result = cache.get(key)
    assert result == [{"price": 100}]

    # Clean up
    cache.put(key, None, ttl=0)


def test_get_missing_key():
    result = cache.get("nonexistent_key_xyz_123")
    assert result is None


def test_legacy_cache_directory_migrates(monkeypatch, tmp_path):
    new_dir = tmp_path / ".cache" / "opensky" / "searches"
    legacy_dir = tmp_path / ".cache" / "skyroute" / "searches"
    monkeypatch.setattr(cache, "_CACHE_DIR", new_dir)
    monkeypatch.setattr(cache, "_LEGACY_CACHE_DIR", legacy_dir)

    legacy_dir.mkdir(parents=True, exist_ok=True)
    key = "legacy-key"
    (legacy_dir / f"{key}.json").write_text('{"expires_at":9999999999,"value":{"price":123}}')

    result = cache.get(key)
    assert result == {"price": 123}
    assert (new_dir / f"{key}.json").exists()

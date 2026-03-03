from skyroute import cache


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

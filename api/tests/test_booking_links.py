from main import _booking_link


def test_booking_link_marks_safe_provider_url_as_exact_booking() -> None:
    url, label, exact = _booking_link(
        "https://provider.example/booking/123",
        "DEL",
        "NBO",
        "2026-03-21",
        "EUR",
        "economy",
        "",
    )

    assert url == "https://provider.example/booking/123"
    assert label == "Book"
    assert exact is True


def test_booking_link_falls_back_to_marketplace_search_when_provider_url_missing() -> None:
    url, label, exact = _booking_link(
        "",
        "DEL",
        "NBO",
        "2026-03-21",
        "EUR",
        "economy",
        "",
    )

    assert url.startswith("https://www.skyscanner.net/transport/flights/del/nbo/260321/")
    assert "currency=EUR" in url
    assert label == "Compare on Skyscanner"
    assert exact is False

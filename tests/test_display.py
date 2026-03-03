from skyroute.display import format_duration, format_price


def test_format_duration():
    assert format_duration(90) == "1h 30m"
    assert format_duration(60) == "1h"
    assert format_duration(45) == "0h 45m"
    assert format_duration(0) == "0h"
    assert format_duration(885) == "14h 45m"


def test_format_price():
    assert format_price(357, "EUR") == "\u20ac357"
    assert format_price(1407, "EUR") == "\u20ac1,407"
    assert format_price(0, "EUR") == "N/A"
    assert format_price(416, "USD") == "$416"
    assert format_price(299, "GBP") == "\u00a3299"
    assert format_price(25000, "INR") == "\u20b925,000"
    assert format_price(100, "CHF") == "CHF 100"

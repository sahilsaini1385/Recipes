#!/usr/bin/env python3
"""Regression tests for the article extractor. No network required.

Run: python3 scripts/test_fetch_article.py

Guards the failure that motivated this design: a client-rendered page whose
readable HTML is only navigation, with the real article inside a JSON state
blob. Extracting tags alone "succeeds" and returns menus — so the itinerary
gets built from junk. These tests pin both halves: the article must be found
in the JSON blob, and a page with no article at all must score too low to use.
"""

import sys

from fetch_article import MIN_PROSE_CHARS, extract, prose_score

NAV = """
<nav><a>Destinations</a><a>Places to Stay</a><a>News &amp; Advice</a>
<a>Subscribe</a><a>Newsletters</a><a>Contact the Editors</a></nav>
<footer><p>Careers</p><p>User Agreement</p><p>Privacy Policy</p>
<p>Ad Choices</p><p>Select international site</p></footer>
"""

ARTICLE_SENTENCES = " ".join(
    f"Stop {i} is a lovely spot in the old town where the pastries are warm "
    f"and the coffee is strong enough to justify the walk uphill."
    for i in range(12)
)


def build_state_page() -> str:
    """Article text only inside __NEXT_DATA__, like a Next.js publisher."""
    import json

    state = {
        "props": {
            "article": {
                "hed": "Two Days in Testville",
                "body": [
                    {"props": {"name": "Café Alpha",
                               "shortDescription": ARTICLE_SENTENCES}},
                    {"props": {"name": "Museo Beta",
                               "dangerousDek": f"<p>{ARTICLE_SENTENCES}</p>"}},
                ],
            },
            "footer": {"text": "Subscribe to our newsletter for more."},
        }
    }
    return (
        "<html><head><title>Two Days in Testville</title></head><body>"
        + NAV
        + '<script id="__NEXT_DATA__" type="application/json">'
        + json.dumps(state)
        + "</script></body></html>"
    )


def test_json_state_beats_navigation():
    text, strategy, score = extract(build_state_page())
    assert "Café Alpha" in text, "venue name from JSON state was dropped"
    assert "Museo Beta" in text, "venue name in HTML-ish field was dropped"
    assert "embedded JSON" in strategy, f"expected JSON strategy, got {strategy}"
    assert score >= MIN_PROSE_CHARS, f"prose score {score} below usable threshold"
    print(f"  ok: JSON-state page -> {strategy} (prose {score})")


def test_nav_only_page_is_rejected():
    _, _, score = extract(f"<html><body>{NAV}</body></html>")
    assert score < MIN_PROSE_CHARS, (
        f"navigation-only page scored {score}; it must fall below "
        f"{MIN_PROSE_CHARS} so the skill asks the user to paste instead"
    )
    print(f"  ok: nav-only page rejected (prose {score})")


def test_plain_article_still_works():
    """No regression for ordinary server-rendered blogs."""
    html = f"<html><body>{NAV}<article><p>{ARTICLE_SENTENCES}</p></article></body></html>"
    text, strategy, score = extract(html)
    assert "old town" in text
    assert score >= MIN_PROSE_CHARS
    print(f"  ok: server-rendered page -> {strategy} (prose {score})")


def test_prose_score_ignores_menus():
    menu = "\n".join(["Destinations", "Subscribe", "Contact", "Careers"])
    assert prose_score(menu) == 0, "menu lines must not count as prose"
    print("  ok: menu lines score zero")


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    print(f"Running {len(tests)} extractor tests...")
    failures = 0
    for test in tests:
        try:
            test()
        except AssertionError as exc:
            failures += 1
            print(f"  FAIL {test.__name__}: {exc}")
    print("All passed." if not failures else f"{failures} failed.")
    sys.exit(1 if failures else 0)

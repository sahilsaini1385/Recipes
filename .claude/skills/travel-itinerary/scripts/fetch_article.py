#!/usr/bin/env python3
"""Fetch a travel article's text for itinerary extraction.

Fetches the URL with browser-like headers (many travel publishers block
obvious bots), prefers the full `articleBody` that publishers embed in
JSON-LD (frequently present even on paywalled pages), and falls back to
stripped page text. Stdlib only.

Usage: fetch_article.py <url> [-o article.txt]

Exit codes: 0 success; 2 fetch failed; 3 fetched but too little article text
(page is probably JS-rendered or hard-paywalled — ask the user to paste it).
"""

import argparse
import html
import json
import re
import sys
import urllib.error
import urllib.request

MAX_CHARS = 80_000
MIN_BODY_CHARS = 500

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
}


def jsonld_article_body(src: str) -> str:
    """Longest articleBody found in the page's JSON-LD blocks, if any."""
    best = ""

    def walk(node):
        nonlocal best
        if isinstance(node, dict):
            body = node.get("articleBody")
            if isinstance(body, str) and len(body) > len(best):
                best = body
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    pattern = r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>'
    for match in re.finditer(pattern, src, re.S | re.I):
        try:
            walk(json.loads(match.group(1)))
        except (json.JSONDecodeError, ValueError):
            continue
    return html.unescape(best)


def strip_html(src: str) -> str:
    src = re.sub(
        r"<(script|style|noscript|template|svg|iframe|head)[\s\S]*?</\1>",
        " ",
        src,
        flags=re.I,
    )
    src = re.sub(r"<!--[\s\S]*?-->", " ", src)
    src = re.sub(r"<(br|/p|/div|/li|/h[1-6]|/section|/article)[^>]*>", "\n", src, flags=re.I)
    src = re.sub(r"<[^>]+>", " ", src)
    src = html.unescape(src)
    src = re.sub(r"[ \t]+", " ", src)
    src = re.sub(r"\s*\n\s*", "\n", src)
    return src.strip()


def page_title(src: str) -> str:
    match = re.search(
        r'<meta[^>]*property=["\']og:title["\'][^>]*content=["\']([^"\']+)', src, re.I
    ) or re.search(r"<title[^>]*>([\s\S]*?)</title>", src, re.I)
    return html.unescape(match.group(1)).strip() if match else ""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("url")
    parser.add_argument("-o", "--output", default="article.txt")
    args = parser.parse_args()

    request = urllib.request.Request(args.url, headers=HEADERS)
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            raw = response.read(4_000_000)
    except (urllib.error.URLError, OSError, ValueError) as exc:
        print(f"FETCH FAILED: {exc}", file=sys.stderr)
        return 2

    src = raw.decode("utf-8", errors="replace")
    title = page_title(src)
    ld_body = jsonld_article_body(src)
    stripped = strip_html(src)
    # JSON-LD is clean article text; prefer it unless the rendered page has
    # substantially more (some sites embed only a teaser in JSON-LD).
    body = ld_body if len(ld_body) > max(800, 0.3 * len(stripped)) else stripped

    if len(body) < MIN_BODY_CHARS:
        print(
            f"TOO LITTLE TEXT ({len(body)} chars) — page is likely JS-rendered "
            "or paywalled. Ask the user to paste the article text.",
            file=sys.stderr,
        )
        return 3

    text = f"{title}\n\n{body}"[:MAX_CHARS]
    with open(args.output, "w", encoding="utf-8") as fh:
        fh.write(text)
    print(f"Saved {len(text)} chars to {args.output} (title: {title or 'n/a'})")
    return 0


if __name__ == "__main__":
    sys.exit(main())

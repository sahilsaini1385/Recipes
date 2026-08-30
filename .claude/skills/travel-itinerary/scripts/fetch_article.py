#!/usr/bin/env python3
"""Fetch a travel article's text for itinerary extraction.

Modern publishers (Condé Nast Traveler, and anything built on Next.js/Nuxt)
render the article client-side: the readable HTML is mostly navigation, and
the real text sits in a JSON state blob inside a <script> tag. Stripping
tags alone therefore "succeeds" while returning menus and footers — the
worst failure, because the itinerary then gets built from junk. So this
script tries several extraction strategies, scores each by how much actual
prose it yields, and refuses to return boilerplate.

Strategies, best-scoring wins:
  1. JSON-LD articleBody
  2. Embedded JSON state (__PRELOADED_STATE__, __NEXT_DATA__, __NUXT__,
     application/json), preferring the article subtree
  3. <article> / <main> element text
  4. Whole-page stripped text

If the live page is blocked or yields nothing usable, it retries against the
Wayback Machine's archived copy (public archive, no auth) unless --no-archive.

Usage: fetch_article.py <url> [-o article.txt] [--no-archive] [--quiet]

Exit codes: 0 success; 2 fetch failed; 3 fetched but no usable article text
(ask the user to paste the text — do not guess the article's contents).
"""

import argparse
import html
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

MAX_CHARS = 80_000
MIN_PROSE_CHARS = 800

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
}

# Keys whose string values are article content even when short (venue names,
# section headings) — recall matters, a dropped name is a dropped pin.
CONTENT_KEYS = {
    "hed", "dek", "dangerousdek", "dangeroushed", "name", "title", "heading",
    "subhed", "description", "shortdescription", "longdescription", "caption",
    "text", "body", "content", "articlebody", "excerpt", "summary",
}
# Subtrees that are never the article (site chrome, styling, recirculation).
SKIP_KEYS = {
    "recirc", "recircs", "related", "relatedvideo", "relatedaudio",
    "recommendations", "newsletter", "footer", "nav", "navigation", "header",
    "headerprops", "promo", "ads", "advertisement", "seo", "meta", "design",
    "stylesheet", "styles", "theme", "sctheme", "assets", "fonts",
    "typography", "config", "featureflags", "env", "locale", "tracking",
    "analytics", "socialmedia", "breadcrumb", "componentconfig", "renditions",
}
ARTICLE_KEYS = {"article", "story", "post", "entry", "maincontent", "content", "body"}
CSS_HINTS = ("minmax(", "1fr", "max-content", "repeat(", "@font-face", "grid-template", "var(--")


def strip_tags(text: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", text))).strip()


def is_junk(s: str) -> bool:
    """Reject CSS, markup, asset paths, alt-text and component-name tokens."""
    if any(h in s for h in CSS_HINTS):
        return True
    if s.count('"') >= 2:  # CSS grid-area token lists
        return True
    if s.startswith("Image may contain"):
        return True
    if re.match(r"^\s*[<{@]|^https?://|^data:|^[\w./-]+\.(js|css|png|jpe?g|svg|woff2?)\b", s):
        return True
    if s.count("{") + s.count(";") > 2:
        return True
    # bare tag / component / slug tokens: "div", "toc-header", "inline-embed"
    if len(s) < 20 and re.match(r"^[a-z][a-z0-9-]*$", s):
        return True
    letters = sum(c.isalpha() for c in s)
    return letters / max(len(s), 1) < 0.5


def harvest(node, key="", out=None, seen=None):
    """Collect content-bearing strings from a decoded JSON tree, in order."""
    if out is None:
        out, seen = [], set()
    if isinstance(node, dict):
        for k, v in node.items():
            if k.lower() not in SKIP_KEYS:
                harvest(v, k, out, seen)
    elif isinstance(node, list):
        for v in node:
            harvest(v, key, out, seen)
    elif isinstance(node, str):
        txt = strip_tags(node)
        if txt and not is_junk(txt):
            keyed = key.lower() in CONTENT_KEYS and 2 <= len(txt) <= 6000
            prose = len(txt) >= 25 and txt.count(" ") >= 3
            if keyed or prose:
                norm = txt.lower()
                if norm not in seen:
                    seen.add(norm)
                    out.append(txt)
    return out


def find_article_subtrees(node, out=None):
    if out is None:
        out = []
    if isinstance(node, dict):
        for k, v in node.items():
            if k.lower() in ARTICLE_KEYS and isinstance(v, (dict, list)):
                out.append(v)
            if k.lower() not in SKIP_KEYS:
                find_article_subtrees(v, out)
    elif isinstance(node, list):
        for v in node:
            find_article_subtrees(v, out)
    return out


def json_blobs(src: str) -> list:
    blobs = []
    patterns = [
        r"window\.__PRELOADED_STATE__\s*=\s*(\{.*?\})\s*;?\s*</script>",
        r'<script[^>]*id=["\']__NEXT_DATA__["\'][^>]*>(\{.*?\})</script>',
        r"window\.__NUXT__\s*=\s*(\{.*?\})\s*;?\s*</script>",
        r'<script[^>]*type=["\']application/(?:ld\+)?json["\'][^>]*>(\{.*?\}|\[.*?\])</script>',
    ]
    for pattern in patterns:
        for match in re.finditer(pattern, src, re.S | re.I):
            try:
                blobs.append(json.loads(match.group(1)))
            except (json.JSONDecodeError, ValueError):
                continue
    return blobs


def jsonld_article_body(blobs: list) -> str:
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

    for blob in blobs:
        walk(blob)
    return html.unescape(best)


def strip_page(src: str) -> str:
    src = re.sub(r"<(script|style|noscript|template|svg|iframe|head)[\s\S]*?</\1>", " ", src, flags=re.I)
    src = re.sub(r"<!--[\s\S]*?-->", " ", src)
    src = re.sub(r"<(br|/p|/div|/li|/h[1-6]|/section|/article)[^>]*>", "\n", src, flags=re.I)
    src = html.unescape(re.sub(r"<[^>]+>", " ", src))
    return re.sub(r"\s*\n\s*", "\n", re.sub(r"[ \t]+", " ", src)).strip()


def main_element(src: str) -> str:
    for pattern in (r"<article[^>]*>([\s\S]*?)</article>", r"<main[^>]*>([\s\S]*?)</main>"):
        matches = re.findall(pattern, src, re.I)
        if matches:
            return strip_page(max(matches, key=len))
    return ""


def prose_score(text: str) -> int:
    """Chars living in sentence-like lines — navigation and menus score ~0."""
    total = 0
    for line in text.splitlines():
        line = line.strip()
        if line.count(" ") >= 7 and re.search(r"[.!?][\"')\]]?$", line):
            total += len(line)
    return total


def page_title(src: str) -> str:
    match = re.search(
        r'<meta[^>]*property=["\']og:title["\'][^>]*content=["\']([^"\']+)', src, re.I
    ) or re.search(r"<title[^>]*>([\s\S]*?)</title>", src, re.I)
    return html.unescape(match.group(1)).strip() if match else ""


def extract(src: str):
    """Return (text, strategy, prose_score) for the best-scoring strategy."""
    blobs = json_blobs(src)
    candidates = [("json-ld articleBody", jsonld_article_body(blobs))]

    subtrees = []
    for blob in blobs:
        subtrees.extend(find_article_subtrees(blob))
    sub_texts = ["\n".join(harvest(s)) for s in subtrees]
    if sub_texts:
        candidates.append(("embedded JSON (article subtree)", max(sub_texts, key=len)))
    if blobs:
        candidates.append(("embedded JSON (whole state)", "\n".join(sum((harvest(b) for b in blobs), []))))
    candidates.append(("<article>/<main> text", main_element(src)))
    candidates.append(("stripped page text", strip_page(src)))

    scored = [(prose_score(t), name, t) for name, t in candidates if t]
    if not scored:
        return "", "none", 0
    score, name, text = max(scored, key=lambda c: c[0])
    return text, name, score


def fetch(url: str) -> str:
    request = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=25) as response:
        return response.read(6_000_000).decode("utf-8", errors="replace")


def wayback_url(url: str):
    api = "https://archive.org/wayback/available?url=" + urllib.parse.quote(url, safe="")
    try:
        with urllib.request.urlopen(urllib.request.Request(api, headers=HEADERS), timeout=20) as response:
            data = json.load(response)
        snapshot = data.get("archived_snapshots", {}).get("closest", {})
        if not snapshot.get("available"):
            return None
        # The API hands back http:// URLs; https is preferred and some
        # networks block plain http outright.
        return re.sub(r"^http://", "https://", snapshot.get("url", ""))
    except (urllib.error.URLError, OSError, ValueError):
        return None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("url")
    parser.add_argument("-o", "--output", default="article.txt")
    parser.add_argument("--no-archive", action="store_true",
                        help="skip the Wayback Machine fallback")
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()

    attempts = []  # (label, html)
    try:
        attempts.append(("live page", fetch(args.url)))
    except (urllib.error.URLError, OSError, ValueError) as exc:
        print(f"live fetch failed: {exc}", file=sys.stderr)

    best = ("", "none", 0, "")
    for label, src in attempts:
        text, strategy, score = extract(src)
        if score > best[2]:
            best = (text, strategy, score, label)

    if best[2] < MIN_PROSE_CHARS and not args.no_archive:
        snapshot = wayback_url(args.url)
        if snapshot:
            if not args.quiet:
                print(f"live page thin; trying archived copy: {snapshot}", file=sys.stderr)
            for candidate in (snapshot, re.sub(r"^https://", "http://", snapshot)):
                try:
                    src = fetch(candidate)
                except (urllib.error.URLError, OSError, ValueError) as exc:
                    print(f"archive fetch failed: {exc}", file=sys.stderr)
                    continue
                text, strategy, score = extract(src)
                if score > best[2]:
                    best = (text, strategy, score, "wayback archive")
                    attempts.append(("wayback archive", src))
                break

    text, strategy, score, source = best
    if not attempts:
        print("FETCH FAILED: the site could not be reached.", file=sys.stderr)
        return 2
    if score < MIN_PROSE_CHARS:
        print(
            f"NO USABLE ARTICLE TEXT (best: {strategy} via {source}, "
            f"{score} chars of prose — below {MIN_PROSE_CHARS}).\n"
            "The page is probably paywalled or fully client-rendered. Ask the "
            "user to paste the article text; do not guess its contents.",
            file=sys.stderr,
        )
        return 3

    title = page_title(attempts[0][1])
    out = f"{title}\n\n{text}"[:MAX_CHARS]
    with open(args.output, "w", encoding="utf-8") as fh:
        fh.write(out)
    if not args.quiet:
        print(f"Saved {len(out)} chars to {args.output}")
        print(f"  source: {source} | strategy: {strategy} | prose score: {score}")
        print(f"  title: {title or 'n/a'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

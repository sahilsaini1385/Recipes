#!/usr/bin/env python3
"""Build a Google My Maps-ready KML file from an itinerary JSON.

Usage: build_kml.py itinerary.json output.kml [--allow-wide]

--allow-wide skips the ~200km-spread check for trips that genuinely cover a
region (road trips, multi-town or multi-city itineraries). Leave it off
otherwise — the check exists to catch wrong-city coordinates.

Validates the itinerary first and refuses to emit obviously broken data
(missing days, out-of-range or 0,0 coordinates, stops scattered across the
globe). One KML <Folder> per day — Google My Maps imports each folder as a
toggleable layer — with numbered, day-colored pins whose descriptions carry
the article's notes, tips, and a name+address Google Maps link.

Stdlib only. Exit codes: 0 success, 1 validation error.
"""

import json
import sys
import urllib.parse
from xml.sax.saxutils import escape

# Day pin colors (CSS hex). KML wants aabbggrr, converted below.
DAY_COLORS = ["#0f766e", "#b45309", "#6d28d9", "#be185d", "#1d4ed8", "#4d7c0f"]

KINDS = {
    "sight", "museum", "restaurant", "cafe", "bakery", "bar",
    "hotel", "shop", "activity", "neighborhood", "viewpoint", "other",
}
TIMES = {"morning", "afternoon", "evening", "flexible"}


def kml_color(css_hex: str) -> str:
    h = css_hex.lstrip("#")
    return f"ff{h[4:6]}{h[2:4]}{h[0:2]}".lower()


def gmaps_url(stop: dict, destination: str) -> str:
    if stop.get("address"):
        query = f"{stop['name']}, {stop['address']}"
    elif stop.get("area"):
        query = f"{stop['name']}, {stop['area']}, {destination}"
    else:
        query = f"{stop['name']}, {destination}"
    return "https://www.google.com/maps/search/?api=1&query=" + urllib.parse.quote(query)


def validate(it: dict, allow_wide: bool = False) -> list:
    errors = []
    for key in ("title", "destination", "days"):
        if not it.get(key):
            errors.append(f"missing or empty '{key}'")
    coords = []
    for day in it.get("days", []):
        label = f"day {day.get('day', '?')}"
        if not day.get("stops"):
            errors.append(f"{label} has no stops")
        for stop in day.get("stops", []):
            name = stop.get("name") or "?"
            if not stop.get("name"):
                errors.append(f"{label}: stop with no name")
            lat, lng = stop.get("lat"), stop.get("lng")
            if not isinstance(lat, (int, float)) or not isinstance(lng, (int, float)):
                errors.append(f"{label} '{name}': lat/lng missing or not numbers")
                continue
            if not (-90 <= lat <= 90 and -180 <= lng <= 180) or (lat == 0 and lng == 0):
                errors.append(f"{label} '{name}': implausible coordinates {lat},{lng}")
                continue
            coords.append((lat, lng, name))
            if stop.get("kind") not in KINDS:
                errors.append(f"{label} '{name}': unknown kind {stop.get('kind')!r}")
            if stop.get("time_of_day") not in TIMES:
                errors.append(f"{label} '{name}': unknown time_of_day {stop.get('time_of_day')!r}")
    # All stops should be one destination; a >2° spread means a wrong-city pin
    # (unless the caller declared a wide trip with --allow-wide).
    if not allow_wide and len(coords) >= 2:
        lats = [c[0] for c in coords]
        lngs = [c[1] for c in coords]
        if max(lats) - min(lats) > 2 or max(lngs) - min(lngs) > 2:
            outlier = max(
                coords,
                key=lambda c: abs(c[0] - sorted(lats)[len(lats) // 2])
                + abs(c[1] - sorted(lngs)[len(lngs) // 2]),
            )
            errors.append(
                f"stops span more than ~200km — check '{outlier[2]}' at "
                f"{outlier[0]},{outlier[1]} (wrong city? for a genuine road "
                "trip or multi-city itinerary, rerun with --allow-wide)"
            )
    return errors


def build(it: dict) -> str:
    days = it["days"]
    styles = []
    for i in range(len(days)):
        styles.append(
            f'    <Style id="day{i + 1}">\n'
            "      <IconStyle>\n"
            f"        <color>{kml_color(DAY_COLORS[i % len(DAY_COLORS)])}</color>\n"
            "        <Icon><href>https://maps.google.com/mapfiles/kml/paddle/wht-blank.png</href></Icon>\n"
            "      </IconStyle>\n"
            "      <LabelStyle><scale>0.9</scale></LabelStyle>\n"
            "    </Style>"
        )

    folders = []
    for i, day in enumerate(days):
        placemarks = []
        for j, stop in enumerate(day["stops"]):
            header = stop["kind"].upper()
            if stop.get("time_of_day") and stop["time_of_day"] != "flexible":
                header += f" · {stop['time_of_day']}"
            lines = [header, stop.get("description", "")]
            if stop.get("tip"):
                lines.append(f"Tip: {stop['tip']}")
            if stop.get("address") or stop.get("area"):
                lines.append(stop.get("address") or stop.get("area"))
            if stop.get("approx"):
                lines.append("(pin is approximate — use the link below to navigate)")
            lines.append(f"Google Maps: {gmaps_url(stop, it['destination'])}")
            description = "\n\n".join(line for line in lines if line)
            numbered_name = "{}. {}".format(j + 1, stop["name"])
            placemarks.append(
                "      <Placemark>\n"
                f"        <name>{escape(numbered_name)}</name>\n"
                f"        <description><![CDATA[{description}]]></description>\n"
                f"        <styleUrl>#day{i + 1}</styleUrl>\n"
                f"        <Point><coordinates>{stop['lng']},{stop['lat']},0</coordinates></Point>\n"
                "      </Placemark>"
            )
        folder_name = escape(f"Day {day.get('day', i + 1)}: {day.get('title', '')}".rstrip(": "))
        folders.append(
            "    <Folder>\n"
            f"      <name>{folder_name}</name>\n" + "\n".join(placemarks) + "\n    </Folder>"
        )

    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<kml xmlns="http://www.opengis.net/kml/2.2">\n'
        "  <Document>\n"
        f"    <name>{escape(it['title'])}</name>\n"
        f"    <description>{escape(it.get('summary', ''))}</description>\n"
        + "\n".join(styles)
        + "\n"
        + "\n".join(folders)
        + "\n  </Document>\n</kml>\n"
    )


def main() -> int:
    args = [a for a in sys.argv[1:] if a != "--allow-wide"]
    allow_wide = "--allow-wide" in sys.argv[1:]
    if len(args) != 2:
        print(__doc__, file=sys.stderr)
        return 1
    with open(args[0], encoding="utf-8") as fh:
        itinerary = json.load(fh)
    errors = validate(itinerary, allow_wide=allow_wide)
    if errors:
        print("VALIDATION FAILED:", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        return 1
    kml = build(itinerary)
    with open(sys.argv[2], "w", encoding="utf-8") as fh:
        fh.write(kml)
    stops = sum(len(d["stops"]) for d in itinerary["days"])
    print(f"Wrote {sys.argv[2]}: {len(itinerary['days'])} day layers, {stops} pins.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

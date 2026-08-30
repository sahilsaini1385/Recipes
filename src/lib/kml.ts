import type { ItineraryData } from "./types";
import { dayColor } from "./types";
import { placeSearchUrl } from "./gmaps";

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// KML colors are aabbggrr (alpha, blue, green, red) — reversed from CSS hex.
export function cssHexToKmlColor(hex: string): string {
  const h = hex.replace("#", "");
  const r = h.slice(0, 2);
  const g = h.slice(2, 4);
  const b = h.slice(4, 6);
  return `ff${b}${g}${r}`.toLowerCase();
}

/**
 * Builds a KML document that Google My Maps imports directly
 * (mymaps.google.com → Create a new map → Import). One folder per day —
 * My Maps turns each folder into a toggleable layer — with numbered,
 * day-colored pins and the article's notes in each pin's description.
 */
export function buildKml(itinerary: ItineraryData): string {
  const styles = itinerary.days
    .map((_, i) => {
      const kml = cssHexToKmlColor(dayColor(i));
      return `    <Style id="day${i + 1}">
      <IconStyle>
        <color>${kml}</color>
        <Icon><href>https://maps.google.com/mapfiles/kml/paddle/wht-blank.png</href></Icon>
      </IconStyle>
      <LabelStyle><scale>0.9</scale></LabelStyle>
    </Style>`;
    })
    .join("\n");

  const folders = itinerary.days
    .map((day, i) => {
      const placemarks = day.stops
        .map((stop, j) => {
          const lines = [
            stop.kind.toUpperCase() +
              (stop.time_of_day !== "flexible" ? ` · ${stop.time_of_day}` : ""),
            stop.description,
            stop.tip ? `Tip: ${stop.tip}` : "",
            stop.address || stop.area,
            `Google Maps: ${placeSearchUrl(stop, itinerary.destination)}`,
          ].filter(Boolean);
          return `      <Placemark>
        <name>${esc(`${j + 1}. ${stop.name}`)}</name>
        <description><![CDATA[${lines.join("\n\n")}]]></description>
        <styleUrl>#day${i + 1}</styleUrl>
        <Point><coordinates>${stop.lng},${stop.lat},0</coordinates></Point>
      </Placemark>`;
        })
        .join("\n");
      return `    <Folder>
      <name>${esc(`Day ${day.day}: ${day.title}`)}</name>
${placemarks}
    </Folder>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${esc(itinerary.title)}</name>
    <description>${esc(itinerary.summary)}</description>
${styles}
${folders}
  </Document>
</kml>
`;
}

export function downloadKml(itinerary: ItineraryData, filename: string): void {
  const blob = new Blob([buildKml(itinerary)], {
    type: "application/vnd.google-earth.kml+xml",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".kml") ? filename : `${filename}.kml`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

import { describe, expect, it } from "vitest";
import { buildKml, cssHexToKmlColor } from "./kml";
import { sampleItinerary } from "./sampleParis";

describe("cssHexToKmlColor", () => {
  it("reverses css rgb into kml aabbggrr", () => {
    expect(cssHexToKmlColor("#0f766e")).toBe("ff6e760f");
    expect(cssHexToKmlColor("#b45309")).toBe("ff0953b4");
  });
});

describe("buildKml", () => {
  const kml = buildKml(sampleItinerary.data);

  it("is a kml document with one folder per day", () => {
    expect(kml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(kml).toContain("<kml xmlns=");
    const folders = kml.match(/<Folder>/g) ?? [];
    expect(folders.length).toBe(sampleItinerary.data.days.length);
  });

  it("numbers stops and places coordinates as lng,lat", () => {
    expect(kml).toContain("1. Café de Flore");
    // Café de Flore: lat 48.8541, lng 2.3326 → KML wants lng,lat
    expect(kml).toContain("<coordinates>2.3326,48.8541,0</coordinates>");
  });

  it("escapes XML special characters in names", () => {
    const data = structuredClone(sampleItinerary.data);
    data.days[0].stops[0].name = 'Fish & Chips <"best">';
    const out = buildKml(data);
    expect(out).toContain("1. Fish &amp; Chips &lt;&quot;best&quot;&gt;");
    expect(out).not.toContain('Fish & Chips <"best">');
  });

  it("carries tips into placemark descriptions", () => {
    expect(kml).toContain("Tip: Go before 9am");
  });
});

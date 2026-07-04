import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { extractDocxText, extractZipEntries } from "./extractDocs";
import { dedupeDrafts, normalizeTitle } from "./dedupe";
import type { RecipeDraft } from "./types";

async function makeDocx(paragraphs: string[]): Promise<ArrayBuffer> {
  const zip = new JSZip();
  const body = paragraphs
    .map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`)
    .join("");
  zip.file(
    "word/document.xml",
    `<?xml version="1.0"?><w:document><w:body>${body}</w:body></w:document>`
  );
  return zip.generateAsync({ type: "arraybuffer" });
}

describe("extractDocxText", () => {
  it("pulls paragraphs out of a .docx", async () => {
    const buf = await makeDocx([
      "Chili",
      "1 pound ground beef",
      "Brown the beef.",
    ]);
    const text = await extractDocxText(buf);
    expect(text).toContain("Chili");
    expect(text).toContain("1 pound ground beef");
    expect(text.split("\n").length).toBeGreaterThanOrEqual(3);
  });
});

describe("extractZipEntries", () => {
  it("walks a zip, extracting docx text and skipping junk", async () => {
    const inner = await makeDocx(["Cookies", "2 cups flour", "Bake them."]);
    const zip = new JSZip();
    zip.file("Cookies.docx", inner);
    zip.file("__MACOSX/._Cookies.docx", "junk");
    zip.file("notes.xyz", "not a recipe format");
    const buf = await zip.generateAsync({ type: "arraybuffer" });

    const { entries, skipped } = await extractZipEntries(buf);
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("Cookies.docx");
    expect(entries[0].text).toContain("2 cups flour");
    expect(skipped).toContain("notes.xyz");
  });

  it("passes PDFs through as base64 for the model", async () => {
    const zip = new JSZip();
    zip.file("Pie.pdf", new Uint8Array([37, 80, 68, 70])); // %PDF
    const buf = await zip.generateAsync({ type: "arraybuffer" });
    const { entries } = await extractZipEntries(buf);
    expect(entries[0].file?.media_type).toBe("application/pdf");
    expect(entries[0].file?.data.length).toBeGreaterThan(0);
  });
});

describe("dedupe", () => {
  const draft = (title: string, nIngredients: number): RecipeDraft => ({
    title,
    category: "Entrees",
    credit: "",
    source_url: null,
    base_servings: 4,
    servings_estimated: true,
    ingredients: Array.from({ length: nIngredients }, (_, i) => ({
      raw: `item ${i}`,
      quantity: 1,
      quantity_max: null,
      unit: null,
      item: `item ${i}`,
      note: "",
      scalable: true,
    })),
    steps: ["do it"],
    tags: [],
    notes: null,
    photo_path: null,
  });

  it("normalizes Copy of / (1) / extension variants to one title", () => {
    expect(normalizeTitle("Copy of Chili (1).docx")).toBe("chili");
    expect(normalizeTitle("Chili.doc")).toBe("chili");
    expect(normalizeTitle("CHILI")).toBe("chili");
  });

  it("keeps the most complete duplicate", () => {
    const items = [
      { draft: draft("Copy of Chili", 3) },
      { draft: draft("Chili.docx", 6) },
      { draft: draft("Brownies", 4) },
    ];
    const result = dedupeDrafts(items);
    expect(result).toHaveLength(2);
    const chili = result.find(
      (i) => normalizeTitle(i.draft.title) === "chili"
    );
    expect(chili?.draft.ingredients).toHaveLength(6);
  });
});

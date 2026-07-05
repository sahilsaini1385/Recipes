import JSZip from "jszip";

/**
 * Client-side extraction of recipe sources from files the LLM can't ingest
 * directly: .docx (zip of XML), legacy .doc (binary salvage), .txt, and .zip
 * archives containing any mix of the above plus PDFs and images.
 */

export interface ExtractedEntry {
  /** Original file name, for progress display and de-dup hints. */
  name: string;
  /** Plain text extracted client-side (docx/doc/txt). */
  text?: string;
  /** Base64 payload for formats the model reads natively (pdf/images). */
  file?: { data: string; media_type: string };
}

const IMAGE_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};

function extension(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
}

/** Pull readable text out of a .docx (which is a zip containing XML). */
export async function extractDocxText(buf: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const doc = zip.file("word/document.xml");
  if (!doc) throw new Error("Not a Word document");
  const xml = await doc.async("string");
  return decodeXmlEntities(
    xml
      .replace(/<w:tab[^>]*\/>/g, "\t")
      .replace(/<w:br[^>]*\/>/g, "\n")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Legacy binary .doc files: salvage readable character runs. The result is
 * noisy, but the LLM parser is good at pulling a clean recipe out of noise.
 */
export function extractDocTextCrude(buf: ArrayBuffer): string {
  const candidates: string[] = [];
  for (const encoding of ["utf-16le", "latin1"]) {
    try {
      const decoded = new TextDecoder(encoding).decode(buf);
      const runs = decoded.match(/[\x20-\x7E -ɏ\n\r\t]{12,}/g) ?? [];
      candidates.push(runs.join("\n"));
    } catch {
      // encoding unsupported — skip
    }
  }
  const best = candidates.sort((a, b) => b.length - a.length)[0] ?? "";
  return best.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Turn one file (by name + bytes) into an importable entry, or null. */
export async function entryFromBytes(
  name: string,
  buf: ArrayBuffer
): Promise<ExtractedEntry | null> {
  const ext = extension(name);
  if (ext === "docx") {
    const text = await extractDocxText(buf);
    return text.length > 20 ? { name, text } : null;
  }
  if (ext === "doc") {
    const text = extractDocTextCrude(buf);
    return text.length > 40 ? { name, text } : null;
  }
  if (ext === "txt" || ext === "rtf" || ext === "md") {
    const text = new TextDecoder().decode(buf).trim();
    return text.length > 20 ? { name, text } : null;
  }
  if (ext === "pdf") {
    return { name, file: { data: bufToBase64(buf), media_type: "application/pdf" } };
  }
  if (ext in IMAGE_TYPES) {
    return { name, file: { data: bufToBase64(buf), media_type: IMAGE_TYPES[ext] } };
  }
  return null;
}

/** Walk a .zip archive and extract an importable entry per usable file. */
export async function extractZipEntries(
  buf: ArrayBuffer
): Promise<{ entries: ExtractedEntry[]; skipped: string[] }> {
  const zip = await JSZip.loadAsync(buf);
  const entries: ExtractedEntry[] = [];
  const skipped: string[] = [];

  for (const [path, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    const base = path.split("/").pop() ?? path;
    // macOS metadata and hidden files are not recipes.
    if (path.startsWith("__MACOSX/") || base.startsWith(".")) continue;
    try {
      const data = await file.async("arraybuffer");
      const entry = await entryFromBytes(base, data);
      if (entry) entries.push(entry);
      else skipped.push(base);
    } catch {
      skipped.push(base);
    }
  }
  return { entries, skipped };
}

/** Top-level dispatch for whatever the user picked in the file input. */
export async function extractFromFile(
  file: File
): Promise<{ entries: ExtractedEntry[]; skipped: string[] }> {
  const ext = extension(file.name);
  const buf = await file.arrayBuffer();
  if (ext === "zip") return extractZipEntries(buf);
  const entry = await entryFromBytes(file.name, buf);
  return entry
    ? { entries: [entry], skipped: [] }
    : { entries: [], skipped: [file.name] };
}

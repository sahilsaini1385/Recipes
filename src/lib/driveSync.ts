import { supabase } from "./supabase";
import { entryFromBytes, type ExtractedEntry } from "./extractDocs";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  /** Present on files in legacy Drive folders; required to download them. */
  resourceKey?: string;
  /** Subfolder path within the shared folder, e.g. "Dessert". */
  folder?: string;
}

async function invokeDriveSync(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("drive-sync", {
    body,
  });
  if (error) {
    let detail = error.message || "Drive sync failed";
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const payload = await ctx.json();
        if (payload?.error) detail = payload.error;
      } catch {
        // not JSON
      }
    }
    throw new Error(detail);
  }
  return data;
}

/** Files in the Drive folder that were never imported or skipped before. */
export async function listNewDriveFiles(): Promise<DriveFile[]> {
  const data = await invokeDriveSync({ action: "list" });
  const files = (data.files ?? []) as DriveFile[];

  const { data: processed, error } = await supabase
    .from("drive_files")
    .select("file_id");
  if (error) throw new Error(error.message);
  const done = new Set((processed ?? []).map((r) => r.file_id));
  return files.filter((f) => !done.has(f.id));
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/** Download one Drive file and turn it into an importable entry, or null. */
export async function fetchDriveEntry(
  file: DriveFile
): Promise<ExtractedEntry | null> {
  const data = await invokeDriveSync({
    action: "fetch",
    id: file.id,
    mimeType: file.mimeType,
    resourceKey: file.resourceKey,
  });
  let entry: ExtractedEntry | null = null;
  if (typeof data.text === "string") {
    entry =
      data.text.trim().length > 20 ? { name: file.name, text: data.text } : null;
  } else if (typeof data.data === "string") {
    entry = await entryFromBytes(file.name, base64ToArrayBuffer(data.data));
  }
  // The Drive subfolder name doubles as a category hint for the parser.
  if (entry?.text && file.folder) {
    entry = {
      ...entry,
      text: `(This recipe was filed in the folder: ${file.folder})\n\n${entry.text}`,
    };
  }
  return entry;
}

/** Remember the outcome so this file is not offered again next sync. */
export async function markDriveFile(
  fileId: string,
  name: string,
  status: "imported" | "skipped"
): Promise<void> {
  await supabase
    .from("drive_files")
    .upsert({ file_id: fileId, name, status });
}

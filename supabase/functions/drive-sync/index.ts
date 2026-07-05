// Supabase Edge Function: drive-sync
//
// Lists and downloads files from a link-shared Google Drive folder so the
// site can import new recipes from it. Requires two secrets:
//   GOOGLE_API_KEY        — a Google Cloud API key with the Drive API enabled
//   GOOGLE_DRIVE_FOLDER_ID — the folder id, or the folder's full
//                            drive.google.com URL (legacy folders with a
//                            ?resourcekey=... tail are handled automatically)
//
// The folder must be shared as "Anyone with the link can view".
// Only signed-in family members may call this function.

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/**
 * Accepts a bare folder id or a full Drive URL. Legacy folders (pre-2017,
 * ids starting "0B...") carry a resource key that Google requires on every
 * API call via the X-Goog-Drive-Resource-Keys header.
 */
function parseFolderConfig(raw: string): { id: string; resourceKey: string } {
  const trimmed = raw.trim();
  const urlMatch = trimmed.match(/folders\/([a-zA-Z0-9_-]+)/);
  const id = urlMatch ? urlMatch[1] : trimmed.split(/[?#/\s]/)[0];
  const rkMatch = trimmed.match(/resourcekey=([a-zA-Z0-9_-]+)/i);
  return { id, resourceKey: rkMatch?.[1] ?? "" };
}

function resourceKeyHeaders(pairs: Array<[string, string]>): HeadersInit {
  const value = pairs
    .filter(([, key]) => key)
    .map(([id, key]) => `${id}/${key}`)
    .join(",");
  return value ? { "X-Goog-Drive-Resource-Keys": value } : {};
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  // Family members only.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: {
        headers: { Authorization: req.headers.get("Authorization") ?? "" },
      },
    }
  );
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json({ error: "Sign in required" }, 401);
  const { data: isFamily } = await supabase.rpc("is_family");
  if (!isFamily) {
    return json({ error: "Your email is not on the family list" }, 403);
  }

  const apiKey = Deno.env.get("GOOGLE_API_KEY");
  const folderConfig = Deno.env.get("GOOGLE_DRIVE_FOLDER_ID");
  if (!apiKey || !folderConfig) {
    return json(
      {
        error:
          "Drive sync is not configured: set the GOOGLE_API_KEY and GOOGLE_DRIVE_FOLDER_ID secrets in Supabase.",
      },
      500
    );
  }

  const folder = parseFolderConfig(folderConfig);

  let payload: {
    action?: string;
    id?: string;
    mimeType?: string;
    resourceKey?: string;
  };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  try {
    if (payload.action === "list") {
      const files: Array<{ id: string; name: string; mimeType: string }> = [];
      let pageToken = "";
      do {
        const params = new URLSearchParams({
          q: `'${folder.id}' in parents and trashed=false`,
          fields: "nextPageToken,files(id,name,mimeType,resourceKey)",
          pageSize: "200",
          key: apiKey,
        });
        if (pageToken) params.set("pageToken", pageToken);
        const res = await fetch(
          `https://www.googleapis.com/drive/v3/files?${params}`,
          { headers: resourceKeyHeaders([[folder.id, folder.resourceKey]]) }
        );
        if (!res.ok) {
          const detail = await res.text();
          throw new Error(`Drive list failed (${res.status}): ${detail}`);
        }
        const data = await res.json();
        files.push(...(data.files ?? []));
        pageToken = data.nextPageToken ?? "";
      } while (pageToken);
      return json({ files });
    }

    if (payload.action === "fetch") {
      const { id, mimeType } = payload;
      if (!id) return json({ error: "Missing file id" }, 400);
      const headers = resourceKeyHeaders([
        [folder.id, folder.resourceKey],
        [id, payload.resourceKey ?? ""],
      ]);

      // Native Google Docs export as plain text; other Google-app types
      // (Sheets, Slides…) aren't recipes we can parse.
      if (mimeType?.startsWith("application/vnd.google-apps")) {
        if (mimeType !== "application/vnd.google-apps.document") {
          return json({ error: `Unsupported Google file type: ${mimeType}` }, 415);
        }
        const res = await fetch(
          `https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=text/plain&key=${apiKey}`,
          { headers }
        );
        if (!res.ok) {
          throw new Error(`Drive export failed (${res.status})`);
        }
        return json({ text: await res.text() });
      }

      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${id}?alt=media&key=${apiKey}`,
        { headers }
      );
      if (!res.ok) throw new Error(`Drive download failed (${res.status})`);
      const buf = await res.arrayBuffer();
      return json({ data: bufToBase64(buf), media_type: mimeType ?? "" });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("drive-sync failed:", e);
    return json({ error: (e as Error).message }, 502);
  }
});

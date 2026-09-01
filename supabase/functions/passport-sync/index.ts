// Supabase Edge Function: passport-sync
//
// Makes the family Google Sheet the source of truth for the Family Passport.
// Downloads the sheet as an Excel file, reads the "Country List" tab (one
// column per family member) and the state columns on the VACADATA tab
// (headed WRJ / KVJ), then mirrors everything into the family_members,
// country_visits and state_visits tables.
//
// The sheet must be shared as "Anyone with the link can view". The sheet id
// below can be overridden with a PASSPORT_SHEET_ID secret (a bare id or the
// full docs.google.com URL both work).
//
// Only signed-in family members may call this function. Re-running it is
// always safe: it replaces the data for people found in the sheet and leaves
// manually added members alone.

import { createClient } from "npm:@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5";

const DEFAULT_SHEET_ID = "1t-9TeIzCM81zKQFaqTmK7fIxu-hbAr-_8EvUGAG6X-Y";
const COUNTRY_TAB = "Country List";
const STATES_TAB = "VACADATA";

// Whose states are in the VACADATA columns. If the initials belong to
// someone else, change the names here (they must match the Country List
// column headers).
const STATE_COLUMN_OWNERS: Record<string, string> = {
  WRJ: "Will",
  KVJ: "Kathryn",
};

// Old member names that should be treated as the same person as a sheet
// column (the site used to call Will "WR").
const MEMBER_ALIASES: Record<string, string> = {
  wr: "will",
};

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

// ---------------------------------------------------------------------------
// Country name → ISO code mapping. The sheet is free text written over many
// years, so this covers historical names ("Burma", "West Germany"),
// spellings ("Belguim", "Czechslovakia") and territories the family counts
// (Bermuda, Curaçao, Hong Kong).
// ---------------------------------------------------------------------------

const COUNTRY_NAMES: Record<string, string> = {
  AF: "Afghanistan", AL: "Albania", DZ: "Algeria", AD: "Andorra",
  AO: "Angola", AG: "Antigua and Barbuda", AR: "Argentina", AM: "Armenia",
  AU: "Australia", AT: "Austria", AZ: "Azerbaijan", BS: "Bahamas",
  BH: "Bahrain", BD: "Bangladesh", BB: "Barbados", BY: "Belarus",
  BE: "Belgium", BZ: "Belize", BJ: "Benin", BM: "Bermuda", BT: "Bhutan",
  BO: "Bolivia", BA: "Bosnia and Herzegovina", BW: "Botswana", BR: "Brazil",
  BN: "Brunei", BG: "Bulgaria", BF: "Burkina Faso", BI: "Burundi",
  CV: "Cabo Verde", KH: "Cambodia", CM: "Cameroon", CA: "Canada",
  CF: "Central African Republic", TD: "Chad", CL: "Chile", CN: "China",
  CO: "Colombia", KM: "Comoros", CG: "Congo (Republic)", CD: "Congo (DR)",
  CR: "Costa Rica", CI: "Cote d'Ivoire", HR: "Croatia", CU: "Cuba",
  CW: "Curacao", CY: "Cyprus", CZ: "Czechia", DK: "Denmark", DJ: "Djibouti",
  DM: "Dominica", DO: "Dominican Republic", EC: "Ecuador", EG: "Egypt",
  SV: "El Salvador", GQ: "Equatorial Guinea", ER: "Eritrea", EE: "Estonia",
  SZ: "Eswatini", ET: "Ethiopia", FJ: "Fiji", FI: "Finland", FR: "France",
  GA: "Gabon", GM: "Gambia", GE: "Georgia", DE: "Germany", GH: "Ghana",
  GR: "Greece", GD: "Grenada", GT: "Guatemala", GN: "Guinea",
  GW: "Guinea-Bissau", GY: "Guyana", HT: "Haiti", VA: "Vatican City",
  HN: "Honduras", HK: "Hong Kong", HU: "Hungary", IS: "Iceland",
  IN: "India", ID: "Indonesia", IR: "Iran", IQ: "Iraq", IE: "Ireland",
  IL: "Israel", IT: "Italy", JM: "Jamaica", JP: "Japan", JO: "Jordan",
  KZ: "Kazakhstan", KE: "Kenya", KI: "Kiribati", XK: "Kosovo", KW: "Kuwait",
  KG: "Kyrgyzstan", LA: "Laos", LV: "Latvia", LB: "Lebanon", LS: "Lesotho",
  LR: "Liberia", LY: "Libya", LI: "Liechtenstein", LT: "Lithuania",
  LU: "Luxembourg", MO: "Macau", MG: "Madagascar", MW: "Malawi",
  MY: "Malaysia", MV: "Maldives", ML: "Mali", MT: "Malta",
  MH: "Marshall Islands", MR: "Mauritania", MU: "Mauritius", MX: "Mexico",
  FM: "Micronesia", MD: "Moldova", MC: "Monaco", MN: "Mongolia",
  ME: "Montenegro", MA: "Morocco", MZ: "Mozambique", MM: "Myanmar",
  NA: "Namibia", NR: "Nauru", NP: "Nepal", NL: "Netherlands",
  NZ: "New Zealand", NI: "Nicaragua", NE: "Niger", NG: "Nigeria",
  KP: "North Korea", MK: "North Macedonia", NO: "Norway", OM: "Oman",
  PK: "Pakistan", PW: "Palau", PS: "Palestine", PA: "Panama",
  PG: "Papua New Guinea", PY: "Paraguay", PE: "Peru", PH: "Philippines",
  PL: "Poland", PT: "Portugal", PR: "Puerto Rico", QA: "Qatar",
  RO: "Romania", RU: "Russia", RW: "Rwanda", KN: "Saint Kitts and Nevis",
  LC: "Saint Lucia", VC: "Saint Vincent and the Grenadines", WS: "Samoa",
  SM: "San Marino", ST: "Sao Tome and Principe", SA: "Saudi Arabia",
  SN: "Senegal", RS: "Serbia", SC: "Seychelles", SL: "Sierra Leone",
  SG: "Singapore", SK: "Slovakia", SI: "Slovenia", SB: "Solomon Islands",
  SO: "Somalia", ZA: "South Africa", KR: "South Korea", SS: "South Sudan",
  ES: "Spain", LK: "Sri Lanka", SD: "Sudan", SR: "Suriname", SE: "Sweden",
  CH: "Switzerland", SY: "Syria", TW: "Taiwan", TJ: "Tajikistan",
  TZ: "Tanzania", TH: "Thailand", TL: "Timor-Leste", TG: "Togo",
  TO: "Tonga", TT: "Trinidad and Tobago", TN: "Tunisia", TR: "Turkey",
  TM: "Turkmenistan", TV: "Tuvalu", UG: "Uganda", UA: "Ukraine",
  AE: "United Arab Emirates", GB: "United Kingdom", US: "United States",
  // The family counts the UK's constituent countries separately, the way
  // the Google Sheet lists them.
  "GB-ENG": "England", "GB-SCT": "Scotland", "GB-WLS": "Wales",
  "GB-NIR": "Northern Ireland",
  UY: "Uruguay", UZ: "Uzbekistan", VU: "Vanuatu", VE: "Venezuela",
  VN: "Vietnam", YE: "Yemen", ZM: "Zambia", ZW: "Zimbabwe",
};

const COUNTRY_ALIASES: Record<string, string> = {
  "usa": "US", "us": "US", "america": "US", "united states of america": "US",
  "england": "GB-ENG", "scotland": "GB-SCT", "wales": "GB-WLS",
  "northern ireland": "GB-NIR", "n ireland": "GB-NIR", "ulster": "GB-NIR",
  "great britain": "GB", "uk": "GB", "britain": "GB", "united kingdom": "GB",
  "west germany": "DE", "east germany": "DE",
  "czechoslovakia": "CZ", "czechslovakia": "CZ", "czech republic": "CZ",
  "czech rep": "CZ",
  "yugoslavia": "RS",
  "ussr": "RU", "soviet union": "RU",
  "belguim": "BE",
  "burma": "MM",
  "swaziland": "SZ",
  "vatican": "VA", "vatican city": "VA", "holy see": "VA",
  "hong kong": "HK", "china (hong kong)": "HK",
  "macao": "MO",
  "curacao": "CW", "netherland antilles": "CW", "netherlands antilles": "CW",
  "netherland antilles (curacao)": "CW", "netherlands antilles (curacao)": "CW",
  "dem rep of congo": "CD", "democratic republic of the congo": "CD",
  "drc": "CD", "congo (dr)": "CD", "congo": "CG",
  "st lucia": "LC", "saint lucia": "LC",
  "st vincent and grenadines": "VC", "st vincent and the grenadines": "VC",
  "saint vincent and the grenadines": "VC",
  "st kitts and nevis": "KN", "saint kitts and nevis": "KN",
  "uae": "AE", "united arab emirates": "AE",
  "south korea": "KR", "korea": "KR", "north korea": "KP",
  "ivory coast": "CI", "cote d'ivoire": "CI",
  "cape verde": "CV",
  "east timor": "TL",
  "tahiti": "PF", "french polynesia": "PF",
  "bali": "ID", "bali (indonesia)": "ID",
  "myanmar (burma)": "MM",
  "turkiye": "TR",
};

/** Lowercase, drop quotes/periods, & → and, squash spaces. */
function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/["“”.]/g, "")
    .replace(/&/g, "and")
    .replace(/\s+/g, " ")
    .replace(/^the /, "")
    .trim();
}

const NAME_TO_CODE = new Map<string, string>();
for (const [code, name] of Object.entries(COUNTRY_NAMES)) {
  NAME_TO_CODE.set(normalizeName(name), code);
}
for (const [alias, code] of Object.entries(COUNTRY_ALIASES)) {
  NAME_TO_CODE.set(normalizeName(alias), code);
}

const MONTHS = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];

/**
 * Entries like "Greece in Apr 2027" are planned trips, not completed ones.
 * Returns true when the entry carries a date that is still in the future —
 * once that date passes, the next sync starts counting it automatically.
 */
function isFutureDated(entry: string): boolean {
  const yearMatch = entry.match(/\b(20\d{2})\b/);
  if (!yearMatch) return false;
  const year = Number(yearMatch[1]);
  const now = new Date();
  if (year > now.getFullYear()) return true;
  if (year < now.getFullYear()) return false;
  const monthMatch = entry.toLowerCase().match(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/
  );
  if (!monthMatch) return false;
  return MONTHS.indexOf(monthMatch[1]) > now.getMonth();
}

/** Map one sheet entry to an ISO country code, or null if unrecognized. */
function countryCodeFor(entry: string): string | null {
  // Drop any date phrase ("Greece in Apr 2027" → "Greece").
  const undated = entry
    .replace(/\b(in\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s*20\d{2}\b/gi, "")
    .replace(/\b20\d{2}\b/g, "")
    .trim();
  const norm = normalizeName(undated);
  if (!norm) return null;
  const direct = NAME_TO_CODE.get(norm);
  if (direct) return direct;
  // "Netherland Antilles (Curacao)" → try without, then with only, the parens.
  const withoutParens = normalizeName(undated.replace(/\(.*?\)/g, ""));
  if (NAME_TO_CODE.has(withoutParens)) return NAME_TO_CODE.get(withoutParens)!;
  const parens = undated.match(/\(([^)]+)\)/);
  if (parens) {
    const inner = NAME_TO_CODE.get(normalizeName(parens[1]));
    if (inner) return inner;
  }
  return null;
}

// ---------------------------------------------------------------------------
// US states. The sheet uses a few non-USPS abbreviations.
// ---------------------------------------------------------------------------

const STATE_CODES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID",
  "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS",
  "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK",
  "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV",
  "WI", "WY",
]);

const STATE_ALIASES: Record<string, string> = {
  ARK: "AR", DL: "DE", MASS: "MA", KN: "KS", NB: "NE", CAL: "CA",
  CALIF: "CA", CONN: "CT", FLA: "FL", TEX: "TX", WASH: "WA", WISC: "WI",
  MICH: "MI", MINN: "MN", PENN: "PA", TENN: "TN",
};

function stateCodeFor(raw: string): string | null {
  const up = raw.toUpperCase().replace(/[.\s]/g, "");
  if (STATE_CODES.has(up)) return up;
  if (STATE_ALIASES[up]) return STATE_ALIASES[up];
  return null;
}

// ---------------------------------------------------------------------------
// Sheet parsing
// ---------------------------------------------------------------------------

type Grid = string[][];

function sheetToGrid(ws: XLSX.WorkSheet): Grid {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: "",
  });
  return rows.map((r) => r.map((c) => String(c ?? "").trim()));
}

/** How many blank rows end a person's list (scratch work sits below). */
const MAX_BLANK_RUN = 3;

/** Country List: header row of names, then one country per cell below. */
function parseCountryTab(grid: Grid): {
  people: Array<{ name: string; codes: string[] }>;
  unmatched: string[];
  excluded: string[];
} {
  let headerRow = -1;
  for (let i = 0; i < Math.min(grid.length, 10); i++) {
    const nonEmpty = grid[i].slice(1).filter((c) => c && !/\d/.test(c));
    if (nonEmpty.length >= 3) {
      headerRow = i;
      break;
    }
  }
  if (headerRow === -1) throw new Error(`No header row found in "${COUNTRY_TAB}"`);

  const people: Array<{ name: string; codes: string[] }> = [];
  const unmatched: string[] = [];
  const excluded: string[] = [];

  for (let col = 1; col < grid[headerRow].length; col++) {
    const name = grid[headerRow][col]
      .replace(/^countries visited\s*/i, "")
      .trim();
    if (!name) continue;
    const codes = new Set<string>();
    // Each person's list is one unbroken block under the header. The family
    // also keeps scratch work (tally columns, comparison lists) far below
    // it, so a run of blank rows ends the list.
    let blankRun = 0;
    for (let row = headerRow + 1; row < grid.length; row++) {
      const entry = (grid[row] ?? [])[col];
      if (!entry) {
        if (++blankRun >= MAX_BLANK_RUN) break;
        continue;
      }
      blankRun = 0;
      // Tally marks and stray figures aren't places.
      if (/^[\d.,]+$/.test(entry)) continue;
      if (isFutureDated(entry)) {
        excluded.push(`${name}: ${entry}`);
        continue;
      }
      const code = countryCodeFor(entry);
      if (code) codes.add(code);
      else unmatched.push(`${name}: ${entry}`);
    }
    people.push({ name, codes: [...codes] });
  }
  return { people, unmatched, excluded };
}

/** VACADATA: find the columns headed WRJ / KVJ and collect state codes. */
function parseStatesTab(grid: Grid): Record<string, string[]> {
  const columns: Record<string, number> = {};
  outer: for (let i = 0; i < grid.length; i++) {
    for (let j = 0; j < grid[i].length; j++) {
      const cell = grid[i][j].toUpperCase();
      if (STATE_COLUMN_OWNERS[cell] && columns[cell] === undefined) {
        columns[cell] = j;
        if (Object.keys(columns).length === Object.keys(STATE_COLUMN_OWNERS).length) {
          break outer;
        }
      }
    }
  }

  const result: Record<string, string[]> = {};
  for (const [initials, col] of Object.entries(columns)) {
    const owner = STATE_COLUMN_OWNERS[initials];
    const codes = new Set<string>();
    for (const row of grid) {
      const code = stateCodeFor(row[col] ?? "");
      if (code) codes.add(code);
    }
    result[owner] = [...codes];
  }
  return result;
}

// ---------------------------------------------------------------------------

function parseSheetId(raw: string): string {
  const m = raw.match(/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : raw.trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  // Family members only.
  const authed = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: {
        headers: { Authorization: req.headers.get("Authorization") ?? "" },
      },
    }
  );
  const { data: userData, error: userError } = await authed.auth.getUser();
  if (userError || !userData.user) return json({ error: "Sign in required" }, 401);
  const { data: isFamily } = await authed.rpc("is_family");
  if (!isFamily) {
    return json({ error: "Your email is not on the family list" }, 403);
  }

  // Writes bypass RLS via the service role (never exposed to the browser).
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const sheetId = parseSheetId(
      Deno.env.get("PASSPORT_SHEET_ID") ?? DEFAULT_SHEET_ID
    );
    const res = await fetch(
      `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`,
      { redirect: "follow" }
    );
    if (!res.ok) {
      throw new Error(
        `Could not download the Google Sheet (${res.status}). Is it shared as "Anyone with the link can view"?`
      );
    }
    const wb = XLSX.read(await res.arrayBuffer(), { type: "array" });

    const countryWs = wb.Sheets[COUNTRY_TAB];
    if (!countryWs) {
      throw new Error(
        `Tab "${COUNTRY_TAB}" not found. Tabs: ${wb.SheetNames.join(", ")}`
      );
    }
    const { people, unmatched, excluded } = parseCountryTab(
      sheetToGrid(countryWs)
    );
    if (people.length === 0) throw new Error("No people found in the sheet");

    const statesByOwner = wb.Sheets[STATES_TAB]
      ? parseStatesTab(sheetToGrid(wb.Sheets[STATES_TAB]))
      : {};

    // --- Mirror into the database ---------------------------------------
    const { data: existing, error: memberErr } = await db
      .from("family_members")
      .select("id, name, sort_index");
    if (memberErr) throw new Error(`Reading members failed: ${memberErr.message}`);

    const canonical = (name: string) => {
      const n = name.trim().toLowerCase();
      return MEMBER_ALIASES[n] ?? n;
    };
    const byName = new Map(
      (existing ?? []).map((m) => [canonical(m.name), m])
    );

    const memberIds: Record<string, string> = {};
    for (let i = 0; i < people.length; i++) {
      const person = people[i];
      const match = byName.get(canonical(person.name));
      if (match) {
        memberIds[person.name] = match.id;
        if (match.name !== person.name || match.sort_index !== i + 1) {
          await db
            .from("family_members")
            .update({ name: person.name, sort_index: i + 1 })
            .eq("id", match.id);
        }
      } else {
        const { data: inserted, error } = await db
          .from("family_members")
          .insert({ name: person.name, sort_index: i + 1 })
          .select("id")
          .single();
        if (error) throw new Error(`Adding ${person.name} failed: ${error.message}`);
        memberIds[person.name] = inserted.id;
      }
    }

    // Replace country visits for everyone who has a sheet column.
    let countryRows = 0;
    const ids = Object.values(memberIds);
    const { error: delErr } = await db
      .from("country_visits")
      .delete()
      .in("member_id", ids);
    if (delErr) throw new Error(`Clearing countries failed: ${delErr.message}`);
    const countryInserts = people.flatMap((p) =>
      p.codes.map((code) => ({
        member_id: memberIds[p.name],
        country_code: code,
      }))
    );
    if (countryInserts.length > 0) {
      const { error } = await db.from("country_visits").insert(countryInserts);
      if (error) throw new Error(`Saving countries failed: ${error.message}`);
      countryRows = countryInserts.length;
    }

    // Replace state visits for the people the sheet tracks states for.
    let stateRows = 0;
    const warnings: string[] = [];
    const stateOwnerIds = Object.keys(statesByOwner)
      .map((name) => memberIds[name])
      .filter(Boolean);
    if (stateOwnerIds.length > 0) {
      const { error: sDelErr } = await db
        .from("state_visits")
        .delete()
        .in("member_id", stateOwnerIds);
      if (sDelErr) {
        warnings.push(
          `States were skipped (${sDelErr.message}) — run the state_visits SQL migration.`
        );
      } else {
        const stateInserts = Object.entries(statesByOwner).flatMap(
          ([name, codes]) =>
            memberIds[name]
              ? codes.map((code) => ({
                  member_id: memberIds[name],
                  state_code: code,
                }))
              : []
        );
        if (stateInserts.length > 0) {
          const { error } = await db.from("state_visits").insert(stateInserts);
          if (error) warnings.push(`Saving states failed: ${error.message}`);
          else stateRows = stateInserts.length;
        }
      }
    }

    return json({
      ok: true,
      members: people.map((p) => `${p.name} (${p.codes.length})`),
      countryVisits: countryRows,
      stateVisits: stateRows,
      unmatched,
      excluded,
      warnings,
    });
  } catch (e) {
    console.error("passport-sync failed:", e);
    return json({ error: (e as Error).message }, 502);
  }
});

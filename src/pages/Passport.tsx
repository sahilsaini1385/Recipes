import { useMemo, useState } from "react";
import {
  Plus,
  X,
  Globe,
  Search,
  Trash2,
  Plane,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import {
  usePassport,
  type FamilyMember,
  type PlaceKind,
} from "@/hooks/usePassport";
import {
  COUNTRIES,
  flagEmoji,
  countryName,
  WORLD_COUNTRY_TARGET,
} from "@/lib/countries";
import { US_STATES, stateName, US_STATE_TARGET } from "@/lib/usStates";
import { cn } from "@/lib/utils";

export default function Passport() {
  const { isFamily } = useAuth();
  const {
    data,
    error,
    syncing,
    sync,
    addMember,
    removeMember,
    addVisit,
    removeVisit,
  } = usePassport();
  const [kind, setKind] = useState<PlaceKind>("country");
  const [newName, setNewName] = useState("");
  const [addingMember, setAddingMember] = useState(false);

  // Dataset + labels for the active mode.
  const isCountry = kind === "country";
  const dataset = isCountry
    ? COUNTRIES
    : US_STATES.map((s) => ({ code: s.code, name: s.name }));
  const label = isCountry ? countryName : stateName;
  const symbol = isCountry ? (c: string) => flagEmoji(c) : () => "";
  const target = isCountry ? WORLD_COUNTRY_TARGET : US_STATE_TARGET;
  const visitsFor = (memberId: string): Set<string> =>
    (isCountry ? data?.countries[memberId] : data?.states[memberId]) ??
    new Set();

  const familyTotal = useMemo(() => {
    if (!data) return 0;
    const all = new Set<string>();
    const source = isCountry ? data.countries : data.states;
    for (const set of Object.values(source)) for (const c of set) all.add(c);
    return all.size;
  }, [data, isCountry]);

  // Leaderboard order: most places visited first.
  const rankedMembers = useMemo(() => {
    if (!data) return [];
    const count = (m: FamilyMember) =>
      (isCountry ? data.countries[m.id] : data.states[m.id])?.size ?? 0;
    return [...data.members].sort(
      (a, b) =>
        count(b) - count(a) ||
        a.sort_index - b.sort_index ||
        a.name.localeCompare(b.name)
    );
  }, [data, isCountry]);

  const submitMember = async () => {
    if (!newName.trim()) return;
    await addMember(newName);
    setNewName("");
    setAddingMember(false);
  };

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-5">
      <div className="mb-3 rounded-2xl bg-gradient-to-br from-accent to-accent-dark p-5 text-white shadow-card">
        <div className="flex items-center gap-2">
          <Globe className="h-6 w-6" />
          <h1 className="font-serif text-2xl font-semibold">Family Passport</h1>
        </div>
        <p className="mt-1 text-white/90">
          Together the Jungmans have been to <strong>{familyTotal}</strong> of{" "}
          {Math.max(target, familyTotal)} {isCountry ? "countries" : "US states"}.
        </p>
        <ProgressTrack count={familyTotal} target={target} tone="light" />
        <div className="mt-4 inline-flex rounded-lg bg-white/15 p-0.5">
          {(
            [
              ["country", "Countries"],
              ["state", "US States"],
            ] as const
          ).map(([k, lbl]) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                kind === k ? "bg-white text-accent-dark" : "text-white/90"
              )}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between px-1 text-xs text-ink-faint">
        <span>
          {syncing
            ? "Updating from the family Google Sheet…"
            : "Kept in sync with the family Google Sheet"}
        </span>
        {isFamily && (
          <button
            onClick={() => sync(true)}
            disabled={syncing}
            className="inline-flex items-center gap-1 text-accent-dark disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3 w-3", syncing && "animate-spin")} />
            Sync now
          </button>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-red-700">{error}</p>}
      {!data && <p className="text-center text-ink-soft">Loading…</p>}

      {data && (
        <div className="space-y-3">
          {data.members.length === 0 && !addingMember && (
            <p className="text-center text-ink-soft">
              No family members yet.
              {isFamily ? " Add the first one below." : ""}
            </p>
          )}

          {rankedMembers.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              kind={kind}
              codes={visitsFor(member.id)}
              target={target}
              dataset={dataset}
              label={label}
              symbol={symbol}
              unit={isCountry ? "country" : "state"}
              unitPlural={isCountry ? "countries" : "states"}
              canEdit={isFamily}
              onAdd={(code) => addVisit(kind, member.id, code)}
              onRemove={(code) => removeVisit(kind, member.id, code)}
              onDelete={() => removeMember(member.id)}
            />
          ))}

          {isFamily &&
            (addingMember ? (
              <Card className="p-3">
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    placeholder="Family member's name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitMember()}
                  />
                  <Button onClick={submitMember}>Add</Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setAddingMember(false);
                      setNewName("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </Card>
            ) : (
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setAddingMember(true)}
              >
                <Plus className="h-4 w-4" /> Add family member
              </Button>
            ))}
        </div>
      )}
    </main>
  );
}

/** A runway with a little plane flying toward the target count. */
function ProgressTrack({
  count,
  target,
  tone,
}: {
  count: number;
  target: number;
  tone: "light" | "dark";
}) {
  const pct = Math.max(0, Math.min(100, (count / target) * 100));
  // Keep the plane from overhanging either end of the track.
  const planePct = Math.max(2.5, Math.min(97.5, pct));
  const light = tone === "light";
  return (
    <div className="relative mt-3 mb-1">
      <div
        className={cn(
          "h-2 overflow-hidden rounded-full",
          light ? "bg-white/25" : "bg-paper-deep"
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700",
            light ? "bg-white" : "bg-gradient-to-r from-accent to-accent-dark"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <Plane
        aria-hidden
        className={cn(
          "absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rotate-45 drop-shadow-sm transition-all duration-700",
          light ? "text-white" : "text-accent-dark"
        )}
        style={{ left: `${planePct}%` }}
        fill="currentColor"
      />
    </div>
  );
}

function MemberCard({
  member,
  kind,
  codes,
  target,
  dataset,
  label,
  symbol,
  unit,
  unitPlural,
  canEdit,
  onAdd,
  onRemove,
  onDelete,
}: {
  member: FamilyMember;
  kind: PlaceKind;
  codes: Set<string>;
  target: number;
  dataset: Array<{ code: string; name: string }>;
  label: (code: string) => string;
  symbol: (code: string) => string;
  unit: string;
  unitPlural: string;
  canEdit: boolean;
  onAdd: (code: string) => void;
  onRemove: (code: string) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [picking, setPicking] = useState(false);
  const visited = useMemo(
    () => [...codes].sort((a, b) => label(a).localeCompare(label(b))),
    [codes, label]
  );

  return (
    <Card className="p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-serif text-xl font-medium text-ink">
          {member.name}
        </h2>
        <p className="text-sm text-ink-soft">
          <strong className="text-base text-ink">{codes.size}</strong> of{" "}
          {Math.max(target, codes.size)}
        </p>
      </div>

      <ProgressTrack count={codes.size} target={target} tone="dark" />

      <button
        onClick={() => setExpanded((v) => !v)}
        className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-accent-dark"
      >
        {expanded ? (
          <>
            <ChevronUp className="h-4 w-4" /> Hide list
          </>
        ) : (
          <>
            <ChevronDown className="h-4 w-4" />
            {codes.size > 0
              ? `Show all ${codes.size} ${codes.size === 1 ? unit : unitPlural}`
              : `No ${unitPlural} yet`}
          </>
        )}
      </button>

      {expanded && (
        <>
          {visited.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {visited.map((code) => (
                <span
                  key={code}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full bg-paper-warm py-1 pl-2 text-sm",
                    canEdit ? "pr-1" : "pr-2"
                  )}
                >
                  {symbol(code) && (
                    <span className="text-base leading-none">
                      {symbol(code)}
                    </span>
                  )}
                  {label(code)}
                  {canEdit && (
                    <button
                      aria-label={`Remove ${label(code)}`}
                      onClick={() => onRemove(code)}
                      className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-full text-ink-faint hover:bg-paper-deep hover:text-ink"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}

          {canEdit &&
            (picking ? (
              <PlacePicker
                dataset={dataset}
                symbol={symbol}
                kind={kind}
                existing={codes}
                onPick={onAdd}
                onClose={() => setPicking(false)}
              />
            ) : (
              <div className="mt-3 flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPicking(true)}
                >
                  <Plus className="h-4 w-4" /> Add {unit}
                </Button>
                <button
                  aria-label={`Remove ${member.name}`}
                  onClick={() => {
                    if (confirm(`Remove ${member.name} from the passport?`))
                      onDelete();
                  }}
                  className="p-2 text-ink-faint hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
        </>
      )}
    </Card>
  );
}

function PlacePicker({
  dataset,
  symbol,
  kind,
  existing,
  onPick,
  onClose,
}: {
  dataset: Array<{ code: string; name: string }>;
  symbol: (code: string) => string;
  kind: PlaceKind;
  existing: Set<string>;
  onPick: (code: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return dataset
      .filter(
        (c) =>
          !existing.has(c.code) &&
          (needle === "" || c.name.toLowerCase().includes(needle))
      )
      .slice(0, 60);
  }, [q, existing, dataset]);

  return (
    <div className="mt-3 rounded-xl border border-paper-deep bg-paper-warm p-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <Input
          autoFocus
          placeholder={`Search ${kind === "country" ? "countries" : "states"}…`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="mt-2 max-h-64 overflow-y-auto">
        {results.map((c) => (
          <button
            key={c.code}
            onClick={() => {
              onPick(c.code);
              setQ("");
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-white"
          >
            {symbol(c.code) && (
              <span className="text-lg leading-none">{symbol(c.code)}</span>
            )}
            {c.name}
          </button>
        ))}
        {results.length === 0 && (
          <p className="px-2 py-3 text-sm text-ink-faint">No matches.</p>
        )}
      </div>
      <Button variant="ghost" size="sm" className="mt-1 w-full" onClick={onClose}>
        Done
      </Button>
    </div>
  );
}

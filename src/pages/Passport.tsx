import { useMemo, useState } from "react";
import { Plus, X, Globe, Search, Trash2 } from "lucide-react";
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
  const { data, error, addMember, removeMember, addVisit, removeVisit } =
    usePassport();
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

  const submitMember = async () => {
    if (!newName.trim()) return;
    await addMember(newName);
    setNewName("");
    setAddingMember(false);
  };

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-5">
      <div className="mb-4 rounded-2xl bg-gradient-to-br from-accent to-accent-dark p-5 text-white shadow-card">
        <div className="flex items-center gap-2">
          <Globe className="h-6 w-6" />
          <h1 className="font-serif text-2xl font-semibold">Family Passport</h1>
        </div>
        <p className="mt-1 text-white/90">
          Together the Jungmans have been to <strong>{familyTotal}</strong> of{" "}
          {target} {isCountry ? "countries" : "US states"}.
        </p>
        <div className="mt-3 inline-flex rounded-lg bg-white/15 p-0.5">
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

      {error && <p className="mb-4 text-sm text-red-700">{error}</p>}
      {!data && <p className="text-center text-ink-soft">Loading…</p>}

      {data && (
        <div className="space-y-4">
          {data.members.length === 0 && !addingMember && (
            <p className="text-center text-ink-soft">
              No family members yet.
              {isFamily ? " Add the first one below." : ""}
            </p>
          )}

          {data.members.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              kind={kind}
              codes={visitsFor(member.id)}
              dataset={dataset}
              label={label}
              symbol={symbol}
              unit={isCountry ? "country" : "state"}
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

function MemberCard({
  member,
  kind,
  codes,
  dataset,
  label,
  symbol,
  unit,
  canEdit,
  onAdd,
  onRemove,
  onDelete,
}: {
  member: FamilyMember;
  kind: PlaceKind;
  codes: Set<string>;
  dataset: Array<{ code: string; name: string }>;
  label: (code: string) => string;
  symbol: (code: string) => string;
  unit: string;
  canEdit: boolean;
  onAdd: (code: string) => void;
  onRemove: (code: string) => void;
  onDelete: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const visited = useMemo(
    () => [...codes].sort((a, b) => label(a).localeCompare(label(b))),
    [codes, label]
  );

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-xl font-medium text-ink">
            {member.name}
          </h2>
          <p className="text-sm text-ink-soft">
            {codes.size} {codes.size === 1 ? unit : `${unit}s`}
          </p>
        </div>
        {canEdit && (
          <button
            aria-label={`Remove ${member.name}`}
            onClick={() => {
              if (confirm(`Remove ${member.name} from the passport?`)) onDelete();
            }}
            className="p-2 text-ink-faint hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

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
                <span className="text-base leading-none">{symbol(code)}</span>
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
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => setPicking(true)}
          >
            <Plus className="h-4 w-4" /> Add {unit}
          </Button>
        ))}
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

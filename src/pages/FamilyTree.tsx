import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { TreeDeciduous, Heart, Plus, Pencil, Trash2, X, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import {
  useFamilyTree,
  type TreeNode,
  type PersonDetails,
} from "@/hooks/useFamilyTree";
import {
  CARD_H,
  CARD_W,
  PAD,
  VGAP,
  layoutChart,
  type PlacedCard,
} from "@/lib/treeLayout";
import {
  useRecipeAttribution,
  useRecipeCredits,
} from "@/hooks/useRecipeAttribution";
import { firstName, initials } from "@/lib/names";
import { cn } from "@/lib/utils";

function yearLine(born: number | null, died: number | null): string {
  if (born && died) return `${born}–${died}`;
  if (born) return `b. ${born}`;
  if (died) return `d. ${died}`;
  return "";
}

/**
 * Dates for the detail panel. A card is a couple, so name whose dates are
 * whose — showing one bare year under "John & Nancy" leaves you guessing.
 */
function couplesYears(node: TreeNode): string {
  const mine = yearLine(node.born_year, node.died_year);
  if (!node.spouse_name) return mine;
  const theirs = yearLine(node.spouse_born_year, node.spouse_died_year);
  const parts: string[] = [];
  if (mine) parts.push(`${firstName(node.name)} ${mine}`);
  if (theirs) parts.push(`${firstName(node.spouse_name)} ${theirs}`);
  return parts.join(" · ");
}

/** Everyone on this card, below it, and on its ancestor cards. */
function countAll(node: TreeNode): number {
  return (
    1 +
    (node.spouse_name?.trim() ? 1 : 0) +
    node.children.reduce((sum, c) => sum + countAll(c), 0) +
    (node.parentsSelf ? countAll(node.parentsSelf) : 0) +
    (node.parentsSpouse ? countAll(node.parentsSpouse) : 0)
  );
}

function maxDepth(nodes: TreeNode[]): number {
  let deepest = 0;
  for (const n of nodes) deepest = Math.max(deepest, 1 + maxDepth(n.children));
  return deepest;
}

function ancestorDepth(nodes: TreeNode[]): number {
  let deepest = 0;
  const up = (n: TreeNode): number => {
    const branches = [n.parentsSelf, n.parentsSpouse].filter(
      Boolean
    ) as TreeNode[];
    return branches.length === 0 ? 0 : 1 + Math.max(...branches.map(up));
  };
  for (const n of nodes) deepest = Math.max(deepest, up(n));
  return deepest;
}


// ---------------------------------------------------------------------------

type PanelState =
  | { view: "actions" }
  | { view: "addChild" }
  | { view: "addParents"; side: "self" | "spouse" }
  | { view: "edit" };

export default function FamilyTree() {
  const { isFamily } = useAuth();
  const {
    roots,
    peopleCount,
    error,
    addChild,
    addParents,
    updatePerson,
    removePerson,
  } = useFamilyTree();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelState>({ view: "actions" });
  const [addingRoot, setAddingRoot] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // How many recipes each person is credited with, so a card can offer them.
  const { byPerson: recipesByPerson } = useRecipeAttribution(useRecipeCredits());

  const chart = useMemo(
    () => (roots && roots.length > 0 ? layoutChart(roots) : null),
    [roots]
  );

  // Start the chart horizontally centered (it can be wider than a phone) —
  // but only once, so edits don't yank the user's scroll position around.
  const centered = useRef(false);
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (el && chart && !centered.current) {
      el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
      centered.current = true;
    }
    updateFade();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart]);

  // Edge fades hint that more chart exists beyond the visible window.
  const [fade, setFade] = useState({ l: false, r: false });
  const updateFade = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const l = el.scrollLeft > 8;
    const r = el.scrollLeft < el.scrollWidth - el.clientWidth - 8;
    setFade((f) => (f.l === l && f.r === r ? f : { l, r }));
  };

  // Find the selected node anywhere in the tree (children or ancestors).
  const findNode = (nodes: TreeNode[], id: string): TreeNode | null => {
    for (const n of nodes) {
      if (n.id === id) return n;
      const inAncestors = [n.parentsSelf, n.parentsSpouse]
        .filter(Boolean)
        .map((a) => findNode([a as TreeNode], id))
        .find(Boolean);
      if (inAncestors) return inAncestors;
      const below = findNode(n.children, id);
      if (below) return below;
    }
    return null;
  };
  const selected = roots && selectedId ? findNode(roots, selectedId) : null;

  const select = (id: string) => {
    setPanel({ view: "actions" });
    setSelectedId((cur) => (cur === id ? null : id));
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-person-id="${CSS.escape(id)}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    });
  };
  const close = () => {
    setSelectedId(null);
    setPanel({ view: "actions" });
  };

  const generations = roots ? maxDepth(roots) + ancestorDepth(roots) : 0;

  // Margin labels naming each generation relative to the root couple.
  const genLabels = useMemo(() => {
    if (!chart || !roots || roots.length !== 1) return [];
    const GEN_NAMES: Record<number, string> = {
      [-4]: "Great-great-grandparents",
      [-3]: "Great-grandparents",
      [-2]: "Grandparents",
      [-1]: "Parents",
      [1]: "Children",
      [2]: "Grandchildren",
      [3]: "Great-grandchildren",
    };
    const rowHeight = CARD_H + VGAP;
    const rootCard = chart.cards.find((c) => c.node.id === roots[0].id);
    if (!rootCard) return [];
    const rootIdx = Math.round(((rootCard.y ?? 0) - PAD) / rowHeight);
    const rowCount = Math.round((chart.chartH - 2 * PAD + VGAP) / rowHeight);
    return Array.from({ length: rowCount }, (_, idx) => ({
      idx,
      text: GEN_NAMES[idx - rootIdx] ?? "",
    })).filter((g) => g.text);
  }, [chart, roots]);

  return (
    <main
      // Wider than the other pages: the chart is the one view that can use
      // every pixel, and boxing it to 768px meant panning sideways past
      // empty margins on a laptop.
      className={cn(
        "mx-auto max-w-6xl px-4 pt-5",
        selected ? "pb-72" : "pb-16"
      )}
    >
      <div className="mb-4 rounded-2xl bg-gradient-to-br from-accent to-accent-dark p-5 text-white shadow-card">
        <div className="flex items-center gap-2">
          <TreeDeciduous className="h-6 w-6" />
          <h1 className="font-serif text-2xl font-semibold">Family Tree</h1>
        </div>
        <p className="mt-1 text-white/90">
          {peopleCount > 0 ? (
            <>
              <strong>{peopleCount}</strong>{" "}
              {peopleCount === 1 ? "person" : "people"} across{" "}
              <strong>{generations}</strong>{" "}
              {generations === 1 ? "generation" : "generations"}.
            </>
          ) : (
            "Plant the first branch below."
          )}
        </p>
      </div>

      {error && <p className="mb-4 text-sm text-red-700">{error}</p>}
      {!roots && !error && <p className="text-center text-ink-soft">Loading…</p>}

      {chart && (
        <>
          <div className="relative">
            <div
              ref={scrollerRef}
              onScroll={updateFade}
              className="tree-scroller overflow-x-auto overscroll-x-contain rounded-2xl border border-paper-deep/70 bg-paper-tree shadow-card"
            >
              <div
                className="relative min-w-full [animation:tree-rise_450ms_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none"
                style={{
                  width: chart.chartW,
                  height: chart.chartH,
                  backgroundColor: "#f7efdf",
                  backgroundImage: [
                    "radial-gradient(120% 85% at 50% 0%, rgba(255,253,248,0.70) 0%, rgba(255,253,248,0) 55%)",
                    "radial-gradient(circle, rgba(122,90,50,0.10) 1px, transparent 1.6px)",
                  ].join(", "),
                  backgroundSize: "auto, 22px 22px",
                  backgroundPosition: "0 0, 11px 11px",
                }}
              >
                {/* Printed-plate double rule, living in the padding band. */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-2 rounded-[10px] border border-paper-rule/70"
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-[11px] rounded-lg border border-paper-rule/35"
                />
                <svg
                  className="absolute inset-0 [animation:connectors-in_240ms_ease-out_240ms_both] motion-reduce:animate-none"
                  width={chart.chartW}
                  height={chart.chartH}
                  aria-hidden
                >
                  {/* Everyone else's lines dim gently while a card is selected;
                      the selected card's own lines paint on top in accent. */}
                  <g
                    className="transition-opacity duration-200"
                    opacity={selectedId ? 0.45 : 1}
                  >
                    {chart.paths
                      .filter(
                        (p) =>
                          !(
                            selectedId &&
                            (p.fromId === selectedId || p.toId === selectedId)
                          )
                      )
                      .map((p) => (
                        <path
                          key={`${p.fromId}>${p.toId}`}
                          d={p.d}
                          fill="none"
                          stroke="#c9b48d"
                          strokeOpacity="0.9"
                          strokeWidth="1.25"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      ))}
                  </g>
                  {selectedId &&
                    chart.paths
                      .filter(
                        (p) => p.fromId === selectedId || p.toId === selectedId
                      )
                      .map((p) => (
                        <path
                          key={`${p.fromId}>${p.toId}`}
                          d={p.d}
                          fill="none"
                          stroke="#bf5700"
                          strokeOpacity="0.55"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      ))}
                </svg>
                {chart.cards.map((c) => (
                  <ChartCard
                    key={c.node.id}
                    placed={c}
                    selected={selectedId === c.node.id}
                    onSelect={select}
                  />
                ))}
              </div>
            </div>
            {/* Edge fades: "there's more chart this way". */}
            <div
              className={cn(
                "pointer-events-none absolute inset-y-px left-px w-10 rounded-l-2xl bg-gradient-to-r from-paper-tree to-transparent transition-opacity duration-300",
                fade.l ? "opacity-100" : "opacity-0"
              )}
            />
            <div
              className={cn(
                "pointer-events-none absolute inset-y-px right-px w-10 rounded-r-2xl bg-gradient-to-l from-paper-tree to-transparent transition-opacity duration-300",
                fade.r ? "opacity-100" : "opacity-0"
              )}
            />
            {/* Generation labels pinned to the left margin. They sit in the
                empty band between two rows rather than level with the cards:
                the chart scrolls sideways underneath them, so anything at a
                card's own height ends up covering someone's name. */}
            <div className="pointer-events-none absolute left-0 top-0">
              {genLabels.map((g) => (
                <span
                  key={g.idx}
                  className="absolute left-0 -translate-y-1/2 rounded-r-full border border-l-0 border-paper-line bg-paper-tree py-0.5 pl-3 pr-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-ink-faint"
                  style={{
                    // The top row has only PAD above it, so its label is
                    // nudged down to stay inside the chart.
                    top: Math.max(
                      13,
                      PAD + g.idx * (CARD_H + VGAP) - VGAP / 2
                    ),
                  }}
                >
                  {g.text}
                </span>
              ))}
            </div>
          </div>
          <p className="mt-2 text-center text-xs text-ink-faint sm:hidden">
            Swipe sideways to see the whole tree
            {isFamily ? " · tap a card to edit" : ""}
          </p>
          {isFamily && (
            <p className="mt-2 hidden text-center text-xs text-ink-faint sm:block">
              Click a card to add children, parents, or make changes.
            </p>
          )}
        </>
      )}

      {roots && roots.length === 0 && isFamily && (
        <Card className="p-3">
          {addingRoot ? (
            <PersonForm
              title="First person"
              onSave={async (details) => {
                await addChild(null, details, 0);
                setAddingRoot(false);
              }}
              onCancel={() => setAddingRoot(false)}
            />
          ) : (
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => setAddingRoot(true)}
            >
              <Plus className="h-4 w-4" /> Add the first person
            </Button>
          )}
        </Card>
      )}

      {selected && (
        <div className="fixed inset-x-0 bottom-16 z-20 px-3 pb-2 sm:bottom-0 sm:pb-4">
          <Card className="mx-auto max-w-xl border-paper-deep p-4 shadow-card-hover">
            <div className="mb-3 flex items-start justify-between gap-2">
              <p className="font-serif text-lg font-medium text-ink">
                {selected.name}
                {selected.spouse_name ? ` & ${selected.spouse_name}` : ""}
                {selected.divorced && (
                  <span className="ml-1.5 text-sm font-normal text-ink-faint">
                    (divorced)
                  </span>
                )}
              </p>
              <button
                aria-label="Close"
                onClick={close}
                className="p-1 text-ink-faint hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* A card is a couple, and the recipes may be credited to either
                half of it, so this counts the pair — which is also how the
                Recipes tab will filter when the link is followed. */}
            {panel.view === "actions" &&
              (() => {
                const cooked = recipesByPerson.get(selected.id);
                if (!cooked) return null;
                return (
                  <Link
                    to={`/?from=${selected.id}`}
                    className="mb-3 flex items-center gap-1.5 text-sm text-accent-dark hover:underline"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    {cooked.recipes.length}{" "}
                    {cooked.recipes.length === 1 ? "recipe" : "recipes"} in the
                    collection
                  </Link>
                );
              })()}

            {panel.view === "actions" && !isFamily && (
              <p className="text-sm text-ink-soft">
                {couplesYears(selected) || "No dates recorded"}
                {" · "}Sign in as family to make changes.
              </p>
            )}
            {panel.view === "actions" && isFamily && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setPanel({ view: "addChild" })}>
                  <Plus className="h-4 w-4" /> Add child
                </Button>
                {/* Only offer to add parents when they aren't on the tree
                    already — via an ancestor card or a normal parent card. */}
                {!selected.parentsSelf && !selected.parent_id && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPanel({ view: "addParents", side: "self" })}
                  >
                    <Plus className="h-4 w-4" /> {firstName(selected.name)}'s
                    parents
                  </Button>
                )}
                {selected.spouse_name && !selected.parentsSpouse && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setPanel({ view: "addParents", side: "spouse" })
                    }
                  >
                    <Plus className="h-4 w-4" />{" "}
                    {firstName(selected.spouse_name)}'s parents
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPanel({ view: "edit" })}
                >
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-700"
                  onClick={() => {
                    const others =
                      countAll(selected) -
                      1 -
                      (selected.spouse_name?.trim() ? 1 : 0);
                    const extra =
                      others > 0
                        ? ` Their whole branch (${others} more ${others === 1 ? "person" : "people"}) goes too.`
                        : "";
                    if (
                      confirm(`Remove ${selected.name} from the tree?${extra}`)
                    ) {
                      removePerson(selected.id);
                      close();
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" /> Remove
                </Button>
              </div>
            )}

            {panel.view === "addChild" && (
              <PersonForm
                title={`Child of ${selected.name}${selected.spouse_name ? ` & ${selected.spouse_name}` : ""}`}
                onSave={async (details) => {
                  await addChild(selected.id, details, selected.children.length);
                  close();
                }}
                onCancel={() => setPanel({ view: "actions" })}
              />
            )}

            {panel.view === "addParents" && (
              <PersonForm
                title={`Parents of ${
                  panel.side === "spouse" && selected.spouse_name
                    ? firstName(selected.spouse_name)
                    : firstName(selected.name)
                }`}
                onSave={async (details) => {
                  await addParents(selected.id, panel.side, details);
                  close();
                }}
                onCancel={() => setPanel({ view: "actions" })}
              />
            )}

            {panel.view === "edit" && (
              <PersonForm
                title="Edit"
                initial={selected}
                onSave={async (details) => {
                  await updatePerson(selected.id, details);
                  close();
                }}
                onCancel={() => setPanel({ view: "actions" })}
              />
            )}
          </Card>
        </div>
      )}
    </main>
  );
}

function ChartCard({
  placed,
  selected,
  onSelect,
}: {
  placed: PlacedCard;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const { node, x, y, label, flip } = placed;
  const primaryBadge = (
    <PersonBadge
      name={node.name}
      years={yearLine(node.born_year, node.died_year)}
      primary
    />
  );
  const midSymbol = node.spouse_name ? (
    node.divorced ? (
      <span
        aria-label="Divorced"
        className="mt-4 shrink-0 rounded-full border border-paper-deep bg-paper-warm px-1.5 py-px font-serif text-[9px] italic lowercase leading-tight text-ink-faint"
      >
        div.
      </span>
    ) : (
      <Heart className="mt-4 h-3 w-3 shrink-0 fill-accent/80 text-accent/80" />
    )
  ) : null;
  const spouseBadge = node.spouse_name ? (
    <PersonBadge
      name={node.spouse_name}
      years={yearLine(node.spouse_born_year, node.spouse_died_year)}
    />
  ) : null;
  return (
    <>
      <div
        data-person-id={node.id}
        className="absolute left-0 top-0 transition-transform duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        style={{
          transform: `translate(${x}px, ${y ?? 0}px)`,
          width: CARD_W,
          height: CARD_H,
        }}
      >
      <button
        onClick={() => onSelect(node.id)}
        className={cn(
          "relative flex h-full w-full items-start justify-center gap-1 rounded-xl border bg-paper-card px-2 text-left",
          "shadow-plate",
          "transition-[transform,box-shadow,border-color] duration-200 ease-out",
          "hover:-translate-y-px hover:shadow-plate-hover",
          "active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
          "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
          // Labeled cards reserve a strip at the top for the caption, so
          // connector lines outside the card can never cut through it.
          label ? "pt-[18px]" : "pt-2.5",
          selected
            ? "-translate-y-px border-accent shadow-plate-hover ring-2 ring-accent/35"
            : "border-paper-line"
        )}
      >
        {label && (
          <span
            title={label}
            // Tight tracking so captions like "Marilyn & William's parents"
            // fit the fixed card width instead of ending in an ellipsis.
            className="absolute inset-x-1.5 top-1.5 truncate text-center text-[8px] font-semibold uppercase tracking-[0.04em] text-accent-dark/70"
          >
            {label}
          </span>
        )}
        {flip ? (
          <>
            {spouseBadge}
            {midSymbol}
            {primaryBadge}
          </>
        ) : (
          <>
            {primaryBadge}
            {midSymbol}
            {spouseBadge}
          </>
        )}
      </button>
      </div>
    </>
  );
}

function PersonBadge({
  name,
  years,
  primary,
}: {
  name: string;
  years: string;
  primary?: boolean;
}) {
  // Elders read sepia, the living bloodline glows orange — generations
  // register at a glance and the chart stops being a wall of orange dots.
  const deceased = /–|d\./.test(years);
  return (
    <span className="flex w-[84px] flex-col items-center gap-1">
      <span
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full font-serif text-[13px] font-semibold tracking-wide",
          primary && !deceased &&
            "bg-gradient-to-br from-accent to-accent-dark text-white ring-1 ring-accent-dark/25 ring-offset-2 ring-offset-paper-card",
          primary && deceased &&
            "bg-gradient-to-br from-[#a08a68] to-[#7d6a4e] text-[#f8f2e6] ring-1 ring-[#7d6a4e]/25 ring-offset-2 ring-offset-paper-card",
          !primary && !deceased &&
            "border border-accent/35 bg-accent-soft text-accent-dark",
          !primary && deceased &&
            "border border-ink-faint/40 bg-paper-warm text-ink-soft"
        )}
      >
        {initials(name)}
      </span>
      <span className="flex h-8 items-start justify-center overflow-hidden">
        <span
          title={name}
          className={cn(
            "text-center font-serif font-semibold text-ink",
            name.length > 20
              ? "line-clamp-3 text-[10px] leading-[11px]"
              : "line-clamp-2 text-xs leading-tight"
          )}
        >
          {name}
        </span>
      </span>
      <span className="h-3.5 font-serif text-[10px] italic leading-none tracking-wide text-ink-faint">
        {years}
      </span>
    </span>
  );
}

function PersonForm({
  title,
  initial,
  onSave,
  onCancel,
}: {
  title: string;
  initial?: {
    name: string;
    spouse_name: string | null;
    born_year: number | null;
    died_year: number | null;
    spouse_born_year: number | null;
    spouse_died_year: number | null;
    divorced: boolean;
  };
  onSave: (details: PersonDetails) => Promise<void>;
  onCancel: () => void;
}) {
  const [details, setDetails] = useState<PersonDetails>({
    name: initial?.name ?? "",
    spouse: initial?.spouse_name ?? "",
    born: initial?.born_year?.toString() ?? "",
    died: initial?.died_year?.toString() ?? "",
    spouseBorn: initial?.spouse_born_year?.toString() ?? "",
    spouseDied: initial?.spouse_died_year?.toString() ?? "",
    divorced: initial?.divorced ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof PersonDetails) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDetails((d) => ({ ...d, [key]: e.target.value }));

  const submit = async () => {
    if (!details.name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(details);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">
        {title}
      </p>
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            autoFocus
            placeholder="Name"
            value={details.name}
            onChange={set("name")}
          />
          <Input
            className="w-24 shrink-0"
            placeholder="Born"
            inputMode="numeric"
            value={details.born}
            onChange={set("born")}
          />
          <Input
            className="w-24 shrink-0"
            placeholder="Died"
            inputMode="numeric"
            value={details.died}
            onChange={set("died")}
          />
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Spouse or partner (optional)"
            value={details.spouse}
            onChange={set("spouse")}
          />
          <Input
            className="w-24 shrink-0"
            placeholder="Born"
            inputMode="numeric"
            value={details.spouseBorn}
            onChange={set("spouseBorn")}
          />
          <Input
            className="w-24 shrink-0"
            placeholder="Died"
            inputMode="numeric"
            value={details.spouseDied}
            onChange={set("spouseDied")}
          />
        </div>
        <p className="text-xs text-ink-faint">
          Years are optional — leave "Died" blank for anyone living.
        </p>
        {details.spouse.trim() && (
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={details.divorced}
              onChange={(e) =>
                setDetails((d) => ({ ...d, divorced: e.target.checked }))
              }
              className="h-4 w-4 accent-accent"
            />
            Divorced or separated (shown with a small "div." note)
          </label>
        )}
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={submit}
            disabled={!details.name.trim() || saving}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
      </div>
    </div>
  );
}

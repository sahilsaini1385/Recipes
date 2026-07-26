import { useEffect, useMemo, useRef, useState } from "react";
import { TreeDeciduous, Heart, Plus, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import {
  useFamilyTree,
  type TreeNode,
  type PersonDetails,
} from "@/hooks/useFamilyTree";
import { cn } from "@/lib/utils";

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w))
    .slice(0, 2)
    .map((w) => (w.match(/[\p{L}\p{N}]/u) ?? [""])[0].toUpperCase())
    .join("");

function yearLine(born: number | null, died: number | null): string {
  if (born && died) return `${born}–${died}`;
  if (born) return `b. ${born}`;
  if (died) return `d. ${died}`;
  return "";
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
// Chart layout. Cards are one fixed size; positions are computed, and the
// connecting lines are drawn as exact SVG elbows so they always join up.
// ---------------------------------------------------------------------------

const CARD_W = 200;
const CARD_H = 118;
const HGAP = 28;
const VGAP = 56;
const PAD = 24;
const LABEL_H = 18;

interface PlacedCard {
  node: TreeNode;
  x: number; // left, px
  row: number;
  y?: number; // top, px (filled in after rows are normalized)
  label?: string;
}

interface PendingEdge {
  fromId: string;
  toId: string;
  kind: "child" | "spouseParents";
}

// A branch's outline: for each row it touches, how far left/right it reaches
// (relative to the branch's own card center). Siblings pack against each
// other's outlines so nobody drifts further apart than needed.
type Extent = { l: number; r: number };
type Shape = Map<number, Extent>;

interface RelPlace {
  node: TreeNode;
  dx: number;
  drow: number;
  label?: string;
}

interface BranchLayout {
  shape: Shape;
  places: RelPlace[];
  edges: PendingEdge[];
}

function mergeShape(target: Shape, src: Shape, dx: number, drow: number) {
  for (const [row, ext] of src) {
    const nr = row + drow;
    const moved = { l: ext.l + dx, r: ext.r + dx };
    const cur = target.get(nr);
    target.set(
      nr,
      cur ? { l: Math.min(cur.l, moved.l), r: Math.max(cur.r, moved.r) } : moved
    );
  }
}

/**
 * "X's parents" cards on the blood side become real top-level parents (so
 * siblings like Robert can hang off them); the spouse's parents stay
 * attached and render above the spouse's half of the couple card.
 */
function hoist(n: TreeNode): TreeNode {
  let cur: TreeNode = { ...n, children: n.children.map(hoist) };
  while (cur.parentsSelf) {
    const p = cur.parentsSelf;
    cur = {
      ...p,
      children: [
        ...p.children.map(hoist),
        { ...cur, parentsSelf: undefined },
      ],
    };
  }
  return cur;
}

/**
 * Lay out one branch: the card itself, its packed children below, and (for
 * a couple whose spouse has parent cards) the in-law branch above-right.
 * Everything is relative to this branch's card center.
 */
function layoutBranch(n: TreeNode): BranchLayout {
  const kids = n.children.map(layoutBranch);

  // Pack siblings left-to-right: each slides left until its outline is one
  // gap away from everything already placed, at the closest row.
  const packed: Shape = new Map();
  const offsets: number[] = [];
  kids.forEach((k, i) => {
    let dx = 0;
    if (i > 0) {
      dx = -Infinity;
      for (const [row, ext] of k.shape) {
        const m = packed.get(row);
        if (m) dx = Math.max(dx, m.r + HGAP - ext.l);
      }
      if (dx === -Infinity) {
        const maxR = Math.max(...[...packed.values()].map((e) => e.r));
        const minL = Math.min(...[...k.shape.values()].map((e) => e.l));
        dx = maxR + HGAP - minL;
      }
    }
    offsets.push(dx);
    mergeShape(packed, k.shape, dx, 0);
  });

  // Center the card over its children, unless a child's in-law card
  // occupies this row — then slide just far enough to whichever side is
  // closer.
  let cx = kids.length ? (offsets[0] + offsets[offsets.length - 1]) / 2 : 0;
  const claimed = packed.get(-1);
  if (claimed && cx + CARD_W / 2 + HGAP > claimed.l && cx - CARD_W / 2 - HGAP < claimed.r) {
    const leftCx = claimed.l - HGAP - CARD_W / 2;
    const rightCx = claimed.r + HGAP + CARD_W / 2;
    cx = cx - leftCx <= rightCx - cx ? leftCx : rightCx;
  }

  const shape: Shape = new Map([[0, { l: -CARD_W / 2, r: CARD_W / 2 }]]);
  mergeShape(shape, packed, -cx, 1);

  const places: RelPlace[] = [{ node: n, dx: 0, drow: 0 }];
  const edges: PendingEdge[] = [];
  kids.forEach((k, i) => {
    edges.push({ fromId: n.id, toId: n.children[i].id, kind: "child" });
    edges.push(...k.edges);
    for (const p of k.places) {
      places.push({ ...p, dx: p.dx + offsets[i] - cx, drow: p.drow + 1 });
    }
  });

  // The spouse's parents (and any branch hanging off them, e.g. the
  // spouse's siblings) sit directly above the spouse's half of this card,
  // so the short dashed drop into their child can't be misread.
  if (n.parentsSpouse && n.spouse_name) {
    const inLaws = layoutBranch(n.parentsSpouse);
    let dxSp = CARD_W / 2 + HGAP;
    for (const [row, ext] of inLaws.shape) {
      const m = shape.get(row - 1);
      if (m) dxSp = Math.max(dxSp, m.r + HGAP - ext.l);
    }
    mergeShape(shape, inLaws.shape, dxSp, -1);
    for (const p of inLaws.places) {
      places.push({
        ...p,
        dx: p.dx + dxSp,
        drow: p.drow - 1,
        label:
          p.node.id === n.parentsSpouse.id
            ? `${firstName(n.spouse_name)}'s parents`
            : p.label,
      });
    }
    edges.push(...inLaws.edges);
    edges.push({ fromId: n.parentsSpouse.id, toId: n.id, kind: "spouseParents" });
  }

  return { shape, places, edges };
}

function layoutChart(roots: TreeNode[]) {
  const displayRoots = roots.map(hoist);
  const cards: PlacedCard[] = [];
  const edges: PendingEdge[] = [];

  let cursor = 0;
  for (const r of displayRoots) {
    const branch = layoutBranch(r);
    const minL = Math.min(...[...branch.shape.values()].map((e) => e.l));
    const maxR = Math.max(...[...branch.shape.values()].map((e) => e.r));
    for (const p of branch.places) {
      cards.push({
        node: p.node,
        x: cursor + (p.dx - minL) - CARD_W / 2,
        row: p.drow,
        label: p.label,
      });
    }
    edges.push(...branch.edges);
    cursor += maxR - minL + HGAP * 2;
  }

  // Normalize coordinates to start at the padding edge.
  const minRow = Math.min(...cards.map((c) => c.row));
  const minX = Math.min(...cards.map((c) => c.x));
  const rowHeight = CARD_H + VGAP;
  for (const c of cards) {
    c.x += PAD - minX;
    c.y = PAD + LABEL_H + (c.row - minRow) * rowHeight;
  }
  const chartW = Math.max(...cards.map((c) => c.x)) + CARD_W + PAD;
  const chartH =
    Math.max(...cards.map((c) => c.y ?? 0)) + CARD_H + PAD;

  // Turn edges into SVG elbow paths from the final positions. In-law
  // connections are dashed and bend closer to the card than the shared
  // children bus, so the two kinds of line never blend together.
  const byId = new Map(cards.map((c) => [c.node.id, c]));
  const paths: Array<{ d: string; dashed: boolean }> = [];
  for (const e of edges) {
    const from = byId.get(e.fromId);
    const to = byId.get(e.toId);
    if (!from || !to) continue;
    const ty = to.y ?? 0;
    const dashed = e.kind === "spouseParents";
    // Dashed in-law lines leave the card slightly off-center and bend
    // closer to the card, so they never share a track with the solid
    // children lines.
    const fx = from.x + CARD_W / 2 - (dashed ? 24 : 0);
    const fy = (from.y ?? 0) + CARD_H;
    const midY = dashed ? ty - VGAP / 4 : ty - VGAP / 2;
    // A couple card with the spouse's parents above splits its incoming
    // lines: blood side enters left of center, in-law side right of center.
    const tx = dashed
      ? to.x + (CARD_W * 3) / 4
      : to.x + CARD_W / 2 - (to.node.parentsSpouse ? CARD_W / 4 : 0);
    paths.push({ d: `M ${fx} ${fy} V ${midY} H ${tx} V ${ty}`, dashed });
  }

  return { cards, paths, chartW, chartH };
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

  const chart = useMemo(
    () => (roots && roots.length > 0 ? layoutChart(roots) : null),
    [roots]
  );

  // Start the chart horizontally centered (it can be wider than a phone).
  useEffect(() => {
    const el = scrollerRef.current;
    if (el && chart) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, [chart]);

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
    if (!isFamily) return;
    setPanel({ view: "actions" });
    setSelectedId((cur) => (cur === id ? null : id));
  };
  const close = () => {
    setSelectedId(null);
    setPanel({ view: "actions" });
  };

  const generations = roots ? maxDepth(roots) + ancestorDepth(roots) : 0;

  return (
    <main
      className={cn("mx-auto max-w-3xl px-4 pt-5", selected ? "pb-72" : "pb-16")}
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
          <div
            ref={scrollerRef}
            className="overflow-x-auto rounded-2xl border border-paper-deep/70 bg-paper-warm/60 shadow-card"
          >
            <div
              className="relative"
              style={{ width: chart.chartW, height: chart.chartH }}
            >
              <svg
                className="absolute inset-0"
                width={chart.chartW}
                height={chart.chartH}
                aria-hidden
              >
                {chart.paths.map((p, i) => (
                  <path
                    key={i}
                    d={p.d}
                    fill="none"
                    stroke={p.dashed ? "#bf5700" : "#d8c5a5"}
                    strokeOpacity={p.dashed ? 0.45 : 1}
                    strokeWidth="1.5"
                    strokeDasharray={p.dashed ? "5 4" : undefined}
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

      {selected && isFamily && (
        <div className="fixed inset-x-0 bottom-16 z-20 px-3 pb-2 sm:bottom-0 sm:pb-4">
          <Card className="mx-auto max-w-xl border-paper-deep p-4 shadow-card-hover">
            <div className="mb-3 flex items-start justify-between gap-2">
              <p className="font-serif text-lg font-medium text-ink">
                {selected.name}
                {selected.spouse_name ? ` & ${selected.spouse_name}` : ""}
              </p>
              <button
                aria-label="Close"
                onClick={close}
                className="p-1 text-ink-faint hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {panel.view === "actions" && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setPanel({ view: "addChild" })}>
                  <Plus className="h-4 w-4" /> Add child
                </Button>
                {!selected.parentsSelf && (
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
  const { node, x, y, label } = placed;
  return (
    <>
      {label && (
        <p
          className="absolute text-center text-[10px] font-medium uppercase tracking-wide text-ink-faint"
          style={{ left: x, top: (y ?? 0) - LABEL_H, width: CARD_W }}
        >
          {label}
        </p>
      )}
      <button
        onClick={() => onSelect(node.id)}
        className={cn(
          "absolute flex items-start justify-center gap-1 rounded-2xl border bg-white px-2 pt-2.5 text-left shadow-card transition-shadow hover:shadow-card-hover",
          selected ? "border-accent ring-2 ring-accent/40" : "border-paper-deep/60"
        )}
        style={{ left: x, top: y, width: CARD_W, height: CARD_H }}
      >
        <PersonBadge
          name={node.name}
          years={yearLine(node.born_year, node.died_year)}
          primary
        />
        {node.spouse_name && (
          <>
            <Heart className="mt-4 h-3.5 w-3.5 shrink-0 fill-accent text-accent" />
            <PersonBadge
              name={node.spouse_name}
              years={yearLine(node.spouse_born_year, node.spouse_died_year)}
            />
          </>
        )}
      </button>
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
  return (
    <span className="flex w-[84px] flex-col items-center gap-1">
      <span
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full font-serif text-sm font-semibold shadow-sm",
          primary
            ? "bg-gradient-to-br from-accent to-accent-dark text-white"
            : "border border-accent/30 bg-accent/10 text-accent-dark"
        )}
      >
        {initials(name)}
      </span>
      <span className="line-clamp-2 h-8 text-center text-xs font-medium leading-tight text-ink">
        {name}
      </span>
      <span className="h-3.5 text-[10px] leading-none text-ink-faint">
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

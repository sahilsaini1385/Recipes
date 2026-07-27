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

const firstName = (name: string) => {
  const words = name
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/^["'“”‘’()]+|["'“”‘’()]+$/g, ""));
  return words.find(Boolean) ?? name.trim();
};

// Suffixes that shouldn't count as a surname for monogram purposes.
const NAME_SUFFIXES = new Set(["sr", "jr", "ii", "iii", "iv", "v"]);

/**
 * First name + surname initials. Quoted nicknames ('Rajinder "Tony"
 * Saini' → RS), parentheticals, and suffixes (Sr/Jr/III) are skipped, and
 * middle names don't steal the second slot ('Jack Bahal Saini' → JS).
 */
const initials = (name: string) => {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => !/^["“”'‘’(]/.test(w))
    .filter((w) => /[\p{L}\p{N}]/u.test(w))
    .filter((w) => !NAME_SUFFIXES.has(w.toLowerCase().replace(/\./g, "")));
  const picked =
    words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return picked
    .map((w) => (w.match(/[\p{L}\p{N}]/u) ?? [""])[0].toUpperCase())
    .join("");
};

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
// Gaps sized to the minimum the connector tracks need: the children bus
// runs at VGAP/2 above a row, the in-law track 6px below it, and captions
// live inside the cards — nothing else uses the space between cards.
const HGAP = 20;
const VGAP = 40;
const PAD = 24;

interface PlacedCard {
  node: TreeNode;
  x: number; // left, px
  row: number;
  y?: number; // top, px (filled in after rows are normalized)
  label?: string;
  /** Spouse shown on the left because their parents sit on that side. */
  flip?: boolean;
}

interface PendingEdge {
  fromId: string;
  toId: string;
  kind: "child" | "spouseParents";
}

// A branch's outline: for each row it touches, the list of occupied
// horizontal intervals (relative to the branch's own card center). Keeping
// a list — not just the min/max span — lets cards tuck into real gaps.
type Interval = { l: number; r: number };
type Shape = Map<number, Interval[]>;

interface RelPlace {
  node: TreeNode;
  dx: number;
  drow: number;
  label?: string;
  flip?: boolean;
}

interface BranchLayout {
  shape: Shape;
  places: RelPlace[];
  edges: PendingEdge[];
}

function mergeShape(target: Shape, src: Shape, dx: number, drow: number) {
  for (const [row, ivs] of src) {
    const nr = row + drow;
    const list = target.get(nr) ?? [];
    for (const iv of ivs) list.push({ l: iv.l + dx, r: iv.r + dx });
    list.sort((a, b) => a.l - b.l);
    // Coalesce touching intervals to keep the lists short.
    const merged: Interval[] = [];
    for (const iv of list) {
      const last = merged[merged.length - 1];
      if (last && iv.l <= last.r) last.r = Math.max(last.r, iv.r);
      else merged.push({ ...iv });
    }
    target.set(nr, merged);
  }
}

/**
 * Slide `moving` (shifted down by drow) horizontally from startDx in the
 * given direction until it no longer collides with `base`, and return the
 * offset. This is what lets a branch settle into the nearest free slot.
 */
function packOffset(
  base: Shape,
  moving: Shape,
  drow: number,
  startDx: number,
  dir: 1 | -1
): number {
  let dx = startDx;
  for (let guard = 0; guard < 100; guard++) {
    let pushed = false;
    for (const [row, ivs] of moving) {
      const baseIvs = base.get(row + drow);
      if (!baseIvs) continue;
      for (const iv of ivs) {
        for (const b of baseIvs) {
          if (iv.l + dx < b.r + HGAP && iv.r + dx > b.l - HGAP) {
            dx = dir > 0 ? b.r + HGAP - iv.l : b.l - HGAP - iv.r;
            pushed = true;
          }
        }
      }
    }
    if (!pushed) return dx;
  }
  return dx;
}

/** "Nancy & Linda's parents" from a list of first names. */
function parentsLabel(names: string[]): string {
  const joined =
    names.length > 1
      ? `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`
      : names[0];
  return `${joined}'s parents`;
}

/** A display-only field hoisting attaches so promoted cards keep a caption. */
type DisplayNode = TreeNode & { hoistLabel?: string };

/**
 * "X's parents" cards on the blood side become real top-level parents (so
 * siblings like Robert can hang off them); the spouse's parents stay
 * attached and render above the spouse's half of the couple card. Promoted
 * cards carry a caption naming whose parents they are.
 */
function hoist(n: TreeNode): DisplayNode {
  let cur: DisplayNode = { ...n, children: n.children.map(hoist) };
  while (cur.parentsSelf) {
    const p = cur.parentsSelf;
    const label = parentsLabel([
      firstName(cur.name),
      ...p.children.map((c) => firstName(c.name)),
    ]);
    cur = {
      ...p,
      hoistLabel: label,
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

  // Pack siblings left-to-right: each slides until its outline is one gap
  // clear of everything already placed. Keeping sibling order, deeper rows
  // may still tuck into gaps left by earlier branches.
  const packed: Shape = new Map();
  const offsets: number[] = [];
  kids.forEach((k, i) => {
    const dx = i === 0 ? 0 : packOffset(packed, k.shape, 0, offsets[i - 1] + 1, 1);
    offsets.push(dx);
    mergeShape(packed, k.shape, dx, 0);
  });

  // Center the card over its children, unless a child's in-law card
  // occupies this row — then settle into the free slot that keeps the
  // whole branch narrowest (nearness breaks ties), since any extra width
  // here is paid again by every generation packed above.
  let cx = kids.length ? (offsets[0] + offsets[offsets.length - 1]) / 2 : 0;
  const cardShape: Shape = new Map([[0, [{ l: -CARD_W / 2, r: CARD_W / 2 }]]]);
  const rowAbove = packed.get(-1);
  if (rowAbove) {
    // Settle into the nearest free slot: staying close to the natural
    // center keeps the reading order sensible, which matters more than a
    // slightly narrower chart.
    const base: Shape = new Map([[0, rowAbove]]);
    const rightCx = packOffset(base, cardShape, 0, cx, 1);
    const leftCx = packOffset(base, cardShape, 0, cx, -1);
    cx = cx - leftCx <= rightCx - cx ? leftCx : rightCx;
  }

  const shape: Shape = new Map([[0, [{ l: -CARD_W / 2, r: CARD_W / 2 }]]]);
  mergeShape(shape, packed, -cx, 1);

  const self: RelPlace = {
    node: n,
    dx: 0,
    drow: 0,
    label: (n as DisplayNode).hoistLabel,
  };
  const places: RelPlace[] = [self];
  const edges: PendingEdge[] = [];
  kids.forEach((k, i) => {
    edges.push({ fromId: n.id, toId: n.children[i].id, kind: "child" });
    edges.push(...k.edges);
    for (const p of k.places) {
      places.push({ ...p, dx: p.dx + offsets[i] - cx, drow: p.drow + 1 });
    }
  });

  // The spouse's parents (and any branch hanging off them, e.g. the
  // spouse's siblings) go directly above this card — on whichever side is
  // closer. If they land on the left, the couple flips so the spouse's
  // half faces their parents.
  if (n.parentsSpouse && n.spouse_name) {
    // Hoist so ancestors of the in-law couple themselves (e.g. Kathryn
    // Reeves' parents) become real cards above them, then anchor the
    // placement to the in-law couple's own card so THEY stay right next
    // to their child regardless of how tall their branch is.
    const inLaws = layoutBranch(hoist(n.parentsSpouse));
    const anchor = inLaws.places.find(
      (p) => p.node.id === n.parentsSpouse!.id
    ) ?? { dx: 0, drow: 0 };
    const near = CARD_W / 2 + HGAP;
    const drow = -1 - anchor.drow;
    const right = packOffset(shape, inLaws.shape, drow, near - anchor.dx, 1);
    const left = packOffset(shape, inLaws.shape, drow, -near - anchor.dx, -1);
    // Whichever side keeps the in-law couple closest to their child wins —
    // predictable adjacency reads better than a marginally narrower chart.
    const useLeft =
      Math.abs(left + anchor.dx) < Math.abs(right + anchor.dx);
    const dxSp = useLeft ? left : right;
    const flip = dxSp + anchor.dx < 0;
    self.flip = flip;

    const label = parentsLabel([
      firstName(n.spouse_name),
      ...n.parentsSpouse.children.map((c) => firstName(c.name)),
    ]);

    mergeShape(shape, inLaws.shape, dxSp, drow);
    for (const p of inLaws.places) {
      places.push({
        ...p,
        dx: p.dx + dxSp,
        drow: p.drow + drow,
        label: p.node.id === n.parentsSpouse.id ? label : p.label,
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

  // Pack the root branches against each other by their actual outlines —
  // exactly like siblings — so separate families interleave into each
  // other's free space instead of being stacked as rectangles. Outlines
  // are inflated by half a gap per side so unrelated families keep double
  // the sibling clearance and their connector runs stay visually apart.
  const inflate = (s: Shape): Shape => {
    const out: Shape = new Map();
    for (const [row, ivs] of s) {
      out.set(
        row,
        ivs.map((iv) => ({ l: iv.l - HGAP / 2, r: iv.r + HGAP / 2 }))
      );
    }
    return out;
  };
  const forest: Shape = new Map();
  let prevDx = 0;
  displayRoots.forEach((r, i) => {
    const branch = layoutBranch(r);
    const padded = inflate(branch.shape);
    const dx = i === 0 ? 0 : packOffset(forest, padded, 0, prevDx + 1, 1);
    prevDx = dx;
    mergeShape(forest, padded, dx, 0);
    for (const p of branch.places) {
      cards.push({
        node: p.node,
        x: dx + p.dx - CARD_W / 2,
        row: p.drow,
        label: p.label,
        flip: p.flip,
      });
    }
    edges.push(...branch.edges);
  });

  // Normalize coordinates to start at the padding edge.
  const minRow = Math.min(...cards.map((c) => c.row));
  const minX = Math.min(...cards.map((c) => c.x));
  const rowHeight = CARD_H + VGAP;
  for (const c of cards) {
    c.x += PAD - minX;
    c.y = PAD + (c.row - minRow) * rowHeight;
  }
  const chartW = Math.max(...cards.map((c) => c.x)) + CARD_W + PAD;
  const chartH =
    Math.max(...cards.map((c) => c.y ?? 0)) + CARD_H + PAD;

  // Turn edges into SVG elbow paths from the final positions. All
  // parent-child lines look the same — a child is a child on both sides
  // of the family. To keep two different parents' lines from merging into
  // one ambiguous run, each parent's bundle gets its own track height in
  // the gap between rows whenever their horizontal spans overlap.
  const byId = new Map(cards.map((c) => [c.node.id, c]));
  interface RawEdge {
    fx: number;
    fy: number;
    tx: number;
    ty: number;
    band: number; // target row: which inter-row gap the bend lives in
    fromId: string;
  }
  const raw: RawEdge[] = [];
  for (const e of edges) {
    const from = byId.get(e.fromId);
    const to = byId.get(e.toId);
    if (!from || !to) continue;
    const ty = to.y ?? 0;
    const inLaw = e.kind === "spouseParents";
    const fx = from.x + CARD_W / 2 - (inLaw ? 24 : 0);
    const fy = (from.y ?? 0) + CARD_H;
    // A couple card with the spouse's parents above splits its incoming
    // lines: each line enters above the person it belongs to (the couple
    // flips when their in-laws sit on the left).
    const spouseSide = to.flip ? -1 : 1;
    const tx = inLaw
      ? to.x + CARD_W / 2 + spouseSide * (CARD_W / 4)
      : to.x +
        CARD_W / 2 -
        (to.node.parentsSpouse ? spouseSide * (CARD_W / 4) : 0);
    raw.push({ fx, fy, tx, ty, band: to.row, fromId: e.fromId });
  }

  // Track assignment per band: group segments by parent, then give
  // x-overlapping groups different heights (center, then a bit lower,
  // then a bit higher — all clear of card edges at VGAP=40).
  const TRACK_OFFSETS = [0, 6, -6];
  const bandGroups = new Map<number, Map<string, { min: number; max: number }>>();
  for (const e of raw) {
    const groups =
      bandGroups.get(e.band) ?? bandGroups.set(e.band, new Map()).get(e.band)!;
    const span = groups.get(e.fromId);
    const lo = Math.min(e.fx, e.tx);
    const hi = Math.max(e.fx, e.tx);
    if (span) {
      span.min = Math.min(span.min, lo);
      span.max = Math.max(span.max, hi);
    } else groups.set(e.fromId, { min: lo, max: hi });
  }
  const trackOf = new Map<string, number>(); // `${band}:${fromId}` -> offset
  for (const [band, groups] of bandGroups) {
    const ordered = [...groups.entries()].sort((a, b) => a[1].min - b[1].min);
    const placed: Array<{ min: number; max: number; level: number }> = [];
    for (const [fromId, span] of ordered) {
      const taken = new Set(
        placed
          .filter((p) => span.min <= p.max && span.max >= p.min)
          .map((p) => p.level)
      );
      let level = 0;
      while (taken.has(level % TRACK_OFFSETS.length) && level < TRACK_OFFSETS.length) level++;
      level = level % TRACK_OFFSETS.length;
      placed.push({ ...span, level });
      trackOf.set(`${band}:${fromId}`, TRACK_OFFSETS[level]);
    }
  }

  const paths: Array<{ d: string }> = [];
  for (const e of raw) {
    const offset = trackOf.get(`${e.band}:${e.fromId}`) ?? 0;
    const midY = e.ty - VGAP / 2 + offset;
    paths.push({ d: `M ${e.fx} ${e.fy} V ${midY} H ${e.tx} V ${e.ty}` });
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
                    stroke="#d8c5a5"
                    strokeWidth="1.5"
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

            {panel.view === "actions" && !isFamily && (
              <p className="text-sm text-ink-soft">
                {yearLine(selected.born_year, selected.died_year) ||
                  "No dates recorded."}{" "}
                Sign in as family to make changes.
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
        className="mt-4 shrink-0 rounded-full border border-paper-deep bg-paper-warm px-1.5 py-px text-[9px] font-medium lowercase leading-tight text-ink-faint"
      >
        div.
      </span>
    ) : (
      <Heart className="mt-4 h-3.5 w-3.5 shrink-0 fill-accent text-accent" />
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
      <button
        onClick={() => onSelect(node.id)}
        className={cn(
          "absolute flex items-start justify-center gap-1 rounded-2xl border bg-white px-2 text-left shadow-card transition-shadow hover:shadow-card-hover",
          // Labeled cards reserve a strip at the top for the caption, so
          // connector lines outside the card can never cut through it.
          label ? "pt-[18px]" : "pt-2.5",
          selected ? "border-accent ring-2 ring-accent/40" : "border-paper-deep/60"
        )}
        style={{ left: x, top: y, width: CARD_W, height: CARD_H }}
      >
        {label && (
          <span
            title={label}
            className="absolute inset-x-2 top-1.5 truncate text-center text-[9px] font-medium uppercase tracking-wide text-ink-faint"
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
      <span className="flex h-8 items-start justify-center overflow-hidden">
        <span
          title={name}
          className={cn(
            "text-center font-medium text-ink",
            name.length > 20
              ? "line-clamp-3 text-[10px] leading-[11px]"
              : "line-clamp-2 text-xs leading-tight"
          )}
        >
          {name}
        </span>
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

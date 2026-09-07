import type { TreeNode } from "@/hooks/useFamilyTree";
import { firstName } from "./names";

/**
 * Family-tree chart geometry.
 *
 * Pure functions only: given the tree, work out where every card sits and
 * the exact elbow path of every connector. Nothing here touches React or the
 * DOM, so the whole engine can be reasoned about -- and tested -- on its own.
 */

// ---------------------------------------------------------------------------
// Chart layout. Cards are one fixed size; positions are computed, and the
// connecting lines are drawn as exact SVG elbows so they always join up.
// ---------------------------------------------------------------------------

export const CARD_W = 200;
export const CARD_H = 118;
// Gaps sized to the minimum the connector tracks need: the children bus
// runs at VGAP/2 above a row, the in-law track 6px below it, and captions
// live inside the cards — nothing else uses the space between cards.
const HGAP = 20;
export const VGAP = 40;
export const PAD = 24;

export interface PlacedCard {
  node: TreeNode;
  x: number; // left, px
  row: number;
  y?: number; // top, px (filled in after rows are normalized)
  label?: string;
  /** Spouse shown on the left because their parents sit on that side. */
  flip?: boolean;
}

/** Everything the page needs to draw the chart. */
export interface ChartLayout {
  cards: PlacedCard[];
  paths: Array<{ d: string; fromId: string; toId: string }>;
  chartW: number;
  chartH: number;
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
function layoutBranch(n: TreeNode, edgeHint: -1 | 0 | 1 = 0): BranchLayout {
  // Children learn whether they sit on the open left or right flank of
  // their sibling row, so their in-laws can favor the roomy side.
  const kids = n.children.map((c, i) =>
    layoutBranch(
      c,
      n.children.length > 1
        ? i === 0
          ? -1
          : i === n.children.length - 1
            ? 1
            : 0
        : edgeHint
    )
  );

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
    // On a near-tie, a leftmost sibling sends their in-laws into the open
    // space on the left (flipping the couple), a rightmost to the right.
    const dl = Math.abs(left + anchor.dx);
    const dr = Math.abs(right + anchor.dx);
    const useLeft = edgeHint === -1 ? dl <= dr : dl < dr;
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

export function layoutChart(roots: TreeNode[]): ChartLayout {
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
    toId: string;
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
    raw.push({ fx, fy, tx, ty, band: to.row, fromId: e.fromId, toId: e.toId });
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

  // Rounded elbows read as drawn rather than plotted. Radius never exceeds
  // half the horizontal run, and the vertical stubs are always >= 14px.
  const paths: Array<{ d: string; fromId: string; toId: string }> = [];
  for (const e of raw) {
    const offset = trackOf.get(`${e.band}:${e.fromId}`) ?? 0;
    const midY = e.ty - VGAP / 2 + offset;
    const s = Math.sign(e.tx - e.fx);
    const r = Math.min(6, Math.abs(e.tx - e.fx) / 2);
    const d =
      s === 0 || r < 1
        ? `M ${e.fx} ${e.fy} V ${e.ty}`
        : `M ${e.fx} ${e.fy} V ${midY - r} Q ${e.fx} ${midY} ${e.fx + s * r} ${midY}` +
          ` H ${e.tx - s * r} Q ${e.tx} ${midY} ${e.tx} ${midY + r} V ${e.ty}`;
    paths.push({ d, fromId: e.fromId, toId: e.toId });
  }

  return { cards, paths, chartW, chartH };
}

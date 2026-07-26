import { useEffect, useRef, useState } from "react";
import { TreeDeciduous, Heart, Plus, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useFamilyTree, type TreeNode } from "@/hooks/useFamilyTree";
import { cn } from "@/lib/utils";

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

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

  // Start the chart horizontally centered (it can be wider than a phone).
  useEffect(() => {
    const el = scrollerRef.current;
    if (el && roots && roots.length > 0) {
      el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    }
  }, [roots]);

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
  const selected =
    roots && selectedId ? findNode(roots, selectedId) : null;

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
      className={cn(
        "mx-auto max-w-3xl px-4 pt-5",
        selected ? "pb-64" : "pb-16"
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

      {roots && roots.length > 0 && (
        <>
          <div
            ref={scrollerRef}
            className="overflow-x-auto rounded-2xl border border-paper-deep/70 bg-paper-warm/60 shadow-card"
          >
            <div className="min-w-max px-6 py-8">
              {roots.map((node) => (
                <Branch
                  key={node.id}
                  node={node}
                  selectedId={selectedId}
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
              onSave={async (name, spouse) => {
                await addChild(null, name, spouse, 0);
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
              <div>
                <p className="font-serif text-lg font-medium text-ink">
                  {selected.name}
                  {selected.spouse_name ? ` & ${selected.spouse_name}` : ""}
                </p>
                {selected.parents_of && (
                  <p className="text-xs text-ink-faint">Ancestor card</p>
                )}
              </div>
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
                <Button
                  size="sm"
                  onClick={() => setPanel({ view: "addChild" })}
                >
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
                    const others = countAll(selected) - 1 -
                      (selected.spouse_name?.trim() ? 1 : 0);
                    const extra =
                      others > 0
                        ? ` Their whole branch (${others} more ${others === 1 ? "person" : "people"}) goes too.`
                        : "";
                    if (confirm(`Remove ${selected.name} from the tree?${extra}`)) {
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
                onSave={async (name, spouse) => {
                  await addChild(
                    selected.id,
                    name,
                    spouse,
                    selected.children.length
                  );
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
                onSave={async (name, spouse) => {
                  await addParents(selected.id, panel.side, name, spouse);
                  close();
                }}
                onCancel={() => setPanel({ view: "actions" })}
              />
            )}

            {panel.view === "edit" && (
              <PersonForm
                title="Edit"
                initialName={selected.name}
                initialSpouse={selected.spouse_name ?? ""}
                onSave={async (name, spouse) => {
                  await updatePerson(selected.id, name, spouse);
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

/** A card plus any ancestor cards stacked above it, with connector lines. */
function CardWithAncestors({
  node,
  label,
  selectedId,
  onSelect,
}: {
  node: TreeNode;
  label?: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const ancestors = [
    node.parentsSelf && {
      node: node.parentsSelf,
      label: `${firstName(node.name)}'s parents`,
    },
    node.parentsSpouse &&
      node.spouse_name && {
        node: node.parentsSpouse,
        label: `${firstName(node.spouse_name)}'s parents`,
      },
  ].filter(Boolean) as Array<{ node: TreeNode; label: string }>;

  return (
    <div className="tree-branch">
      {ancestors.length > 0 && (
        <div className="tree-children">
          {ancestors.map(({ node: a, label: l }) => (
            <div key={a.id} className="tree-parent">
              <CardWithAncestors
                node={a}
                label={l}
                selectedId={selectedId}
                onSelect={onSelect}
              />
            </div>
          ))}
        </div>
      )}
      <CoupleCard
        node={node}
        label={label}
        selected={selectedId === node.id}
        onSelect={onSelect}
      />
    </div>
  );
}

function Branch({
  node,
  selectedId,
  onSelect,
}: {
  node: TreeNode;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="tree-branch">
      <CardWithAncestors
        node={node}
        selectedId={selectedId}
        onSelect={onSelect}
      />
      {node.children.length > 0 && (
        <>
          <div className="tree-down" />
          <div className="tree-children">
            {node.children.map((child) => (
              <div key={child.id} className="tree-child">
                <Branch
                  node={child}
                  selectedId={selectedId}
                  onSelect={onSelect}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CoupleCard({
  node,
  label,
  selected,
  onSelect,
}: {
  node: TreeNode;
  label?: string;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-col items-center">
      {label && (
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-ink-faint">
          {label}
        </p>
      )}
      <button
        onClick={() => onSelect(node.id)}
        className={cn(
          "flex items-center gap-1 rounded-2xl border bg-white px-3 py-2.5 text-left shadow-card transition-shadow hover:shadow-card-hover",
          selected
            ? "border-accent ring-2 ring-accent/40"
            : "border-paper-deep/60"
        )}
      >
        <PersonBadge name={node.name} primary />
        {node.spouse_name && (
          <>
            <Heart className="mx-0.5 h-3.5 w-3.5 shrink-0 fill-accent text-accent" />
            <PersonBadge name={node.spouse_name} />
          </>
        )}
      </button>
    </div>
  );
}

function PersonBadge({ name, primary }: { name: string; primary?: boolean }) {
  return (
    <span className="flex w-24 flex-col items-center gap-1">
      <span
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-full font-serif text-sm font-semibold shadow-sm",
          primary
            ? "bg-gradient-to-br from-accent to-accent-dark text-white"
            : "border border-accent/30 bg-accent/10 text-accent-dark"
        )}
      >
        {initials(name)}
      </span>
      <span className="line-clamp-2 text-center text-xs font-medium leading-tight text-ink">
        {name}
      </span>
    </span>
  );
}

function PersonForm({
  title,
  initialName = "",
  initialSpouse = "",
  onSave,
  onCancel,
}: {
  title: string;
  initialName?: string;
  initialSpouse?: string;
  onSave: (name: string, spouse: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [spouse, setSpouse] = useState(initialSpouse);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(name, spouse);
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
        <Input
          autoFocus
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <Input
          placeholder="Spouse or partner (optional)"
          value={spouse}
          onChange={(e) => setSpouse(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={submit} disabled={!name.trim() || saving}>
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

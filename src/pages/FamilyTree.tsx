import { useState } from "react";
import {
  TreeDeciduous,
  Heart,
  Plus,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useFamilyTree, type TreeNode } from "@/hooks/useFamilyTree";

export default function FamilyTree() {
  const { isFamily } = useAuth();
  const { roots, peopleCount, error, addChild, updatePerson, removePerson } =
    useFamilyTree();
  const [addingRoot, setAddingRoot] = useState(false);

  const generations = roots ? maxDepth(roots) : 0;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-5">
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
      {!roots && !error && (
        <p className="text-center text-ink-soft">Loading…</p>
      )}

      {roots && (
        <div className="space-y-4">
          {roots.map((node) => (
            <Branch
              key={node.id}
              node={node}
              canEdit={isFamily}
              addChild={addChild}
              updatePerson={updatePerson}
              removePerson={removePerson}
            />
          ))}

          {roots.length === 0 &&
            isFamily &&
            (addingRoot ? (
              <Card className="p-3">
                <PersonForm
                  title="First person"
                  onSave={async (name, spouse) => {
                    await addChild(null, name, spouse, 0);
                    setAddingRoot(false);
                  }}
                  onCancel={() => setAddingRoot(false)}
                />
              </Card>
            ) : (
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setAddingRoot(true)}
              >
                <Plus className="h-4 w-4" /> Add the first person
              </Button>
            ))}
        </div>
      )}
    </main>
  );
}

function maxDepth(nodes: TreeNode[]): number {
  let deepest = 0;
  for (const n of nodes) deepest = Math.max(deepest, 1 + maxDepth(n.children));
  return deepest;
}

function countPeople(node: TreeNode): number {
  return (
    1 +
    (node.spouse_name?.trim() ? 1 : 0) +
    node.children.reduce((sum, c) => sum + countPeople(c), 0)
  );
}

function Branch({
  node,
  canEdit,
  addChild,
  updatePerson,
  removePerson,
}: {
  node: TreeNode;
  canEdit: boolean;
  addChild: (
    parentId: string | null,
    name: string,
    spouse: string,
    siblingCount: number
  ) => Promise<void>;
  updatePerson: (id: string, name: string, spouse: string) => Promise<void>;
  removePerson: (id: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "addChild">("view");

  const confirmRemove = () => {
    const below = countPeople(node) - 1 - (node.spouse_name?.trim() ? 1 : 0);
    const extra =
      below > 0
        ? ` This also removes the ${below} ${below === 1 ? "person" : "people"} in their branch.`
        : "";
    if (confirm(`Remove ${node.name} from the tree?${extra}`))
      removePerson(node.id);
  };

  return (
    <div>
      <Card className="p-4">
        {mode === "edit" ? (
          <PersonForm
            title="Edit"
            initialName={node.name}
            initialSpouse={node.spouse_name ?? ""}
            onSave={async (name, spouse) => {
              await updatePerson(node.id, name, spouse);
              setMode("view");
            }}
            onCancel={() => setMode("view")}
          />
        ) : (
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="font-serif text-lg font-medium text-ink">
                {node.name}
              </span>
              {node.spouse_name && (
                <>
                  <Heart className="h-3.5 w-3.5 shrink-0 fill-accent text-accent" />
                  <span className="font-serif text-lg font-medium text-ink">
                    {node.spouse_name}
                  </span>
                </>
              )}
            </div>
            {canEdit && (
              <div className="flex shrink-0 items-center">
                <button
                  aria-label={`Add child of ${node.name}`}
                  title="Add child"
                  onClick={() => setMode("addChild")}
                  className="rounded-lg p-2 text-accent-dark hover:bg-paper-warm"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <button
                  aria-label={`Edit ${node.name}`}
                  title="Edit"
                  onClick={() => setMode("edit")}
                  className="rounded-lg p-2 text-ink-faint hover:bg-paper-warm hover:text-ink"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  aria-label={`Remove ${node.name}`}
                  title="Remove"
                  onClick={confirmRemove}
                  className="rounded-lg p-2 text-ink-faint hover:bg-paper-warm hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {mode === "addChild" && (
          <div className="mt-3 border-t border-paper-deep pt-3">
            <PersonForm
              title={`Child of ${node.name}${node.spouse_name ? ` & ${node.spouse_name}` : ""}`}
              onSave={async (name, spouse) => {
                await addChild(node.id, name, spouse, node.children.length);
                setMode("view");
              }}
              onCancel={() => setMode("view")}
            />
          </div>
        )}
      </Card>

      {node.children.length > 0 && (
        <div className="ml-4 mt-3 space-y-3 border-l-2 border-paper-deep pl-3 sm:ml-6 sm:pl-4">
          {node.children.map((child) => (
            <Branch
              key={child.id}
              node={child}
              canEdit={canEdit}
              addChild={addChild}
              updatePerson={updatePerson}
              removePerson={removePerson}
            />
          ))}
        </div>
      )}
    </div>
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
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
          {title}
        </p>
        <button
          aria-label="Cancel"
          onClick={onCancel}
          className="p-1 text-ink-faint hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
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

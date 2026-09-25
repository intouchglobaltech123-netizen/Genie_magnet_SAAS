"use client";

import { Avatar } from "@/components/ui/avatar";
import { personById } from "@/lib/mock/core";
import type { Person } from "@/lib/types";
import { cn } from "@/lib/utils";

interface OrgNode {
  id: string;
  children?: OrgNode[];
}

const tree: OrgNode = {
  id: "p-jana",
  children: [
    {
      id: "p-ashwin",
      children: [
        { id: "p-karthik", children: [{ id: "p-vignesh" }, { id: "p-divya" }, { id: "p-surya" }] },
        { id: "p-priya" },
        { id: "p-meena" },
        { id: "p-harini" },
        { id: "p-naveen" },
      ],
    },
  ],
};

function NodeCard({ person, onSelect, root }: { person: Person; onSelect: (p: Person) => void; root?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(person)}
      className={cn(
        "group relative flex w-40 cursor-pointer flex-col items-center gap-1.5 rounded-xl border bg-card px-3 py-3 text-center shadow-card transition hover:-translate-y-0.5 hover:border-primary/40",
        root ? "border-primary/40 ring-4 ring-primary-soft" : "border-border",
      )}
    >
      <Avatar name={person.name} size="md" />
      <div className="w-full">
        <div className="truncate text-body font-semibold">{person.name}</div>
        <div className="truncate text-body text-muted-foreground">{person.role}</div>
      </div>
      {person.status !== "active" && (
        <span className="absolute right-2 top-2 size-2 rounded-full bg-warning ring-2 ring-card" title="On leave" />
      )}
    </button>
  );
}

function Branch({ node, onSelect, depth = 0 }: { node: OrgNode; onSelect: (p: Person) => void; depth?: number }) {
  const person = personById(node.id);
  const kids = node.children ?? [];
  return (
    <div className="flex flex-col items-center">
      <NodeCard person={person} onSelect={onSelect} root={depth === 0} />
      {kids.length > 0 && (
        <>
          <span className="h-5 w-px bg-border" />
          <div className="flex items-start">
            {kids.map((k, i) => {
              const only = kids.length === 1;
              const first = i === 0;
              const last = i === kids.length - 1;
              return (
                <div key={k.id} className="relative flex flex-col items-center px-2 pt-5">
                  {!only && (
                    <span
                      className={cn(
                        "absolute top-0 h-px bg-border",
                        first ? "left-1/2 right-0" : last ? "left-0 right-1/2" : "left-0 right-0",
                      )}
                    />
                  )}
                  <span className="absolute left-1/2 top-0 h-5 w-px bg-border" />
                  <Branch node={k} onSelect={onSelect} depth={depth + 1} />
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export function OrgChart({ onSelect }: { onSelect: (p: Person) => void }) {
  return (
    <div className="scrollbar-thin overflow-x-auto pb-2">
      <div className="mx-auto w-max px-2 py-4">
        <Branch node={tree} onSelect={onSelect} />
      </div>
    </div>
  );
}

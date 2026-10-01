"use client";

import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { type AreaKey, type AuditPage, PERMISSION_AREAS, type PermissionMatrix } from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { Select } from "@/components/ui/select";
import { api, errorMessage } from "./api";
import { roleLabel } from "./auth-pages";

type Entry = AuditPage["items"][number];

const ENTITIES: Record<string, string> = {
  client: "client",
  role: "role",
  membership: "team member",
  invitation: "invitation",
  agency: "agency",
};
const VERBS: Record<string, string> = {
  create: "added",
  update: "changed",
  delete: "removed",
  cancel: "cancelled",
  accept: "accepted",
  reject: "declined",
  seed: "loaded the sample data for this",
};
const areaLabel = new Map<string, string>(PERMISSION_AREAS.map((a) => [a.key, a.label]));
const LEVEL: Record<string, string> = { none: "No access", view: "View", edit: "View and change", approve: "Change and approve" };
const grantText = (g: PermissionMatrix[AreaKey]) => (g ? `${LEVEL[g.level] ?? g.level}${g.scope === "own" ? " (only their own)" : ""}` : LEVEL.none!);

const show = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

/** The record's name, from whatever the entry carries. */
function subject(e: Entry) {
  const v = { ...(e.before ?? {}), ...(e.after ?? {}) } as Record<string, unknown>;
  return (v.name ?? v.email ?? v.code ?? "") as string;
}

/** Plain-language lines for what changed: "Role: Editor → Team leader", "Clients: View → View and change". */
function details(e: Entry): string[] {
  const before = e.before ?? {};
  const after = e.after ?? {};
  const lines: string[] = [];
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (key === "name" && before.name === after.name) continue;
    if (["userId", "membershipId", "sampleData"].includes(key)) continue;
    if (key === "permissions") {
      const b = (before.permissions ?? {}) as PermissionMatrix;
      const a = (after.permissions ?? {}) as PermissionMatrix;
      for (const area of new Set([...Object.keys(b), ...Object.keys(a)]) as Set<AreaKey>) {
        const from = grantText(b[area]);
        const to = grantText(a[area]);
        if (from !== to) lines.push(`${areaLabel.get(area) ?? area}: ${e.action === "create" ? to : `${from} → ${to}`}`);
      }
      continue;
    }
    const fmt = (v: unknown) => (key === "role" && typeof v === "string" ? roleLabel(v) : show(v));
    const label = key.replace(/([A-Z])/g, " $1").replace(/^\w/, (c) => c.toUpperCase());
    if (key in before && key in after) lines.push(`${label}: ${fmt(before[key])} → ${fmt(after[key])}`);
    else lines.push(`${label}: ${fmt(key in after ? after[key] : before[key])}`);
  }
  return lines;
}

export function LiveAudit() {
  const [entity, setEntity] = useState("all");
  const log = useInfiniteQuery({
    queryKey: ["audit-log", entity],
    initialPageParam: "",
    queryFn: ({ pageParam }) => {
      const q = new URLSearchParams({ limit: "50" });
      if (entity !== "all") q.set("entity", entity);
      if (pageParam) q.set("cursor", pageParam);
      return api<AuditPage>(`/audit?${q}`);
    },
    getNextPageParam: (last) => last.next ?? undefined,
  });
  const entries = log.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Who changed what, and when. Entries can never be edited or deleted."
        actions={
          <Select
            className="w-48"
            value={entity}
            onValueChange={setEntity}
            aria-label="Show"
            options={[
              { value: "all", label: "Everything" },
              ...Object.entries(ENTITIES).map(([value, label]) => ({ value, label: `${label[0]!.toUpperCase()}${label.slice(1)}s` })),
            ]}
          />
        }
      />
      <Card className="overflow-hidden">
        {log.isPending ? (
          <div className="p-4">
            <SkeletonRows rows={8} />
          </div>
        ) : log.error ? (
          <div className="p-4">
            <Alert tone="danger">{errorMessage(log.error)}</Alert>
          </div>
        ) : !entries.length ? (
          <EmptyState icon={History} title="Nothing recorded yet" />
        ) : (
          <ul className="divide-y divide-border-subtle">
            {entries.map((e) => {
              const who = e.actor?.name ?? (e.actor ? "A former member" : "The system");
              const lines = details(e);
              return (
                <li key={e.id} className="flex gap-3 px-4 py-3">
                  <Avatar name={who} size="sm" className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-body">
                      <span className="font-medium">{who}</span> {VERBS[e.action] ?? e.action} {ENTITIES[e.entity] ?? e.entity}{" "}
                      {subject(e) && <span className="font-medium">{subject(e)}</span>}
                    </p>
                    {lines.length > 0 && (
                      <ul className="mt-1 space-y-0.5 text-body text-muted-foreground">
                        {lines.map((l) => (
                          <li key={l}>{l}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <time className="shrink-0 text-body text-muted-foreground" dateTime={e.at}>
                    {new Date(e.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </time>
                </li>
              );
            })}
          </ul>
        )}
        {log.hasNextPage && (
          <div className="border-t border-border-subtle p-3 text-center">
            <Button variant="secondary" size="sm" disabled={log.isFetchingNextPage} onClick={() => log.fetchNextPage()}>
              {log.isFetchingNextPage ? "Loading…" : "Show older"}
            </Button>
          </div>
        )}
      </Card>
    </>
  );
}

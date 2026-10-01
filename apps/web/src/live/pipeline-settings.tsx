"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Lock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { type PipelineStage, pipelineInput } from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/card";
import { Alert, SkeletonRows } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { errorMessage } from "./api";
import { useCan, useLeads, useSaveStages, useStages } from "./queries";

type Row = { key?: string; name: string; probability: string };
const rowsOf = (stages: PipelineStage[]): Row[] =>
  stages.filter((s) => s.kind === "open").map((s) => ({ key: s.key, name: s.name, probability: String(s.probability) }));

function Editor({ stages, canEdit }: { stages: PipelineStage[]; canEdit: boolean }) {
  const save = useSaveStages();
  const can = useCan();
  const leads = useLeads(can("crm", "view"));
  const [rows, setRows] = useState<Row[]>(() => rowsOf(stages));
  const [error, setError] = useState<string | null>(null);
  const counts = new Map<string, number>();
  for (const l of leads.data ?? []) counts.set(l.stage, (counts.get(l.stage) ?? 0) + 1);
  const dirty = JSON.stringify(rows) !== JSON.stringify(rowsOf(stages));
  const fixed = stages.filter((s) => s.kind !== "open");
  const swap = (i: number, j: number) => {
    const next = [...rows];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setRows(next);
  };

  return (
    <SectionCard
      title="Stages"
      description="In the order a deal moves. The chance of winning at each stage gives the weighted pipeline. A stage with leads in it cannot be removed — move them first."
    >
      <ol className="space-y-2">
        {rows.map((r, i) => {
          const inUse = r.key ? (counts.get(r.key) ?? 0) : 0;
          return (
            <li key={r.key ?? `new-${i}`} className="grid grid-cols-[1fr_110px_auto] items-center gap-2 sm:grid-cols-[1fr_130px_auto]">
              <Input
                aria-label={`Stage ${i + 1} name`}
                value={r.name}
                disabled={!canEdit}
                onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
              />
              <div className="flex items-center gap-1">
                <Input
                  aria-label={`Chance of winning at ${r.name || `stage ${i + 1}`}`}
                  type="number"
                  min={0}
                  max={99}
                  value={r.probability}
                  disabled={!canEdit}
                  onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, probability: e.target.value } : x)))}
                />
                <span className="text-body text-muted-foreground">%</span>
              </div>
              {canEdit ? (
                <div className="flex">
                  <Button variant="ghost" size="icon-sm" aria-label="Move up" disabled={i === 0} onClick={() => swap(i, i - 1)}>
                    <ArrowUp />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label="Move down" disabled={i === rows.length - 1} onClick={() => swap(i, i + 1)}>
                    <ArrowDown />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${r.name}`}
                    title={inUse ? `${inUse} leads are in this stage — move them first` : undefined}
                    disabled={!!inUse || rows.length === 1}
                    onClick={() => setRows(rows.filter((_, j) => j !== i))}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ) : (
                <span />
              )}
            </li>
          );
        })}
        {fixed.map((s) => (
          <li key={s.key} className="grid grid-cols-[1fr_110px_auto] items-center gap-2 opacity-70 sm:grid-cols-[1fr_130px_auto]">
            <div className="flex h-9 items-center gap-2 rounded-lg border border-dashed border-border px-3 text-body">
              <Lock className="size-3.5" /> {s.name}
            </div>
            <span className="text-body text-muted-foreground">{s.probability}%</span>
            <Badge tone="neutral">Always last</Badge>
          </li>
        ))}
      </ol>
      {canEdit && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" disabled={rows.length >= 12} onClick={() => setRows([...rows, { name: "", probability: "50" }])}>
            <Plus />
            Add a stage
          </Button>
          {error && <span className="text-body text-danger">{error}</span>}
          <Button variant="secondary" className="ml-auto" disabled={!dirty} onClick={() => (setRows(rowsOf(stages)), setError(null))}>
            Undo changes
          </Button>
          <Button
            disabled={!dirty || save.isPending}
            onClick={() => {
              const parsed = pipelineInput.safeParse({ stages: rows.map((r) => ({ key: r.key, name: r.name, probability: Number(r.probability) })) });
              if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Check the stages");
              setError(null);
              save.mutate(parsed.data, {
                onSuccess: (s) => {
                  setRows(rowsOf(s));
                  toast.success("Pipeline saved");
                },
                onError: (e) => setError(errorMessage(e)),
              });
            }}
          >
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      )}
    </SectionCard>
  );
}

export function LivePipelineSettings() {
  const can = useCan();
  const stages = useStages();
  return (
    <>
      <PageHeader title="Pipeline stages" description="The steps a lead goes through to become a client. Won and Lost are always there." />
      {stages.isPending ? (
        <SkeletonRows rows={6} />
      ) : stages.error ? (
        <Alert tone="danger">{errorMessage(stages.error)}</Alert>
      ) : (
        <>
          {!can("settings", "edit") && (
            <Alert tone="info" className="mb-4">
              You can see the stages; an owner or manager can change them.
            </Alert>
          )}
          <Editor key={stages.data.map((s) => s.key).join()} stages={stages.data} canEdit={can("settings", "edit")} />
        </>
      )}
    </>
  );
}

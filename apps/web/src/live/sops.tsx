"use client";

import { useState } from "react";
import { ArrowLeft, Check, ClipboardCheck, FileText, Plus, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { RUN_RESULT_LABEL, RUN_RESULTS, type RunResult, SOP_VERSION_STATUS_LABEL, type SopRow, type SopRunRow, type SopVersionRow } from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, SectionCard } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { errorMessage } from "./api";
import { useCan, useDepartments, useKraTemplates, useMe, usePeople, useSop, useSopAction, useSopRuns, useSops } from "./queries";

const onError = (e: unknown) => toast.error(errorMessage(e));
const newKey = () => Math.random().toString(36).slice(2, 10);
const RUN_TONE: Record<SopRunRow["status"], BadgeTone> = { submitted: "info", passed: "success", failed: "danger" };
const RUN_LABEL: Record<SopRunRow["status"], string> = { submitted: "To check", passed: "Passed", failed: "Failed" };

function SopForm({ sop, onClose, onSaved }: { sop: SopRow | null; onClose: () => void; onSaved?: (id: string) => void }) {
  const act = useSopAction();
  const deps = useDepartments();
  const people = usePeople();
  const templates = useKraTemplates();
  const s = sop;
  const [f, setF] = useState({
    title: s?.title ?? "",
    departmentId: s?.department?.id ?? "",
    ownerId: s?.owner?.id ?? "",
    kraTemplateId: s?.kra?.templateId ?? "",
    kraKey: s?.kra?.key ?? "",
    doerIds: s?.doers.map((d) => d.id) ?? [],
    checkerId: s?.checker?.id ?? "",
    approverId: s?.approver?.id ?? "",
    active: s?.active ?? true,
  });
  const person = (k: "ownerId" | "checkerId" | "approverId", label: string) => (
    <Field label={label}>
      <Select
        value={f[k] || "_none"}
        onValueChange={(v) => setF({ ...f, [k]: v === "_none" ? "" : v })}
        options={[{ value: "_none", label: "No one" }, ...(people.data ?? []).map((p) => ({ value: p.user.id, label: p.user.name }))]}
      />
    </Field>
  );
  const template = templates.data?.find((t) => t.id === f.kraTemplateId);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{s ? `Change “${s.title}”` : "New SOP"}</DialogTitle>
          <DialogDescription>Who does it, who checks each run and who approves each version, and the KRA it serves.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Title" className="sm:col-span-2">
              <Input value={f.title} placeholder="e.g. Shoot kit check" onChange={(e) => setF({ ...f, title: e.target.value })} />
            </Field>
            <Field label="Department">
              <Select
                value={f.departmentId || "_none"}
                onValueChange={(v) => setF({ ...f, departmentId: v === "_none" ? "" : v })}
                options={[{ value: "_none", label: "None" }, ...(deps.data ?? []).map((d) => ({ value: d.id, label: d.name }))]}
              />
            </Field>
            {person("ownerId", "Owner (keeps it up to date)")}
            {person("checkerId", "Checker (checks each run)")}
            {person("approverId", "Approver (approves each version)")}
            <Field label="KRA template">
              <Select
                value={f.kraTemplateId || "_none"}
                onValueChange={(v) => setF({ ...f, kraTemplateId: v === "_none" ? "" : v, kraKey: "" })}
                options={[{ value: "_none", label: "None" }, ...(templates.data ?? []).map((t) => ({ value: t.id, label: t.name }))]}
              />
            </Field>
            {template && (
              <Field label="KRA">
                <Select
                  value={f.kraKey || undefined}
                  placeholder="Choose"
                  onValueChange={(v) => setF({ ...f, kraKey: v })}
                  options={template.kras.map((k) => ({ value: k.key, label: k.name }))}
                />
              </Field>
            )}
          </div>
          <div>
            <div className="mb-1 text-body font-medium">Who does it</div>
            <div className="grid gap-1 sm:grid-cols-3">
              {(people.data ?? []).map((p) => (
                <label key={p.user.id} className="flex items-center gap-1.5 text-body">
                  <Checkbox
                    aria-label={p.user.name}
                    checked={f.doerIds.includes(p.user.id)}
                    onCheckedChange={(c) => setF({ ...f, doerIds: c === true ? [...f.doerIds, p.user.id] : f.doerIds.filter((x) => x !== p.user.id) })}
                  />
                  {p.user.name}
                </label>
              ))}
            </div>
          </div>
          {s && (
            <label className="flex items-center gap-2 text-body">
              <Switch aria-label="In use" checked={f.active} onCheckedChange={(active) => setF({ ...f, active })} />
              In use
            </label>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={f.title.trim().length < 3 || act.isPending}
            onClick={() =>
              act.mutate(
                {
                  step: "save",
                  id: s?.id,
                  body: {
                    ...f,
                    departmentId: f.departmentId || null,
                    ownerId: f.ownerId || null,
                    kraTemplateId: f.kraTemplateId || null,
                    kraKey: f.kraKey || null,
                    checkerId: f.checkerId || null,
                    approverId: f.approverId || null,
                  },
                },
                { onSuccess: (r) => (toast.success("Saved"), onClose(), onSaved?.((r as SopRow).id)), onError },
              )
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VersionDoc({ v }: { v: SopVersionRow }) {
  return (
    <div className="space-y-3 text-body">
      {v.purpose && (
        <p>
          <span className="font-medium">Why: </span>
          {v.purpose}
        </p>
      )}
      {v.scope && (
        <p>
          <span className="font-medium">When and where: </span>
          {v.scope}
        </p>
      )}
      {v.steps.length > 0 && (
        <ol className="list-decimal space-y-0.5 pl-5">
          {v.steps.map((s, i) => (
            <li key={i}>{s.text}</li>
          ))}
        </ol>
      )}
      {v.checklist.length > 0 && (
        <div>
          <div className="mb-1 font-medium">Checklist</div>
          <ul className="space-y-0.5">
            {v.checklist.map((c) => (
              <li key={c.key} className="flex items-center gap-2">
                <ClipboardCheck className="size-4 text-muted-foreground" />
                {c.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DraftEditor({ sop, v }: { sop: SopRow; v: SopVersionRow }) {
  const me = useMe().data!;
  const can = useCan();
  const act = useSopAction();
  const [purpose, setPurpose] = useState(v.purpose);
  const [scope, setScope] = useState(v.scope);
  const [steps, setSteps] = useState(v.steps.map((s) => s.text));
  const [checks, setChecks] = useState(v.checklist);
  const [changeNote, setChangeNote] = useState(v.changeNote);
  const [note, setNote] = useState("");
  const keeps = can("reports", "edit") || sop.owner?.id === me.user.id;
  const approves = sop.approver ? sop.approver.id === me.user.id || can("reports", "approve") : can("reports", "approve");
  if (v.status === "in_review")
    return (
      <SectionCard title={`Version ${v.number} — waiting for approval`} description={v.changeNote || undefined}>
        <VersionDoc v={v} />
        {approves && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Input className="max-w-sm" placeholder="What to change (to send it back)" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button variant="ghost" disabled={!note.trim()} onClick={() => act.mutate({ step: "decide", versionId: v.id, approved: false, note }, { onError })}>
              <X />
              Send back
            </Button>
            <Button
              variant="success"
              onClick={() =>
                act.mutate({ step: "decide", versionId: v.id, approved: true, note: "" }, { onSuccess: () => toast.success("Approved — in use now"), onError })
              }
            >
              <Check />
              Approve
            </Button>
          </div>
        )}
      </SectionCard>
    );
  if (!keeps) return null;
  const save = (then?: () => void) =>
    act.mutate(
      {
        step: "version",
        versionId: v.id,
        body: { purpose, scope, steps: steps.filter((s) => s.trim()).map((text) => ({ text })), checklist: checks.filter((c) => c.text.trim()), changeNote },
      },
      { onSuccess: () => (then ? then() : toast.success("Saved")), onError },
    );
  return (
    <SectionCard title={`Version ${v.number} — draft`}>
      <div className="space-y-3">
        <Field label="Why">
          <Textarea rows={2} value={purpose} onChange={(e) => setPurpose(e.target.value)} />
        </Field>
        <Field label="When and where it applies">
          <Textarea rows={2} value={scope} onChange={(e) => setScope(e.target.value)} />
        </Field>
        <div>
          <div className="mb-1 text-body font-medium">Steps</div>
          <div className="space-y-2">
            {steps.map((s, i) => (
              <div key={i} className="flex gap-2">
                <span className="w-6 pt-2 text-right text-body text-muted-foreground">{i + 1}.</span>
                <Input value={s} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? e.target.value : x)))} />
                <Button size="icon-sm" variant="ghost" aria-label="Remove step" onClick={() => setSteps(steps.filter((_, j) => j !== i))}>
                  <Trash2 />
                </Button>
              </div>
            ))}
            <Button size="sm" variant="secondary" onClick={() => setSteps([...steps, ""])}>
              <Plus />
              Add a step
            </Button>
          </div>
        </div>
        <div>
          <div className="mb-1 text-body font-medium">Checklist</div>
          <div className="space-y-2">
            {checks.map((c, i) => (
              <div key={c.key} className="flex gap-2">
                <Input value={c.text} onChange={(e) => setChecks(checks.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
                <Button size="icon-sm" variant="ghost" aria-label="Remove check" onClick={() => setChecks(checks.filter((_, j) => j !== i))}>
                  <Trash2 />
                </Button>
              </div>
            ))}
            <Button size="sm" variant="secondary" onClick={() => setChecks([...checks, { key: newKey(), text: "" }])}>
              <Plus />
              Add a check
            </Button>
          </div>
        </div>
        {v.number > 1 && (
          <Field label="What changed">
            <Input value={changeNote} onChange={(e) => setChangeNote(e.target.value)} />
          </Field>
        )}
        <div className="flex gap-2">
          <Button variant="secondary" disabled={act.isPending} onClick={() => save()}>
            Save
          </Button>
          <Button
            disabled={act.isPending}
            onClick={() => save(() => act.mutate({ step: "submit", versionId: v.id }, { onSuccess: () => toast.success("Sent for approval"), onError }))}
          >
            <Send />
            Send for approval
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}

function RunDialog({ sop, onClose }: { sop: SopRow; onClose: () => void }) {
  const act = useSopAction();
  const checks = sop.current!.checklist;
  const [results, setResults] = useState<Record<string, { result: RunResult | ""; note: string }>>(
    Object.fromEntries(checks.map((c) => [c.key, { result: "", note: "" }])),
  );
  const [about, setAbout] = useState("");
  const complete = checks.every((c) => results[c.key]?.result);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{sop.title}</DialogTitle>
          <DialogDescription>
            Version {sop.current!.number}. {sop.checker ? `${sop.checker.name} checks it.` : "Someone who keeps SOPs checks it."}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <Field label="For">
            <Input placeholder="e.g. Lakshmi Textiles shoot, 5 Oct" value={about} onChange={(e) => setAbout(e.target.value)} />
          </Field>
          {checks.map((c) => (
            <div key={c.key} className="rounded-xl border border-border p-3">
              <div className="mb-2 text-body font-medium">{c.text}</div>
              <div className="flex flex-wrap gap-1.5">
                {RUN_RESULTS.map((r) => (
                  <Button
                    key={r}
                    size="xs"
                    variant={results[c.key]?.result === r ? (r === "not_done" ? "danger" : "default") : "secondary"}
                    onClick={() => setResults({ ...results, [c.key]: { ...results[c.key]!, result: r } })}
                  >
                    {RUN_RESULT_LABEL[r]}
                  </Button>
                ))}
              </div>
              {results[c.key]?.result === "not_done" && (
                <Input
                  className="mt-2"
                  placeholder="Why"
                  value={results[c.key]!.note}
                  onChange={(e) => setResults({ ...results, [c.key]: { ...results[c.key]!, note: e.target.value } })}
                />
              )}
            </div>
          ))}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!complete || act.isPending}
            onClick={() =>
              act.mutate(
                {
                  step: "run",
                  id: sop.id,
                  body: { about, items: checks.map((c) => ({ key: c.key, result: results[c.key]!.result as RunResult, note: results[c.key]!.note })) },
                },
                { onSuccess: () => (toast.success("Sent to be checked"), onClose()), onError },
              )
            }
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RunList({ runs, checking }: { runs: SopRunRow[]; checking: boolean }) {
  const act = useSopAction();
  const [notes, setNotes] = useState<Record<string, string>>({});
  if (!runs.length) return <p className="text-body text-muted-foreground">None.</p>;
  return (
    <ul className="space-y-2">
      {runs.map((r) => (
        <li key={r.id} className="rounded-xl border border-border p-3 text-body">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <span>
              <span className="font-medium">{r.sop.title}</span>
              {r.about && ` — ${r.about}`}
              <span className="block text-muted-foreground">
                {r.by.name} · {new Date(r.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} · version{" "}
                {r.version}
              </span>
            </span>
            <Badge tone={RUN_TONE[r.status]}>{RUN_LABEL[r.status]}</Badge>
          </div>
          <ul className="mt-2 space-y-0.5">
            {r.items.map((i) => (
              <li key={i.key} className={cn(i.result === "not_done" && "text-danger")}>
                {i.result === "done" ? "✓" : i.result === "na" ? "–" : "✗"} {i.text}
                {i.note && <span className="text-muted-foreground"> · {i.note}</span>}
              </li>
            ))}
          </ul>
          {r.checkNote && (
            <p className="mt-1 text-muted-foreground">
              Checked by {r.checkedBy}: {r.checkNote}
            </p>
          )}
          {checking && r.status === "submitted" && (
            <div className="mt-2 flex flex-wrap gap-2">
              <Input
                className="max-w-sm"
                placeholder="What was wrong (to fail it)"
                value={notes[r.id] ?? ""}
                onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
              />
              <Button
                size="xs"
                variant="ghost"
                disabled={!notes[r.id]?.trim()}
                onClick={() => act.mutate({ step: "check", runId: r.id, passed: false, note: notes[r.id]! }, { onError })}
              >
                <X />
                Failed
              </Button>
              <Button
                size="xs"
                variant="success"
                onClick={() => act.mutate({ step: "check", runId: r.id, passed: true, note: notes[r.id] ?? "" }, { onError })}
              >
                <Check />
                Passed
              </Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function SopView({ id, onBack }: { id: string; onBack: () => void }) {
  const can = useCan();
  const me = useMe().data!;
  const q = useSop(id);
  const runs = useSopRuns({ sopId: id });
  const act = useSopAction();
  const [editing, setEditing] = useState(false);
  const [running, setRunning] = useState(false);
  if (q.isPending) return <SkeletonRows rows={6} />;
  if (q.error) return <Alert tone="danger">{errorMessage(q.error)}</Alert>;
  const s = q.data;
  const keeps = can("reports", "edit") || s.owner?.id === me.user.id;
  const mayRun = !!s.current?.checklist.length && s.active && (!s.doers.length || s.doers.some((d) => d.id === me.user.id) || can("reports", "edit"));
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
        <ArrowLeft />
        SOPs
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-subheading font-semibold">{s.title}</h2>
          <p className="text-body text-muted-foreground">
            {[
              s.department?.name,
              s.owner && `owner ${s.owner.name}`,
              s.doers.length && `done by ${s.doers.map((d) => d.name).join(", ")}`,
              s.checker && `checked by ${s.checker.name}`,
              s.approver && `approved by ${s.approver.name}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="text-body text-muted-foreground">{s.kra && `KRA: ${s.kra.name} (${s.kra.template})`}</p>
        </div>
        <span className="flex gap-2">
          {!s.active && <Badge tone="neutral">Not in use</Badge>}
          {can("reports", "edit") && (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Change
            </Button>
          )}
          {keeps && !s.draft && s.current && (
            <Button variant="secondary" onClick={() => act.mutate({ step: "newDraft", id }, { onError })}>
              <FileText />
              New version
            </Button>
          )}
          {mayRun && (
            <Button onClick={() => setRunning(true)}>
              <ClipboardCheck />
              Run the checklist
            </Button>
          )}
        </span>
      </div>
      {s.current ? (
        <SectionCard title={`In use: version ${s.current.number}`} description={s.current.approvedBy ? `Approved by ${s.current.approvedBy}` : undefined}>
          <VersionDoc v={s.current} />
        </SectionCard>
      ) : (
        <Alert tone="info">No version is in use yet.</Alert>
      )}
      {s.draft && <DraftEditor key={s.draft.id + s.draft.status} sop={s} v={s.draft} />}
      {s.versions && s.versions.length > 1 && (
        <SectionCard title="Versions">
          <ul className="space-y-1 text-body">
            {s.versions.map((v) => (
              <li key={v.id}>
                Version {v.number} · {SOP_VERSION_STATUS_LABEL[v.status]}
                {v.changeNote && <span className="text-muted-foreground"> · {v.changeNote.split("\n")[0]}</span>}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
      <SectionCard title="Runs" description={`This month: ${s.runs.month}, ${s.runs.failed} failed`}>
        <RunList runs={runs.data ?? []} checking={s.checker?.id === me.user.id || can("reports", "edit")} />
      </SectionCard>
      {editing && <SopForm sop={s} onClose={() => setEditing(false)} />}
      {running && <RunDialog sop={s} onClose={() => setRunning(false)} />}
    </div>
  );
}

/** /app/sops: the agency's SOPs, their checklists, and checking runs. */
export function LiveSops({ sopId }: { sopId?: string }) {
  const can = useCan();
  const me = useMe().data!;
  const list = useSops();
  const toCheck = useSopRuns({ status: "submitted" });
  const mine = useSopRuns({ mine: true });
  const [tab, setTab] = useState("library");
  const [open, setOpen] = useState<string | null>(sopId ?? null);
  const [making, setMaking] = useState(false);
  return (
    <>
      <PageHeader
        title="SOPs and checklists"
        description="How the agency does each thing — its steps and checklist — approved before use; each run checked, failures counted in the reviews and KRAs."
        actions={
          !open &&
          can("reports", "edit") && (
            <Button onClick={() => setMaking(true)}>
              <Plus />
              New SOP
            </Button>
          )
        }
      />
      {open ? (
        <SopView id={open} onBack={() => setOpen(null)} />
      ) : (
        <>
          <Tabs value={tab} onValueChange={setTab} className="mb-4">
            <TabsList>
              <TabsTrigger value="library">SOPs</TabsTrigger>
              <TabsTrigger value="check">To check{toCheck.data?.length ? ` (${toCheck.data.length})` : ""}</TabsTrigger>
              <TabsTrigger value="mine">My runs</TabsTrigger>
            </TabsList>
          </Tabs>
          {tab === "library" ? (
            list.isPending ? (
              <SkeletonRows rows={4} />
            ) : !list.data?.length ? (
              <EmptyState
                icon={FileText}
                title="No SOPs yet"
                description={can("reports", "edit") ? "Write down how one thing is done, and its checklist." : "SOPs in use show here."}
              />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {list.data.map((s) => (
                  <Card key={s.id} className="cursor-pointer p-4 hover:border-primary/40" onClick={() => setOpen(s.id)}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold">{s.title}</div>
                      {s.current ? <Badge tone="success">v{s.current.number}</Badge> : <Badge tone="neutral">Draft</Badge>}
                    </div>
                    <div className="text-body text-muted-foreground">
                      {[s.department?.name, s.doers.map((d) => d.name).join(", ")].filter(Boolean).join(" · ") || "—"}
                    </div>
                    <div className="mt-1 text-body">
                      {s.current?.checklist.length ?? 0} checks · this month {s.runs.month} runs
                      {s.runs.failed > 0 && <span className="text-danger">, {s.runs.failed} failed</span>}
                    </div>
                    {s.draft?.status === "in_review" && <Badge tone="warning">New version waiting for approval</Badge>}
                  </Card>
                ))}
              </div>
            )
          ) : tab === "check" ? (
            <RunList runs={toCheck.data ?? []} checking />
          ) : (
            <RunList runs={(mine.data ?? []).filter((r) => r.by.id === me.user.id)} checking={false} />
          )}
        </>
      )}
      {making && <SopForm sop={null} onClose={() => setMaking(false)} onSaved={setOpen} />}
    </>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, ChevronDown, ExternalLink, MessageSquare, Plus, Send, ShieldCheck, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import {
  ASPECTS,
  changeRequestInput,
  NEXT_STAGE,
  PLATFORMS,
  REVISION_KIND_KEYS,
  REVISION_KIND_LABEL,
  type RevisionKindKey,
  URGENCIES,
  URGENCY_LABEL,
  VIDEO_STAGE_LABEL,
  type VideoDetail,
  type VideoStageKey,
} from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, SkeletonRows } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ApiError, errorMessage } from "./api";
import { NoteDialog } from "./deals";
import { startFor, UploadButton } from "./files";
import { fmtDate } from "./format";
import { inr, PLATFORM_LABEL } from "./packages";
import { minutes, StageBadge, TimeLog, UrgencyBadge, usePeople, VpBadge } from "./production-bits";
import { useCan, useCreateChangeRequest, useMoveVideo, useProductionSettings, useVideo, useVideoAction } from "./queries";

const VERSION_STATUS: Record<VideoDetail["versions"][number]["status"], { label: string; tone: BadgeTone }> = {
  internal: { label: "Not sent", tone: "neutral" },
  sent: { label: "With the client", tone: "info" },
  changes_requested: { label: "Changes asked", tone: "danger" },
  approved: { label: "Approved", tone: "success" },
};

/** "1:05" → 65 seconds; "" → undefined */
const seconds = (t: string) => {
  if (!t.trim()) return undefined;
  const parts = t.split(":").map(Number);
  if (parts.some((n) => Number.isNaN(n))) return undefined;
  return parts.reduce((n, p) => n * 60 + p, 0);
};
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const toast$ = (p: { onSuccess?: () => void } = {}) => ({ onSuccess: p.onSuccess, onError: (e: unknown) => toast.error(errorMessage(e)) });

// ─── Moving ───────────────────────────────────────────────────────────

function MoveMenu({ v }: { v: VideoDetail }) {
  const move = useMoveVideo();
  const next = NEXT_STAGE[v.stage];
  const nextMove = next && v.moves.find((m) => m.to === next);
  const go = (to: VideoStageKey) => move.mutate({ id: v.id, to }, toast$({ onSuccess: () => toast.success(`Moved to ${VIDEO_STAGE_LABEL[to]}`) }));
  return (
    <>
      {nextMove && next !== "client_review" && next !== "approved" && next !== "published" && (
        <Button disabled={!!nextMove.blocked || move.isPending} title={nextMove.blocked ?? undefined} onClick={() => go(next)}>
          {VIDEO_STAGE_LABEL[next]}
          <ArrowRight />
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary">
            Move to
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel>Move {v.code} to…</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {v.moves.map((m) => (
            <DropdownMenuItem key={m.to} disabled={!!m.blocked} onSelect={() => go(m.to)} className="flex-col items-start">
              <span className="font-medium">{VIDEO_STAGE_LABEL[m.to]}</span>
              {m.blocked && <span className="text-body text-muted-foreground">{m.blocked}</span>}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

// ─── Editing ──────────────────────────────────────────────────────────

function Editing({ v, canEdit }: { v: VideoDetail; canEdit: boolean }) {
  const act = useVideoAction(v.id);
  const [reason, setReason] = useState(v.delayReason ?? "");
  const over = v.plannedMinutes > 0 && v.loggedMinutes > v.plannedMinutes;
  const done = v.editSteps.filter((s) => s.done).length;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SectionCard title="Edit steps" description={`${done} of ${v.editSteps.length} done — all are needed before the quality check.`}>
        <Progress value={(done / Math.max(1, v.editSteps.length)) * 100} tone={done === v.editSteps.length ? "success" : "accent"} className="mb-3" />
        <ul className="grid gap-2 sm:grid-cols-2">
          {v.editSteps.map((s) => (
            <li key={s.step}>
              <label
                className={cn(
                  "flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-body",
                  s.done ? "border-success/30 bg-success-soft/40" : "border-border",
                )}
              >
                <Checkbox
                  checked={s.done}
                  disabled={!canEdit}
                  onCheckedChange={(on) => act.mutate({ path: "/edit-steps", method: "PUT", body: { step: s.step, done: on === true } }, toast$())}
                />
                <span>
                  <span className="font-medium">{s.step}</span>
                  {s.done && s.by?.name && <span className="block text-muted-foreground">{s.by.name}</span>}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </SectionCard>
      <div className="space-y-4">
        <SectionCard title="Footage protected (VP)" description="Raw footage backed up and verified — needed before the video leaves Shot.">
          <label className="flex items-center gap-2 text-body">
            <Checkbox
              checked={v.protected}
              disabled={!canEdit}
              onCheckedChange={(on) => act.mutate({ path: "/protect", method: "PUT", body: { done: on === true } }, toast$())}
            />
            {v.protected
              ? `Protected${v.protectedBy?.name ? ` by ${v.protectedBy.name}` : ""}${v.protectedAt ? ` on ${fmtDate(v.protectedAt)}` : ""}`
              : "Backed up and checked"}
          </label>
        </SectionCard>
        <SectionCard title="Time" description={`${minutes(v.loggedMinutes)} logged of ${minutes(v.plannedMinutes)} planned for a ${v.format.toLowerCase()}.`}>
          <Progress
            value={v.plannedMinutes ? Math.min(100, (v.loggedMinutes / v.plannedMinutes) * 100) : 0}
            tone={over ? "danger" : "accent"}
            className="mb-3"
          />
          <TimeLog
            logs={v.timeLogs}
            canEdit={canEdit}
            onLog={(entry, done) => act.mutate({ path: "/time", body: entry }, toast$({ onSuccess: done }))}
            onRemove={(id) => act.mutate({ path: `/time/${id}`, method: "DELETE" }, toast$())}
          />
          {over && (
            <div className="mt-3 space-y-2">
              <Alert tone="warning">Over the planned time — give the reason before the video moves on.</Alert>
              <Textarea rows={2} value={reason} disabled={!canEdit} onChange={(e) => setReason(e.target.value)} aria-label="Reason for the extra time" />
              {canEdit && (
                <Button
                  size="sm"
                  disabled={reason === (v.delayReason ?? "")}
                  onClick={() => act.mutate({ path: "", method: "PATCH", body: { delayReason: reason } }, toast$({ onSuccess: () => toast.success("Saved") }))}
                >
                  Save the reason
                </Button>
              )}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

// ─── Quality check ────────────────────────────────────────────────────

function Qc({ v, canApprove }: { v: VideoDetail; canApprove: boolean }) {
  const act = useVideoAction(v.id);
  const [failing, setFailing] = useState<string | null>(null);
  const passed = v.qc.filter((c) => c.result === "pass").length;
  const set = (check: string, result: "pass" | "fail" | null, note?: string) =>
    act.mutate({ path: "/qc", method: "PUT", body: { check, result, note } }, toast$());
  return (
    <SectionCard
      title="Internal quality check"
      description={
        canApprove
          ? `${passed} of ${v.qc.length} passed. A failed check holds the video and goes back to the editor.`
          : "Done by people who may approve production."
      }
      actions={
        canApprove &&
        v.stage === "internal_qc" &&
        passed < v.qc.length &&
        !v.qc.some((c) => c.result === "fail") && (
          <Button size="sm" variant="success" onClick={() => v.qc.filter((c) => !c.result).forEach((c) => set(c.key, "pass"))}>
            <Check />
            Pass the rest
          </Button>
        )
      }
    >
      <ul className="divide-y divide-border-subtle">
        {v.qc.map((c) => (
          <li key={c.key} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="text-body font-medium">{c.label}</span>
              <span className="block text-body text-muted-foreground">{c.hint}</span>
              {c.result === "fail" && c.note && <span className="mt-1 block text-body text-danger">To fix: {c.note}</span>}
              {c.result && c.by?.name && (
                <span className="block text-body text-muted-foreground">{`${c.result === "pass" ? "Passed" : "Failed"} by ${c.by.name}`}</span>
              )}
            </span>
            {canApprove ? (
              <span className="flex gap-1.5">
                <Button size="xs" variant={c.result === "pass" ? "success" : "secondary"} onClick={() => set(c.key, c.result === "pass" ? null : "pass")}>
                  <ThumbsUp />
                  Pass
                </Button>
                <Button
                  size="xs"
                  variant={c.result === "fail" ? "danger" : "ghost"}
                  onClick={() => (c.result === "fail" ? set(c.key, null) : setFailing(c.key))}
                >
                  <ThumbsDown />
                  Fail
                </Button>
              </span>
            ) : (
              <Badge tone={c.result === "pass" ? "success" : c.result === "fail" ? "danger" : "neutral"}>
                {c.result === "pass" ? "Passed" : c.result === "fail" ? "Failed" : "Not checked"}
              </Badge>
            )}
          </li>
        ))}
      </ul>
      <NoteDialog
        open={!!failing}
        title="What must be fixed?"
        description="The editor is told, and the video stays in the quality check until it passes."
        required
        confirm="Fail the check"
        onClose={() => setFailing(null)}
        onConfirm={(note) => {
          const k = failing!;
          setFailing(null);
          set(k, "fail", note);
        }}
      />
    </SectionCard>
  );
}

// ─── Versions, feedback and revisions ─────────────────────────────────

function AddVersion({ v }: { v: VideoDetail }) {
  const act = useVideoAction(v.id);
  const [link, setLink] = useState("");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const add = (body: Record<string, unknown>) =>
    act.mutate(
      { path: "/versions", body: { ...body, duration: duration || undefined, notes: notes || undefined } },
      toast$({ onSuccess: () => (toast.success("New version added"), setLink(""), setNotes("")) }),
    );
  return (
    <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
      <div className="text-body font-medium">New version</div>
      <div className="grid gap-2 sm:grid-cols-[1fr_100px]">
        <Input placeholder="Link to the file (Drive, Frame.io…), or upload it" value={link} onChange={(e) => setLink(e.target.value)} />
        <Input placeholder="00:45" aria-label="Length" value={duration} onChange={(e) => setDuration(e.target.value)} />
      </div>
      <Textarea rows={2} placeholder="What changed in this version" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={!link || act.isPending} onClick={() => add({ link })}>
          <Plus />
          Add with the link
        </Button>
        <UploadButton start={startFor("video", v.id)} label="Upload the video" onUploaded={(fileId) => add({ fileId })} />
      </div>
    </div>
  );
}

function Comments({ v, version }: { v: VideoDetail; version: VideoDetail["versions"][number] }) {
  const act = useVideoAction(v.id);
  const [text, setText] = useState("");
  const [at, setAt] = useState("");
  return (
    <div className="mt-2 space-y-1.5">
      {version.comments.map((c) => (
        <div key={c.id} className={cn("flex items-start gap-2 rounded-lg bg-surface-secondary p-2 text-body", c.resolved && "opacity-60")}>
          <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">
            <span className="font-medium">{c.author}</span>
            {c.at !== null && <span className="ml-1 font-mono text-muted-foreground">{mmss(c.at)}</span>} —{" "}
            <span className={cn(c.resolved && "line-through")}>{c.text}</span>
          </span>
          <Button size="xs" variant="ghost" onClick={() => act.mutate({ path: `/comments/${c.id}`, method: "PUT", body: { resolved: !c.resolved } }, toast$())}>
            {c.resolved ? "Reopen" : "Done"}
          </Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Input className="w-20" placeholder="mm:ss" aria-label="Time in the video" value={at} onChange={(e) => setAt(e.target.value)} />
        <Input placeholder="Add a note on this version" value={text} onChange={(e) => setText(e.target.value)} />
        <Button
          size="sm"
          variant="secondary"
          disabled={!text.trim()}
          onClick={() =>
            act.mutate({ path: `/versions/${version.id}/comments`, body: { text, at: seconds(at) } }, toast$({ onSuccess: () => (setText(""), setAt("")) }))
          }
        >
          Add
        </Button>
      </div>
    </div>
  );
}

function ClassifyDialog({ v, open, onOpenChange }: { v: VideoDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
  const create = useCreateChangeRequest();
  const allowance = v.agreement?.revisionsPerDeliverable ?? 0;
  const left = Math.max(0, allowance - v.revisionsUsed);
  const [f, setF] = useState({
    kind: (left ? "included_revision" : "change_request") as RevisionKindKey,
    summary: v.versions[0]?.comments.at(-1)?.text ?? "",
    estimate: "",
    days: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const parsed = changeRequestInput.safeParse({
              videoId: v.id,
              kind: f.kind,
              summary: f.summary,
              estimate: f.estimate ? Number(f.estimate) : undefined,
              dateImpactDays: f.days ? Number(f.days) : undefined,
            });
            if (!parsed.success) return setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])));
            create.mutate(parsed.data, { onSuccess: () => (toast.success("Recorded"), onOpenChange(false)), onError: (err) => toast.error(errorMessage(err)) });
          }}
        >
          <DialogHeader>
            <DialogTitle>Classify the client&apos;s feedback</DialogTitle>
            <DialogDescription>
              {left} of {allowance} included revisions left on this video.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="grid gap-2">
              {REVISION_KIND_KEYS.map((k) => (
                <label
                  key={k}
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-body",
                    f.kind === k ? "border-primary bg-primary-soft/40" : "border-border",
                  )}
                >
                  <input
                    type="radio"
                    name="kind"
                    className="mt-1"
                    checked={f.kind === k}
                    disabled={k === "included_revision" && !left}
                    onChange={() => setF({ ...f, kind: k })}
                  />
                  <span>
                    <span className="font-medium">{REVISION_KIND_LABEL[k]}</span>
                    <span className="block text-muted-foreground">
                      {k === "agency_correction"
                        ? "Our mistake against the brief, brand or quality standard — no allowance used."
                        : k === "included_revision"
                          ? left
                            ? "A new preference within the agreement — uses one of the included revisions."
                            : "None left — make it a change request."
                          : "New work beyond the brief or the allowance — estimate first, the client approves before it is done."}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <Field label="What is to change" required error={errors.summary}>
              <Textarea rows={2} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} />
            </Field>
            {f.kind === "change_request" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Estimate (₹, before GST)" required error={errors.estimate}>
                  <Input type="number" min={0} value={f.estimate} onChange={(e) => setF({ ...f, estimate: e.target.value })} />
                </Field>
                <Field label="Days it adds">
                  <Input type="number" min={0} value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} />
                </Field>
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              Record
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Versions({ v, canEdit }: { v: VideoDetail; canEdit: boolean }) {
  const act = useVideoAction(v.id);
  const [changes, setChanges] = useState(false);
  const [classify, setClassify] = useState(false);
  const latest = v.versions[0];
  const allowance = v.agreement?.revisionsPerDeliverable ?? null;
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="space-y-3">
        {canEdit && latest?.status === "internal" && v.stage === "internal_qc" && (
          <Alert tone="info">
            <span className="flex flex-wrap items-center justify-between gap-2">
              {v.qc.every((c) => c.result === "pass")
                ? `The quality check has passed — ${latest.label} can go to the client.`
                : `${latest.label} can go to the client once every quality check has passed.`}
              <Button
                size="sm"
                onClick={() => act.mutate({ path: "/versions/send" }, toast$({ onSuccess: () => toast.success(`${latest.label} sent to the client`) }))}
              >
                <Send />
                Send {latest.label} to the client
              </Button>
            </span>
          </Alert>
        )}
        {canEdit && latest?.status === "sent" && (
          <Alert tone="info">
            <span className="flex flex-wrap items-center justify-between gap-2">
              {latest.label} is with the client. Record their answer:
              <span className="flex gap-2">
                <Button
                  size="sm"
                  variant="success"
                  onClick={() => act.mutate({ path: "/decision", body: { approved: true } }, toast$({ onSuccess: () => toast.success("Approved") }))}
                >
                  <ThumbsUp />
                  Approved
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setChanges(true)}>
                  <ThumbsDown />
                  Wants changes
                </Button>
              </span>
            </span>
          </Alert>
        )}
        {canEdit && latest?.status !== "sent" && v.stage !== "approved" && v.stage !== "published" && <AddVersion v={v} />}
        {!v.versions.length && <p className="text-body text-muted-foreground">No versions yet.</p>}
        {v.versions.map((x) => (
          <SectionCard
            key={x.id}
            title={`${x.label}${x.duration ? ` · ${x.duration}` : ""}`}
            description={`${x.by?.name ?? "—"} · ${fmtDate(x.createdAt)}${x.notes ? ` — ${x.notes}` : ""}`}
            actions={<Badge tone={VERSION_STATUS[x.status].tone}>{VERSION_STATUS[x.status].label}</Badge>}
          >
            {(x.file?.url || x.link) && (
              <a
                href={x.file?.url ?? x.link!}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-body text-primary hover:underline"
              >
                <ExternalLink className="size-3.5" />
                {x.file ? x.file.name : "Open the file"}
              </a>
            )}
            <Comments v={v} version={x} />
          </SectionCard>
        ))}
      </div>
      <div className="space-y-4">
        <SectionCard
          title="Revisions"
          description={allowance !== null ? `${v.revisionsUsed} of ${allowance} included revisions used.` : "No agreement — no allowance."}
          actions={
            canEdit && (
              <Button size="sm" variant="secondary" onClick={() => setClassify(true)}>
                Classify feedback
              </Button>
            )
          }
        >
          {allowance !== null && (
            <Progress
              value={allowance ? (v.revisionsUsed / allowance) * 100 : 100}
              tone={v.revisionsUsed >= allowance ? "danger" : "accent"}
              className="mb-3"
            />
          )}
          {!v.changeRequests.length ? (
            <p className="text-body text-muted-foreground">None yet.</p>
          ) : (
            <ul className="space-y-2">
              {v.changeRequests.map((r) => (
                <li key={r.id} className="rounded-lg border border-border p-2.5 text-body">
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone={r.kind === "change_request" ? "warning" : "info"}>{REVISION_KIND_LABEL[r.kind as RevisionKindKey] ?? r.kind}</Badge>
                    <span className="text-muted-foreground">{r.status.replace("_", " ")}</span>
                  </div>
                  <div className="mt-1">{r.summary}</div>
                  {r.estimate !== null && (
                    <div className="text-muted-foreground">
                      {inr(r.estimate)}
                      {r.dateImpactDays ? ` · +${r.dateImpactDays} days` : ""}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Link href="/app/production?tab=revisions" className="mt-2 inline-block text-body text-primary hover:underline">
            All revisions and change requests
          </Link>
        </SectionCard>
      </div>
      <NoteDialog
        open={changes}
        title="What does the client want changed?"
        description="The video goes to Revision and the editor is told."
        required
        confirm="Send to revision"
        onClose={() => setChanges(false)}
        onConfirm={(note) => {
          setChanges(false);
          act.mutate({ path: "/decision", body: { approved: false, note } }, toast$({ onSuccess: () => toast.success("Sent to revision") }));
        }}
      />
      {classify && <ClassifyDialog v={v} open onOpenChange={setClassify} />}
    </div>
  );
}

// ─── Details ──────────────────────────────────────────────────────────

function Details({ v, canEdit }: { v: VideoDetail; canEdit: boolean }) {
  const act = useVideoAction(v.id);
  const settings = useProductionSettings();
  const people = usePeople();
  const [f, setF] = useState(() => ({
    title: v.title,
    format: v.format,
    aspect: v.aspect,
    urgency: v.urgency,
    dueDate: v.dueDate ?? "",
    publishDate: v.publishDate ?? "",
    editorId: v.editor?.id ?? "",
    directorId: v.director?.id ?? "",
    cameraId: v.camera?.id ?? "",
    platforms: v.platforms,
    notes: v.notes ?? "",
  }));
  const person = (k: "editorId" | "directorId" | "cameraId", label: string) => (
    <Field label={label}>
      <Select
        aria-label={label}
        value={f[k] || "_none"}
        onValueChange={(x) => setF({ ...f, [k]: x === "_none" ? "" : x })}
        options={[{ value: "_none", label: "Nobody" }, ...people]}
      />
    </Field>
  );
  return (
    <SectionCard title="Details">
      <fieldset disabled={!canEdit} className="space-y-4">
        <Field label="Title">
          <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Format">
            <Select
              aria-label="Format"
              value={f.format}
              onValueChange={(format) => setF({ ...f, format })}
              options={(settings.data?.formats ?? []).map((x) => ({ value: x.name, label: x.name }))}
            />
          </Field>
          <Field label="Aspect">
            <Select
              aria-label="Aspect"
              value={f.aspect}
              onValueChange={(aspect) => setF({ ...f, aspect })}
              options={ASPECTS.map((a) => ({ value: a, label: a }))}
            />
          </Field>
          <Field label="Urgency">
            <Select
              aria-label="Urgency"
              value={f.urgency}
              onValueChange={(u) => setF({ ...f, urgency: u as typeof f.urgency })}
              options={URGENCIES.map((u) => ({ value: u, label: URGENCY_LABEL[u] }))}
            />
          </Field>
          <Field label="Due">
            <Input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
          </Field>
          <Field label="Publish on">
            <Input type="date" value={f.publishDate} onChange={(e) => setF({ ...f, publishDate: e.target.value })} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {person("editorId", "Editor")}
          {person("directorId", "Content director")}
          {person("cameraId", "Camera")}
        </div>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => {
            const on = f.platforms.includes(p);
            return (
              <button
                key={p}
                type="button"
                aria-pressed={on}
                onClick={() => setF({ ...f, platforms: on ? f.platforms.filter((x) => x !== p) : [...f.platforms, p] })}
                className={cn(
                  "cursor-pointer rounded-full border px-3 py-1 text-body",
                  on ? "border-primary bg-primary-soft text-primary" : "border-border text-text-secondary",
                )}
              >
                {PLATFORM_LABEL[p]}
              </button>
            );
          })}
        </div>
        <Field label="Brief">
          <Textarea rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
        {canEdit && (
          <Button
            onClick={() =>
              act.mutate(
                {
                  path: "",
                  method: "PATCH",
                  body: {
                    ...f,
                    publishDate: f.publishDate || null,
                    editorId: f.editorId || null,
                    directorId: f.directorId || null,
                    cameraId: f.cameraId || null,
                    notes: f.notes,
                  },
                },
                {
                  onSuccess: () => toast.success("Saved"),
                  onError: (e) => (e instanceof ApiError && e.body.issues ? toast.error(e.body.issues[0]!.message) : toast.error(errorMessage(e))),
                },
              )
            }
          >
            Save
          </Button>
        )}
      </fieldset>
    </SectionCard>
  );
}

// ─── The page ─────────────────────────────────────────────────────────

export function LiveVideo({ id, tab }: { id: string; tab?: string }) {
  const can = useCan();
  const video = useVideo(id);
  if (video.isPending) return <SkeletonRows rows={8} />;
  if (video.error) return <Alert tone="danger">{errorMessage(video.error)}</Alert>;
  const v = video.data;
  const canEdit = can("production", "edit");
  return (
    <>
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
        <Link href="/app/production">
          <ArrowLeft />
          Production
        </Link>
      </Button>
      <PageHeader
        eyebrow={
          <>
            <Badge tone="outline" className="font-mono">
              {v.code}
            </Badge>
            <StageBadge stage={v.stage} />
            <UrgencyBadge urgency={v.urgency} />
            <VpBadge on={v.protected} />
            {v.overdue && <Badge tone="danger">Overdue</Badge>}
          </>
        }
        title={v.title}
        description={
          <>
            <Link href={`/app/clients/${v.client.id}`} className="hover:underline">
              {v.client.name}
            </Link>
            {` · ${v.format} · ${v.aspect} · due ${v.dueDate ? fmtDate(v.dueDate) : "—"} · editor ${v.editor?.name ?? "not set"}`}
            {v.shoot && (
              <>
                {" · shoot "}
                <Link href={`/app/shoots/${v.shoot.id}`} className="hover:underline">
                  {fmtDate(v.shoot.date)}
                </Link>
              </>
            )}
          </>
        }
        actions={canEdit && v.stage !== "published" && <MoveMenu v={v} />}
      />
      <Tabs
        defaultValue={
          ["editing", "qc", "versions", "brief", "details", "history"].includes(tab ?? "")
            ? tab
            : v.stage === "internal_qc"
              ? "qc"
              : ["client_review", "revision", "approved"].includes(v.stage)
                ? "versions"
                : "editing"
        }
      >
        <TabsList className="flex-wrap">
          <TabsTrigger value="editing">Editing</TabsTrigger>
          <TabsTrigger value="qc">
            <ShieldCheck className="size-3.5" />
            Quality check
          </TabsTrigger>
          <TabsTrigger value="versions">Versions & feedback</TabsTrigger>
          <TabsTrigger value="brief">Brief & script</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="editing">
          <Editing key={v.delayReason ?? ""} v={v} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="qc">
          <Qc v={v} canApprove={can("production", "approve")} />
        </TabsContent>
        <TabsContent value="versions">
          <Versions v={v} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="brief">
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Brief">
              {v.notes ? <p className="whitespace-pre-line text-body">{v.notes}</p> : <p className="text-body text-muted-foreground">No brief written.</p>}
            </SectionCard>
            <SectionCard
              title="Approved script"
              description={
                v.content ? (
                  <Link href={`/app/content/${v.content.id}`} className="hover:underline">
                    {v.content.title}
                  </Link>
                ) : (
                  "Not made from a script."
                )
              }
            >
              {v.content?.script ? (
                <dl className="space-y-2 text-body">
                  {(
                    [
                      ["Hook", v.content.script.hook],
                      ["Script", v.content.script.body],
                      ["Call to action", v.content.script.cta],
                      ["On screen", v.content.script.onScreen],
                    ] as const
                  )
                    .filter(([, t]) => t)
                    .map(([k, t]) => (
                      <div key={k}>
                        <dt className="font-medium text-text-secondary">{k}</dt>
                        <dd className="whitespace-pre-line">{t}</dd>
                      </div>
                    ))}
                </dl>
              ) : (
                <p className="text-body text-muted-foreground">—</p>
              )}
            </SectionCard>
          </div>
        </TabsContent>
        <TabsContent value="details">
          <Details key={v.id} v={v} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="history">
          <SectionCard title="Stage history">
            <ol className="space-y-2">
              {v.history.map((h, i) => (
                <li key={i} className="flex items-start gap-2 text-body">
                  <span className="text-muted-foreground">
                    {new Date(h.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span>
                    {h.from ? `${VIDEO_STAGE_LABEL[h.from as VideoStageKey]} → ` : "Made · "}
                    <span className="font-medium">{VIDEO_STAGE_LABEL[h.to as VideoStageKey]}</span>
                    {h.by?.name && ` · ${h.by.name}`}
                    {h.note && <span className="text-muted-foreground"> — {h.note}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </>
  );
}

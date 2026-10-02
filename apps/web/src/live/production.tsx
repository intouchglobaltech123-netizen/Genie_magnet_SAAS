"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ClipboardCheck, Clapperboard, Film, Plus, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  ASPECTS,
  REVISION_KIND_LABEL,
  type RevisionKindKey,
  URGENCIES,
  URGENCY_LABEL,
  VIDEO_STAGE_KEYS,
  VIDEO_STAGE_LABEL,
  videoInput,
  type VideoSummary,
} from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, SectionCard } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ApiError, errorMessage } from "./api";
import { fmtDate } from "./format";
import { inr } from "./packages";
import { StageBadge, UrgencyBadge, usePeople, VpBadge } from "./production-bits";
import {
  useCan,
  useChangeRequests,
  useChangeRequestStatus,
  useClients,
  useCreateVideo,
  useMoveVideo,
  useProductionSettings,
  useVideoAction,
  useVideos,
} from "./queries";

// ─── New video ────────────────────────────────────────────────────────

export function NewVideoDialog({ open, onOpenChange, clientId }: { open: boolean; onOpenChange: (o: boolean) => void; clientId?: string }) {
  const router = useRouter();
  const clients = useClients();
  const settings = useProductionSettings();
  const people = usePeople();
  const create = useCreateVideo();
  const [f, setF] = useState({
    clientId: clientId ?? "",
    title: "",
    format: "Reel",
    aspect: "9:16",
    urgency: "standard",
    dueDate: "",
    editorId: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const parsed = videoInput.safeParse({ ...f, editorId: f.editorId || undefined, notes: f.notes || undefined });
            if (!parsed.success) return setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])));
            create.mutate(parsed.data, {
              onSuccess: (v) => {
                toast.success(`${v.code} made`);
                onOpenChange(false);
                router.push(`/app/production/${v.id}`);
              },
              onError: (err) => err instanceof ApiError && err.body.issues && setErrors(Object.fromEntries(err.body.issues.map((i) => [i.path, i.message]))),
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>New video</DialogTitle>
            <DialogDescription>
              Its code comes from your format; it counts in the client&apos;s month by its due date. Videos from approved scripts are made by themselves.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field label="Client" required error={errors.clientId}>
              <Select
                aria-label="Client"
                value={f.clientId || undefined}
                placeholder="Choose the client"
                onValueChange={(v) => setF({ ...f, clientId: v })}
                options={(clients.data ?? []).filter((c) => !c.archivedAt).map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))}
              />
            </Field>
            <Field label="Title" required error={errors.title}>
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
                  onValueChange={(urgency) => setF({ ...f, urgency })}
                  options={URGENCIES.map((u) => ({ value: u, label: URGENCY_LABEL[u] }))}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Due" required error={errors.dueDate}>
                <Input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
              </Field>
              <Field label="Editor" error={errors.editorId}>
                <Select
                  aria-label="Editor"
                  value={f.editorId || "_none"}
                  onValueChange={(v) => setF({ ...f, editorId: v === "_none" ? "" : v })}
                  options={[{ value: "_none", label: "Not yet" }, ...people]}
                />
              </Field>
            </div>
            <Field label="Brief">
              <Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
            </Field>
            {create.error && !(create.error instanceof ApiError && create.error.body.issues) && <Alert tone="danger">{errorMessage(create.error)}</Alert>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              <Film />
              Make the video
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Board ────────────────────────────────────────────────────────────

function VideoCard({ v, draggable }: { v: VideoSummary; draggable: boolean }) {
  const showSteps = v.stage === "shot" || v.stage === "editing";
  return (
    <Link
      href={`/app/production/${v.id}`}
      draggable={draggable}
      onDragStart={(e) => e.dataTransfer.setData("text/video", v.id)}
      className="block rounded-lg border border-border bg-surface p-3 shadow-sm transition-colors hover:border-secondary/40"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-body font-semibold">{v.code}</span>
        <UrgencyBadge urgency={v.urgency} />
      </div>
      <div className="mt-0.5 truncate text-body">{v.title}</div>
      {showSteps && (
        <div className="mt-2 flex gap-0.5" aria-label={`${v.editProgress.done} of ${v.editProgress.total} edit steps`}>
          {Array.from({ length: v.editProgress.total }, (_, i) => (
            <span key={i} className={cn("h-1 flex-1 rounded-full", i < v.editProgress.done ? "bg-success" : "bg-muted")} />
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center justify-between gap-2 text-body">
        <span className={cn("text-muted-foreground", v.overdue && "font-medium text-danger")}>{v.dueDate ? fmtDate(v.dueDate) : "No due date"}</span>
        <span className="flex items-center gap-1.5">
          <VpBadge on={v.protected} />
          {v.editor?.name && <Avatar name={v.editor.name} size="xs" />}
        </span>
      </div>
    </Link>
  );
}

function Board({ videos }: { videos: VideoSummary[] }) {
  const can = useCan();
  const move = useMoveVideo();
  const [over, setOver] = useState<string | null>(null);
  const editable = can("production", "edit");
  return (
    <div className="scrollbar-thin -mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
      {VIDEO_STAGE_KEYS.map((s) => {
        const list = videos.filter((v) => v.stage === s);
        return (
          <section
            key={s}
            aria-label={VIDEO_STAGE_LABEL[s]}
            onDragOver={(e) => editable && (e.preventDefault(), setOver(s))}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const id = e.dataTransfer.getData("text/video");
              const v = videos.find((x) => x.id === id);
              if (!v || v.stage === s) return;
              move.mutate(
                { id, to: s },
                { onSuccess: () => toast.success(`${v.code} → ${VIDEO_STAGE_LABEL[s]}`), onError: (err) => toast.error(errorMessage(err)) },
              );
            }}
            className={cn(
              "flex w-60 shrink-0 flex-col rounded-xl border bg-surface-secondary p-2 transition-colors",
              over === s ? "border-primary bg-primary-soft" : "border-border-subtle",
            )}
          >
            <header className="mb-2 flex items-center justify-between px-1">
              <span className="text-body font-semibold">{VIDEO_STAGE_LABEL[s]}</span>
              <Badge tone="outline">{list.length}</Badge>
            </header>
            <div className="space-y-2">
              {list.map((v) => (
                <VideoCard key={v.id} v={v} draggable={editable} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ─── Sheet ────────────────────────────────────────────────────────────

function SheetRow({ v, i, editable }: { v: VideoSummary; i: number; editable: boolean }) {
  const act = useVideoAction(v.id);
  const [clip, setClip] = useState(v.clipNo ?? "");
  return (
    <TR>
      <TD className="tabular text-muted-foreground">{i + 1}</TD>
      <TD>
        <Link href={`/app/production/${v.id}`} className="font-mono font-medium hover:underline">
          {v.code}
        </Link>
      </TD>
      <TD>
        <UrgencyBadge urgency={v.urgency} />
      </TD>
      <TD className="min-w-48">{v.title}</TD>
      <TD>
        <Input
          aria-label={`Clip numbers for ${v.code}`}
          className="h-8 w-36"
          value={clip}
          disabled={!editable}
          placeholder="C0012–C0019"
          onChange={(e) => setClip(e.target.value)}
          onBlur={() =>
            clip !== (v.clipNo ?? "") && act.mutate({ path: "", method: "PATCH", body: { clipNo: clip } }, { onError: (e) => toast.error(errorMessage(e)) })
          }
        />
      </TD>
      <TD>
        <Checkbox
          aria-label={`Footage protected for ${v.code}`}
          checked={v.protected}
          disabled={!editable}
          onCheckedChange={(on) =>
            act.mutate({ path: "/protect", method: "PUT", body: { done: on === true } }, { onError: (e) => toast.error(errorMessage(e)) })
          }
        />
      </TD>
      <TD>{v.editor?.name ?? "—"}</TD>
      <TD>
        <StageBadge stage={v.stage} />
      </TD>
      <TD className={cn("whitespace-nowrap", v.overdue && "font-medium text-danger")}>{v.dueDate ? fmtDate(v.dueDate) : "—"}</TD>
    </TR>
  );
}

function Sheet({ videos }: { videos: VideoSummary[] }) {
  const can = useCan();
  return (
    <Card className="overflow-hidden">
      <Table>
        <THead>
          <TR>
            <TH>#</TH>
            <TH>Code</TH>
            <TH>Urgency</TH>
            <TH>Video</TH>
            <TH>Clip no.</TH>
            <TH>VP</TH>
            <TH>Editor</TH>
            <TH>Stage</TH>
            <TH>Due</TH>
          </TR>
        </THead>
        <TBody>
          {videos.map((v, i) => (
            <SheetRow key={v.id} v={v} i={i} editable={can("production", "edit")} />
          ))}
        </TBody>
      </Table>
    </Card>
  );
}

// ─── Quality check queue and revisions ────────────────────────────────

function QcQueue({ videos }: { videos: VideoSummary[] }) {
  const order = { rush: 0, priority: 1, standard: 2 } as const;
  const waiting = videos
    .filter((v) => v.stage === "internal_qc")
    .sort((a, b) => order[a.urgency] - order[b.urgency] || (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  if (!waiting.length) return <EmptyState icon={ClipboardCheck} title="Nothing waiting for the quality check" />;
  return (
    <ul className="space-y-2">
      {waiting.map((v) => (
        <li key={v.id}>
          <Link
            href={`/app/production/${v.id}?tab=qc`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-3 hover:border-secondary/40"
          >
            <span>
              <span className="font-mono font-semibold">{v.code}</span> <span className="text-body">{v.title}</span>
              <span className="block text-body text-muted-foreground">
                {v.client.name} · {v.editor?.name ?? "no editor"} · due {v.dueDate ? fmtDate(v.dueDate) : "—"}
              </span>
            </span>
            <span className="flex items-center gap-2">
              <UrgencyBadge urgency={v.urgency} />
              {v.qcProgress.failed > 0 ? (
                <Badge tone="danger">
                  <AlertTriangle />
                  {v.qcProgress.failed} failed
                </Badge>
              ) : (
                <Badge tone="outline">
                  {v.qcProgress.passed}/{v.qcProgress.total} passed
                </Badge>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

const CR_STATUS: Record<string, string> = {
  open: "Open",
  awaiting_client: "Estimate with the client",
  approved: "Client approved",
  rejected: "Client declined",
  done: "Done",
};

function Revisions() {
  const list = useChangeRequests();
  const step = useChangeRequestStatus();
  const can = useCan();
  if (list.isPending) return <SkeletonRows rows={4} />;
  if (!list.data?.length) return <EmptyState icon={Clapperboard} title="No open revisions or change requests" />;
  const next = (kind: string, status: string): [string, string][] =>
    kind === "change_request"
      ? status === "open"
        ? [["awaiting_client", "Estimate sent"]]
        : status === "awaiting_client"
          ? [
              ["approved", "Client approved"],
              ["rejected", "Client declined"],
            ]
          : status === "approved"
            ? [["done", "Done"]]
            : []
      : status === "open"
        ? [["done", "Done"]]
        : [];
  return (
    <Card className="overflow-hidden">
      <Table>
        <THead>
          <TR>
            <TH>Video</TH>
            <TH>Kind</TH>
            <TH>What</TH>
            <TH>Allowance</TH>
            <TH>Status</TH>
            <TH />
          </TR>
        </THead>
        <TBody>
          {list.data.map((r) => (
            <TR key={r.id}>
              <TD>
                {r.video ? (
                  <Link href={`/app/production/${r.video.id}`} className="font-mono font-medium hover:underline">
                    {r.video.code}
                  </Link>
                ) : (
                  "—"
                )}
                <div className="text-muted-foreground">{r.client}</div>
              </TD>
              <TD>
                <Badge tone={r.kind === "change_request" ? "warning" : r.kind === "agency_correction" ? "neutral" : "info"}>
                  {REVISION_KIND_LABEL[r.kind as RevisionKindKey] ?? r.kind}
                </Badge>
              </TD>
              <TD className="min-w-56">
                {r.summary}
                {r.estimate !== null && (
                  <div className="text-muted-foreground">
                    {inr(r.estimate)}
                    {r.dateImpactDays ? ` · +${r.dateImpactDays} days` : ""}
                  </div>
                )}
              </TD>
              <TD className="whitespace-nowrap">{r.video && r.video.allowance !== null ? `${r.video.revisionsUsed} of ${r.video.allowance} used` : "—"}</TD>
              <TD>{CR_STATUS[r.status] ?? r.status}</TD>
              <TD>
                {can("production", "edit") && (
                  <span className="flex gap-1.5">
                    {next(r.kind, r.status).map(([s, label]) => (
                      <Button
                        key={s}
                        size="xs"
                        variant="secondary"
                        onClick={() => step.mutate({ id: r.id, status: s }, { onError: (e) => toast.error(errorMessage(e)) })}
                      >
                        {label}
                      </Button>
                    ))}
                  </span>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </Card>
  );
}

// ─── The hub ──────────────────────────────────────────────────────────

export function LiveProduction({ tab: initial }: { tab?: string }) {
  const can = useCan();
  const clients = useClients();
  const people = usePeople();
  const [clientId, setClientId] = useState("");
  const [editorId, setEditorId] = useState("");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const query = [clientId && `clientId=${clientId}`, editorId && `editorId=${editorId}`, q && `q=${encodeURIComponent(q)}`].filter(Boolean).join("&");
  const videos = useVideos(query);
  const list = videos.data ?? [];
  // A week from today, worked out once when the page opens.
  const [week] = useState(() => new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10));
  const active = list.filter((v) => !["planned", "approved", "published"].includes(v.stage));
  const stats = [
    ["In production", active.length],
    ["Due this week", active.filter((v) => v.dueDate && v.dueDate <= week && !v.overdue).length],
    ["Overdue", list.filter((v) => v.overdue).length],
    ["With the client", list.filter((v) => v.stage === "client_review").length],
    ["Waiting for QC", list.filter((v) => v.stage === "internal_qc").length],
  ] as const;
  return (
    <>
      <PageHeader
        title="Production"
        description="Every video from planned to published. A video moves on only when its checks pass: footage protected, edit steps done, the quality check passed, the client's approval."
        actions={
          can("production", "edit") && (
            <Button onClick={() => setAdding(true)}>
              <Plus />
              New video
            </Button>
          )
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map(([label, n]) => (
          <Card key={label} className="p-3">
            <div className="text-body text-muted-foreground">{label}</div>
            <div className={cn("text-subheading font-semibold", label === "Overdue" && n > 0 && "text-danger")}>{n}</div>
          </Card>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Code, title or clip" className="pl-9" aria-label="Search videos" />
        </div>
        <Select
          aria-label="Client"
          className="w-48"
          value={clientId || "_all"}
          onValueChange={(v) => setClientId(v === "_all" ? "" : v)}
          options={[{ value: "_all", label: "All clients" }, ...(clients.data ?? []).filter((c) => !c.archivedAt).map((c) => ({ value: c.id, label: c.name }))]}
        />
        <Select
          aria-label="Editor"
          className="w-48"
          value={editorId || "_all"}
          onValueChange={(v) => setEditorId(v === "_all" ? "" : v)}
          options={[{ value: "_all", label: "All editors" }, ...people]}
        />
      </div>
      {videos.error && <Alert tone="danger">{errorMessage(videos.error)}</Alert>}
      <Tabs defaultValue={initial === "qc" || initial === "sheet" || initial === "revisions" ? initial : "board"}>
        <TabsList>
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="sheet">Sheet</TabsTrigger>
          <TabsTrigger value="qc">
            <ShieldCheck className="size-3.5" />
            Quality check
          </TabsTrigger>
          <TabsTrigger value="revisions">Revisions</TabsTrigger>
        </TabsList>
        <TabsContent value="board">
          {videos.isPending ? (
            <SkeletonRows rows={6} />
          ) : !list.length ? (
            <EmptyState icon={Film} title="No videos yet" description="Approved scripts become videos by themselves; or make one here." />
          ) : (
            <Board videos={list} />
          )}
        </TabsContent>
        <TabsContent value="sheet">{videos.isPending ? <SkeletonRows rows={6} /> : <Sheet videos={list} />}</TabsContent>
        <TabsContent value="qc">
          <QcQueue videos={list} />
        </TabsContent>
        <TabsContent value="revisions">
          <Revisions />
        </TabsContent>
      </Tabs>
      {adding && <NewVideoDialog open onOpenChange={setAdding} clientId={clientId || undefined} />}
    </>
  );
}

export function ClientVideos({ clientId }: { clientId: string }) {
  const videos = useVideos(`clientId=${clientId}`);
  return (
    <SectionCard title="Videos" contentClassName="p-0">
      {videos.isPending ? (
        <div className="p-4">
          <SkeletonRows rows={2} />
        </div>
      ) : !videos.data?.length ? (
        <p className="px-5 pb-5 text-body text-muted-foreground">No videos yet.</p>
      ) : (
        <Table>
          <TBody>
            {videos.data.slice(0, 12).map((v) => (
              <TR key={v.id}>
                <TD>
                  <Link href={`/app/production/${v.id}`} className="font-mono font-medium hover:underline">
                    {v.code}
                  </Link>
                </TD>
                <TD>{v.title}</TD>
                <TD>
                  <StageBadge stage={v.stage} />
                </TD>
                <TD className={cn("whitespace-nowrap", v.overdue && "text-danger")}>{v.dueDate ? fmtDate(v.dueDate) : "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </SectionCard>
  );
}

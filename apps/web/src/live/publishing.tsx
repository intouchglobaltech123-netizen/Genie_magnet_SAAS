"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  ImageIcon,
  Link2,
  Loader2,
  Megaphone,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  Unplug,
  Upload,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { isSocialPlatform, PLATFORMS, type PlatformConnectionRow, type PublishingItem } from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, SectionCard } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { DraftDialog } from "./genie-drafts";
import { errorMessage } from "./api";
import { startFor, UploadButton } from "./files";
import { fmtDate } from "./format";
import { PLATFORM_LABEL } from "./packages";
import { MonthSwitcher, thisMonth } from "./production-bits";
import {
  useCan,
  useConnectPlatform,
  useFiles,
  usePlatformAccounts,
  usePlatformAction,
  usePlatforms,
  usePublishingAction,
  usePublishingQueue,
  useQuotas,
  useSocial,
} from "./queries";

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
/** A local date-time input value, from now or a date. */
const localInput = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

function ScheduleDialog({ v, open, onOpenChange }: { v: PublishingItem; open: boolean; onOpenChange: (o: boolean) => void }) {
  const platforms = usePlatforms(v.client.id);
  const act = usePublishingAction();
  const [connectionId, setConnectionId] = useState("");
  const [at, setAt] = useState(() => localInput(v.publishDate ? new Date(`${v.publishDate}T18:30:00`) : new Date()));
  const [caption, setCaption] = useState("");
  const unposted = (platforms.data ?? []).filter((p) => !v.posts.some((x) => x.connectionId === p.id));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule {v.code}</DialogTitle>
          <DialogDescription>One post per platform. The client&apos;s platforms are set on their page.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {platforms.data && !platforms.data.length && (
            <Alert tone="warning">
              No platforms for {v.client.name} yet —{" "}
              <Link href={`/app/clients/${v.client.id}`} className="underline">
                add them on the client&apos;s page
              </Link>
              .
            </Alert>
          )}
          {platforms.data && platforms.data.length > 0 && !unposted.length && (
            <Alert tone="info">Every platform of {v.client.name} has a post for this video already.</Alert>
          )}
          <Field label="Platform">
            <Select
              aria-label="Platform"
              value={connectionId || undefined}
              placeholder="Choose the platform"
              onValueChange={setConnectionId}
              options={unposted.map((p) => ({ value: p.id, label: `${PLATFORM_LABEL[p.platform] ?? p.platform} · ${p.handle}` }))}
            />
          </Field>
          <Field label="When">
            <Input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
          </Field>
          <Field label="Caption">
            <Textarea rows={4} value={caption} onChange={(e) => setCaption(e.target.value)} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!connectionId || !at || act.isPending}
            onClick={() =>
              act.mutate(
                { step: "schedule", input: { videoId: v.id, connectionId, scheduledAt: new Date(at).toISOString(), caption: caption || undefined } },
                { onSuccess: () => (toast.success("Scheduled"), onOpenChange(false)), onError: (e) => toast.error(errorMessage(e)) },
              )
            }
          >
            <CalendarClock />
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PublishedDialog({
  v,
  post,
  open,
  onOpenChange,
}: {
  v: PublishingItem;
  post: PublishingItem["posts"][number];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const act = usePublishingAction();
  const [url, setUrl] = useState("");
  const [at, setAt] = useState(() => localInput());
  const [proof, setProof] = useState<{ id: string; name: string } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Mark {v.code} as published on {PLATFORM_LABEL[post.platform] ?? post.platform}
          </DialogTitle>
          <DialogDescription>The post&apos;s link and a screenshot are kept as proof for the client&apos;s report.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <Field label="Link to the post" required>
            <Input placeholder="https://www.instagram.com/p/…" value={url} onChange={(e) => setUrl(e.target.value)} />
          </Field>
          <Field label="Posted at" required>
            <Input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <UploadButton
              start={startFor("publishing", v.id)}
              label={proof ? "Replace the screenshot" : "Upload a screenshot"}
              onUploaded={(id, f) => setProof({ id, name: f.name })}
            />
            {proof && <span className="text-body text-muted-foreground">{proof.name}</span>}
          </div>
          <label className="flex items-start gap-2 text-body">
            <Checkbox className="mt-0.5" checked={confirmed} onCheckedChange={(on) => setConfirmed(on === true)} />I posted the client-approved{" "}
            {v.approvedVersion ?? "version"} file, unchanged.
          </label>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="success"
            disabled={!url || !proof || !confirmed || act.isPending}
            onClick={() =>
              act.mutate(
                { step: "published", id: post.id, input: { url, publishedAt: new Date(at).toISOString(), proofFileId: proof!.id, confirmed: true } },
                { onSuccess: () => (toast.success("Published"), onOpenChange(false)), onError: (e) => toast.error(errorMessage(e)) },
              )
            }
          >
            <CheckCircle2 />
            Mark as published
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QueueRow({ v }: { v: PublishingItem }) {
  const can = useCan();
  const act = usePublishingAction();
  const [scheduling, setScheduling] = useState(false);
  const [captioning, setCaptioning] = useState(false);
  const [publishing, setPublishing] = useState<PublishingItem["posts"][number] | null>(null);
  const proofs = useFiles(
    "publishing",
    v.id,
    v.posts.some((p) => p.proofFileId),
  );
  const proof = (id: string | null) => proofs.data?.find((f) => f.id === id)?.url ?? undefined;
  const connections = usePlatforms(
    v.client.id,
    v.posts.some((p) => p.status !== "published"),
  );
  const linkedIds = new Set((connections.data ?? []).filter((c) => c.status === "linked").map((c) => c.id));
  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span>
          <Link href={`/app/production/${v.id}`} className="font-mono font-semibold hover:underline">
            {v.code}
          </Link>{" "}
          <span className="text-body">{v.title}</span>
          <span className="block text-body text-muted-foreground">
            {v.client.name} · approved {v.approvedVersion ?? "—"}
            {v.publishDate && ` · publish ${fmtDate(v.publishDate)}`}
          </span>
        </span>
        {can("publishing", "edit") && v.stage === "approved" && (
          <span className="flex gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => setCaptioning(true)}>
              <Sparkles />
              Draft a caption
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setScheduling(true)}>
              <Plus />
              Schedule a post
            </Button>
          </span>
        )}
      </div>
      {captioning && (
        <DraftDialog
          request={{ kind: "caption", videoId: v.id }}
          title={`A caption for ${v.code}`}
          description="Written from the approved script and the client's voice. Approving puts it on this video's posts still to go out."
          onClose={() => setCaptioning(false)}
        />
      )}
      {v.posts.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {v.posts.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-secondary px-3 py-2 text-body">
              <span className="min-w-0">
                <span className="font-medium">{PLATFORM_LABEL[p.platform] ?? p.platform}</span> · {p.handle} · {when(p.publishedAt ?? p.scheduledAt)}
                {p.auto && (
                  <Badge tone="accent" className="ml-2">
                    <Zap className="size-3" />
                    Posts by itself
                  </Badge>
                )}
                {p.status === "publishing" && (
                  <Badge tone="info" className="ml-2">
                    <Loader2 className="size-3 animate-spin" />
                    Posting…
                  </Badge>
                )}
                {p.caption && <span className="block truncate text-muted-foreground">{p.caption}</span>}
                {p.publishError && (
                  <span className={cn("flex items-start gap-1", p.status === "failed" ? "text-danger" : "text-muted-foreground")}>
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    {p.status === "failed" ? `The app could not post it: ${p.publishError}` : p.publishError}
                  </span>
                )}
              </span>
              {p.status === "publishing" ? null : p.status === "published" ? (
                <span className="flex items-center gap-3">
                  {proof(p.proofFileId) && (
                    <a
                      href={proof(p.proofFileId)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-muted-foreground hover:underline"
                    >
                      <ImageIcon className="size-4" />
                      Screenshot
                    </a>
                  )}
                  <a
                    href={p.publishedUrl ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-success hover:underline"
                  >
                    <CheckCircle2 className="size-4" />
                    {p.via === "connector" ? "Published by the app" : "Published"}
                    <ExternalLink className="size-3.5" />
                  </a>
                </span>
              ) : (
                <span className="flex gap-1.5">
                  {can("publishing", "approve") && linkedIds.has(p.connectionId) && (
                    <Button
                      size="xs"
                      variant="secondary"
                      disabled={act.isPending}
                      onClick={() =>
                        act.mutate(
                          { step: "post-now", id: p.id },
                          { onSuccess: () => toast.success("Posting now — it shows as published in a minute"), onError: (e) => toast.error(errorMessage(e)) },
                        )
                      }
                    >
                      {p.status === "failed" ? <RefreshCw /> : <Send />}
                      {p.status === "failed" ? "Try again" : "Post now"}
                    </Button>
                  )}
                  {can("publishing", "approve") && (
                    <Button size="xs" variant="success" onClick={() => setPublishing(p)}>
                      <Upload />
                      Mark published
                    </Button>
                  )}
                  {can("publishing", "edit") && (
                    <Button
                      size="xs"
                      variant="ghost"
                      aria-label="Remove the post"
                      onClick={() => act.mutate({ step: "unschedule", id: p.id }, { onError: (e) => toast.error(errorMessage(e)) })}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {scheduling && <ScheduleDialog v={v} open onOpenChange={setScheduling} />}
      {publishing && <PublishedDialog v={v} post={publishing} open onOpenChange={(o) => !o && setPublishing(null)} />}
    </li>
  );
}

export function LivePublishing() {
  const [month, setMonth] = useState(thisMonth());
  const queue = usePublishingQueue(month);
  const quotas = useQuotas(month);
  const waiting = (queue.data ?? []).filter((v) => v.stage === "approved");
  const published = (queue.data ?? []).filter((v) => v.stage === "published");
  return (
    <>
      <PageHeader
        title="Publishing"
        description="Approved videos scheduled on each client's platforms: connected platforms post them by themselves at their time; others are marked as published with the link and a screenshot. And each client's monthly quota."
        actions={<MonthSwitcher month={month} onChange={setMonth} />}
      />
      <Tabs defaultValue="queue">
        <TabsList>
          <TabsTrigger value="queue">To publish ({waiting.length})</TabsTrigger>
          <TabsTrigger value="quotas">Quotas</TabsTrigger>
          <TabsTrigger value="published">Published</TabsTrigger>
        </TabsList>
        <TabsContent value="queue">
          {queue.isPending ? (
            <SkeletonRows rows={4} />
          ) : queue.error ? (
            <Alert tone="danger">{errorMessage(queue.error)}</Alert>
          ) : !waiting.length ? (
            <EmptyState icon={Megaphone} title="Nothing waiting" description="Videos the client approves come here to be scheduled." />
          ) : (
            <ul className="space-y-2">
              {waiting.map((v) => (
                <QueueRow key={v.id} v={v} />
              ))}
            </ul>
          )}
        </TabsContent>
        <TabsContent value="quotas">
          {quotas.isPending ? (
            <SkeletonRows rows={4} />
          ) : !quotas.data?.length ? (
            <EmptyState icon={Megaphone} title="No cycles this month" description="Monthly cycles are made from running agreements (Monthly delivery)." />
          ) : (
            <Card className="overflow-hidden">
              <Table>
                <THead>
                  <TR>
                    <TH>Client</TH>
                    <TH>Delivered</TH>
                    <TH numeric>Promised</TH>
                    <TH numeric>Scheduled</TH>
                    <TH numeric>In the making</TH>
                    <TH numeric>Not started</TH>
                    <TH />
                  </TR>
                </THead>
                <TBody>
                  {quotas.data.map((q) => (
                    <TR key={q.id}>
                      <TD>{q.client.name}</TD>
                      <TD className="min-w-40">
                        <Progress value={q.promised ? (q.delivered / q.promised) * 100 : 0} tone={q.atRisk ? "danger" : "success"} />
                        <span className="text-muted-foreground">{q.delivered}</span>
                      </TD>
                      <TD numeric>{q.promised}</TD>
                      <TD numeric>{q.scheduled}</TD>
                      <TD numeric>{q.inMaking}</TD>
                      <TD numeric>{q.notStarted}</TD>
                      <TD>{q.atRisk && <Badge tone="danger">At risk</Badge>}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="published">
          {!published.length ? (
            <EmptyState icon={CheckCircle2} title="Nothing published this month yet" />
          ) : (
            <ul className="space-y-2">
              {published.map((v) => (
                <QueueRow key={v.id} v={v} />
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}

const STATUS: Record<PlatformConnectionRow["status"], { label: string; tone: "neutral" | "success" | "warning" | "danger" }> = {
  manual: { label: "Posted by hand", tone: "neutral" },
  linked: { label: "Connected", tone: "success" },
  choose: { label: "Choose the account", tone: "warning" },
  expired: { label: "Connect again", tone: "danger" },
  error: { label: "Not connected", tone: "danger" },
};

const SOCIAL_RESULT: Record<string, { ok: boolean; text: string }> = {
  linked: { ok: true, text: "is connected — scheduled posts go out by themselves" },
  choose: { ok: true, text: "is signed in — choose the account to post to" },
  cancelled: { ok: false, text: "was not connected: signing in was cancelled" },
  none: { ok: false, text: "was not connected: no account came with that sign-in" },
  error: { ok: false, text: "could not be connected — see the reason below" },
  expired: { ok: false, text: "was not connected: the sign-in took too long — try again" },
};

/** Choosing the account to post to, when the sign-in reached several. */
function ChooseAccount({ clientId, row, onClose }: { clientId: string; row: PlatformConnectionRow; onClose: () => void }) {
  const accounts = usePlatformAccounts(clientId, row.id);
  const act = usePlatformAction(clientId);
  const [pick, setPick] = useState("");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Which {PLATFORM_LABEL[row.platform] ?? row.platform} account is {row.handle}?
          </DialogTitle>
          <DialogDescription>The sign-in gave access to these. Posts go to the one you choose.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {accounts.isPending ? (
            <SkeletonRows rows={2} />
          ) : accounts.error ? (
            <Alert tone="danger">{errorMessage(accounts.error)}</Alert>
          ) : (
            <ul className="space-y-1.5">
              {accounts.data.map((a) => (
                <li key={a.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 has-[:checked]:border-primary">
                    <input type="radio" name="account" value={a.id} checked={pick === a.id} onChange={() => setPick(a.id)} />
                    <span>
                      <span className="font-medium">{a.name}</span>
                      {a.handle && <span className="text-muted-foreground"> · {a.handle}</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Later
          </Button>
          <Button
            disabled={!pick || act.isPending}
            onClick={() =>
              act.mutate(
                { step: "choose", id: row.id, accountId: pick },
                { onSuccess: () => (toast.success("Connected"), onClose()), onError: (e) => toast.error(errorMessage(e)) },
              )
            }
          >
            Connect this account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlatformRow({ clientId, p, canEdit }: { clientId: string; p: PlatformConnectionRow; canEdit: boolean }) {
  const act = usePlatformAction(clientId);
  const connect = useConnectPlatform(clientId);
  const [choosing, setChoosing] = useState(false);
  const status = STATUS[p.status] ?? STATUS.manual;
  const onError = (e: unknown) => toast.error(errorMessage(e));
  const signIn = () => connect.mutate(p.id, { onSuccess: (r) => window.location.assign(r.url), onError });
  return (
    <li className="py-2 text-body">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0">
          <span className="font-medium">{PLATFORM_LABEL[p.platform] ?? p.platform}</span> · {p.handle}
          {p.linked && p.linked.name.toLowerCase() !== p.handle.replace(/^@/, "").toLowerCase() && (
            <span className="text-muted-foreground"> · posts to {p.linked.name}</span>
          )}
          {isSocialPlatform(p.platform) && (
            <Badge tone={status.tone} className="ml-2">
              {status.label}
            </Badge>
          )}
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          {p.status === "linked" && (
            <label className="mr-1 flex items-center gap-2 text-muted-foreground">
              <Switch
                checked={p.autoPublish}
                disabled={!canEdit || act.isPending}
                onCheckedChange={(autoPublish) => act.mutate({ step: "auto", id: p.id, autoPublish }, { onError })}
                aria-label="Post scheduled videos by themselves"
              />
              Posts by itself
            </label>
          )}
          {canEdit && p.canConnect && p.status === "choose" && (
            <Button size="xs" variant="secondary" onClick={() => setChoosing(true)}>
              <Link2 />
              Choose the account
            </Button>
          )}
          {canEdit && p.canConnect && p.status !== "linked" && (
            <Button size="xs" variant={p.status === "manual" ? "secondary" : "default"} disabled={connect.isPending} onClick={signIn}>
              <Link2 />
              {p.status === "manual" ? "Connect" : "Connect again"}
            </Button>
          )}
          {canEdit && p.status === "linked" && (
            <Button size="xs" variant="ghost" disabled={act.isPending} onClick={() => act.mutate({ step: "disconnect", id: p.id }, { onError })}>
              <Unplug />
              Disconnect
            </Button>
          )}
          {canEdit && (
            <Button size="icon-sm" variant="ghost" aria-label={`Remove ${p.platform}`} onClick={() => act.mutate({ step: "remove", id: p.id }, { onError })}>
              <Trash2 />
            </Button>
          )}
        </span>
      </div>
      {p.lastError && p.status !== "linked" && <p className="mt-1 text-danger">{p.lastError}</p>}
      {choosing && <ChooseAccount clientId={clientId} row={p} onClose={() => setChoosing(false)} />}
    </li>
  );
}

/** The client's platforms (client page): where videos are published, and which are connected to post by themselves. */
export function ClientPlatforms({ clientId, canEdit }: { clientId: string; canEdit: boolean }) {
  const list = usePlatforms(clientId);
  const social = useSocial();
  const act = usePlatformAction(clientId);
  const [platform, setPlatform] = useState("");
  const [handle, setHandle] = useState("");
  // Back from a platform's sign-in: say how it went, once.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const result = SOCIAL_RESULT[q.get("social") ?? ""];
    if (!result) return;
    const name = PLATFORM_LABEL[q.get("platform") ?? ""] ?? "The platform";
    (result.ok ? toast.success : toast.error)(`${name} ${result.text}`);
    q.delete("social");
    q.delete("platform");
    window.history.replaceState(null, "", `${window.location.pathname}${q.size ? `?${q}` : ""}`);
  }, []);
  const someOff = social.data && Object.values(social.data.available).some((v) => !v);
  return (
    <SectionCard
      title="Platforms"
      description="Where the client's videos are published. Connect Instagram, Facebook, YouTube, LinkedIn and X to post scheduled videos by themselves and bring in the numbers each day; the others are posted by hand."
    >
      {social.data?.provider === "outbox" && (
        <Alert tone="info" className="mb-3">
          On this server the platforms are pretend ones — connecting and posting are tried out, nothing is really posted.
        </Alert>
      )}
      {someOff && social.data?.provider === "live" && (
        <Alert tone="info" className="mb-3">
          Connecting{" "}
          {(["instagram", "facebook", "youtube"] as const)
            .filter((x) => !social.data!.available[x])
            .map((x) => PLATFORM_LABEL[x])
            .join(", ")}{" "}
          is not switched on yet — post those by hand meanwhile.
        </Alert>
      )}
      {list.data && list.data.length > 0 && (
        <ul className="mb-3 divide-y divide-border-subtle">
          {list.data.map((p) => (
            <PlatformRow key={p.id} clientId={clientId} p={p} canEdit={canEdit} />
          ))}
        </ul>
      )}
      {list.data && !list.data.length && <p className="mb-3 text-body text-muted-foreground">None yet.</p>}
      {canEdit && (
        <div className="grid gap-2 sm:grid-cols-[150px_1fr_auto]">
          <Select
            aria-label="Platform"
            value={platform || undefined}
            placeholder="Platform"
            onValueChange={setPlatform}
            options={PLATFORMS.filter((p) => !list.data?.some((x) => x.platform === p)).map((p) => ({ value: p, label: PLATFORM_LABEL[p] }))}
          />
          <Input placeholder="@handle or page" value={handle} onChange={(e) => setHandle(e.target.value)} />
          <Button
            variant="secondary"
            disabled={!platform || !handle.trim()}
            onClick={() =>
              act.mutate(
                { step: "add", platform, handle: handle.trim() },
                { onSuccess: () => (setPlatform(""), setHandle("")), onError: (e) => toast.error(errorMessage(e)) },
              )
            }
          >
            Add
          </Button>
        </div>
      )}
    </SectionCard>
  );
}

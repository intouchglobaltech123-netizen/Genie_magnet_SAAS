"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Camera, CheckCheck, Clapperboard, PenLine, Play, Plus } from "lucide-react";
import { toast } from "sonner";
import { SHOOT_STATUS_LABEL, type ShootDetail, shootInput, type ShootStatus } from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ApiError, errorMessage } from "./api";
import { NoteDialog } from "./deals";
import { fmtDate } from "./format";
import { minutes, StageBadge, TimeLog, UrgencyBadge, usePeople } from "./production-bits";
import { useCan, useClients, useCreateShoot, useProductionSettings, useShoot, useShootAction, useShoots, useVideoAction, useVideos } from "./queries";

const STATUS_TONE: Record<ShootStatus, BadgeTone> = { planned: "neutral", packed: "info", on_shoot: "warning", returned: "accent", closed: "success" };
export const ShootStatusBadge = ({ status }: { status: ShootStatus }) => (
  <Badge tone={STATUS_TONE[status]} dot>
    {SHOOT_STATUS_LABEL[status]}
  </Badge>
);

function NewShootDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const clients = useClients();
  const settings = useProductionSettings();
  const people = usePeople();
  const create = useCreateShoot();
  const [f, setF] = useState({
    clientId: "",
    title: "",
    date: "",
    callTime: "07:00",
    location: "",
    batchNo: "",
    kit: "dual",
    cameraId: "",
    directorId: "",
    videoIds: [] as string[],
  });
  const videos = useVideos(f.clientId ? `clientId=${f.clientId}` : "", !!f.clientId);
  const waiting = (videos.data ?? []).filter((v) => ["planned", "scripting", "shoot_scheduled"].includes(v.stage) && (!v.shootId || f.videoIds.includes(v.id)));
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const parsed = shootInput.safeParse({
              ...f,
              location: f.location || undefined,
              batchNo: f.batchNo || undefined,
              cameraId: f.cameraId || undefined,
              directorId: f.directorId || undefined,
            });
            if (!parsed.success) return setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])));
            create.mutate(parsed.data, {
              onSuccess: (s) => {
                toast.success("Shoot scheduled", { description: "The crew is told." });
                onOpenChange(false);
                router.push(`/app/shoots/${s.id}`);
              },
              onError: (err) => err instanceof ApiError && err.body.issues && setErrors(Object.fromEntries(err.body.issues.map((i) => [i.path, i.message]))),
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>Schedule a shoot</DialogTitle>
            <DialogDescription>The videos you add move to Shoot scheduled; the camera person and director are told.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Client" required error={errors.clientId}>
                <Select
                  aria-label="Client"
                  value={f.clientId || undefined}
                  placeholder="Choose the client"
                  onValueChange={(v) => setF({ ...f, clientId: v, videoIds: [] })}
                  options={(clients.data ?? []).filter((c) => !c.archivedAt).map((c) => ({ value: c.id, label: c.name }))}
                />
              </Field>
              <Field label="Shoot" required error={errors.title}>
                <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Kitchen day" />
              </Field>
              <Field label="Date" required error={errors.date}>
                <Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
              </Field>
              <Field label="Call time" error={errors.callTime}>
                <Input type="time" value={f.callTime} onChange={(e) => setF({ ...f, callTime: e.target.value })} />
              </Field>
              <Field label="Location">
                <Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} />
              </Field>
              <Field label="Batch no.">
                <Input value={f.batchNo} onChange={(e) => setF({ ...f, batchNo: e.target.value })} placeholder="KVR-B17" />
              </Field>
              <Field label="Kit">
                <Select
                  aria-label="Kit"
                  value={f.kit}
                  onValueChange={(kit) => setF({ ...f, kit })}
                  options={(settings.data?.kits ?? []).map((k) => ({ value: k.key, label: k.name }))}
                />
              </Field>
              <Field label="Camera">
                <Select
                  aria-label="Camera"
                  value={f.cameraId || "_none"}
                  onValueChange={(v) => setF({ ...f, cameraId: v === "_none" ? "" : v })}
                  options={[{ value: "_none", label: "Not yet" }, ...people]}
                />
              </Field>
              <Field label="Content director">
                <Select
                  aria-label="Content director"
                  value={f.directorId || "_none"}
                  onValueChange={(v) => setF({ ...f, directorId: v === "_none" ? "" : v })}
                  options={[{ value: "_none", label: "Not yet" }, ...people]}
                />
              </Field>
            </div>
            {f.clientId && (
              <div>
                <div className="mb-1.5 text-body font-medium text-text-secondary">Videos in this shoot</div>
                {!waiting.length ? (
                  <p className="text-body text-muted-foreground">No videos of this client are waiting for a shoot.</p>
                ) : (
                  <ul className="max-h-48 space-y-1 overflow-y-auto">
                    {waiting.map((v) => (
                      <li key={v.id}>
                        <label className="flex items-center gap-2 text-body">
                          <Checkbox
                            checked={f.videoIds.includes(v.id)}
                            onCheckedChange={(on) => setF({ ...f, videoIds: on ? [...f.videoIds, v.id] : f.videoIds.filter((x) => x !== v.id) })}
                          />
                          <span className="tabular-nums">{v.code}</span> {v.title}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {create.error && !(create.error instanceof ApiError && create.error.body.issues) && <Alert tone="danger">{errorMessage(create.error)}</Alert>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              <Camera />
              Schedule
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function LiveShoots() {
  const can = useCan();
  const shoots = useShoots();
  const [adding, setAdding] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (shoots.data ?? []).filter((s) => s.date >= today && s.status !== "closed");
  const past = (shoots.data ?? []).filter((s) => !(s.date >= today && s.status !== "closed")).reverse();
  const card = (s: NonNullable<typeof shoots.data>[number]) => (
    <li key={s.id}>
      <Link href={`/app/shoots/${s.id}`} className="block rounded-xl border border-border bg-card p-4 hover:border-secondary/40">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <span>
            <span className="text-body font-semibold">{s.title}</span>
            <span className="block text-body text-muted-foreground">
              {s.client.name} · {fmtDate(s.date)}
              {s.callTime && ` · ${s.callTime}`}
              {s.location && ` · ${s.location}`}
            </span>
          </span>
          <span className="flex gap-1.5">
            {s.openIncidents > 0 && (
              <Badge tone="danger">
                <AlertTriangle />
                {s.openIncidents} open
              </Badge>
            )}
            <ShootStatusBadge status={s.status} />
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-body text-muted-foreground">
          <span>{s.videos === 1 ? "1 video" : `${s.videos} videos`}</span>
          <span>{s.camera?.name ?? "No camera yet"}</span>
          <span className="flex min-w-40 flex-1 items-center gap-2">
            <Progress value={s.items ? ((s.status === "planned" ? s.packed : s.received) / s.items) * 100 : 0} className="flex-1" />
            {s.status === "planned" ? `${s.packed}/${s.items} packed` : `${s.received}/${s.items} back`}
          </span>
        </div>
      </Link>
    </li>
  );
  return (
    <>
      <PageHeader
        title="Shoots"
        description="Shoot days with their crew and videos, the kit going out and coming back with signatures, and anything that went missing."
        actions={
          can("production", "edit") && (
            <Button onClick={() => setAdding(true)}>
              <Plus />
              Schedule a shoot
            </Button>
          )
        }
      />
      {shoots.isPending ? (
        <SkeletonRows rows={4} />
      ) : shoots.error ? (
        <Alert tone="danger">{errorMessage(shoots.error)}</Alert>
      ) : !shoots.data.length ? (
        <EmptyState icon={Camera} title="No shoots yet" />
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 text-body font-semibold text-text-secondary">Coming up</h2>
            {upcoming.length ? <ul className="space-y-2">{upcoming.map(card)}</ul> : <p className="text-body text-muted-foreground">Nothing scheduled.</p>}
          </section>
          {past.length > 0 && (
            <section>
              <h2 className="mb-2 text-body font-semibold text-text-secondary">Done and earlier</h2>
              <ul className="space-y-2">{past.map(card)}</ul>
            </section>
          )}
        </div>
      )}
      {adding && <NewShootDialog open onOpenChange={setAdding} />}
    </>
  );
}

// ─── The shoot sheet ──────────────────────────────────────────────────

function ClipCell({ videoId, clipNo, editable }: { videoId: string; clipNo: string | null; editable: boolean }) {
  const act = useVideoAction(videoId);
  const [clip, setClip] = useState(clipNo ?? "");
  return (
    <Input
      className="h-8 w-36"
      aria-label="Clip numbers"
      value={clip}
      disabled={!editable}
      placeholder="C0012–C0019"
      onChange={(e) => setClip(e.target.value)}
      onBlur={() =>
        clip !== (clipNo ?? "") && act.mutate({ path: "", method: "PATCH", body: { clipNo: clip } }, { onError: (e) => toast.error(errorMessage(e)) })
      }
    />
  );
}

function VpCell({ videoId, on, editable }: { videoId: string; on: boolean; editable: boolean }) {
  const act = useVideoAction(videoId);
  return (
    <Checkbox
      aria-label="Footage protected"
      checked={on}
      disabled={!editable}
      onCheckedChange={(v) => act.mutate({ path: "/protect", method: "PUT", body: { done: v === true } }, { onError: (e) => toast.error(errorMessage(e)) })}
    />
  );
}

function Kit({ s, editable }: { s: ShootDetail; editable: boolean }) {
  const act = useShootAction(s.id);
  const tick = (item: string, column: "packed" | "shot" | "received", done: boolean) =>
    act.mutate({ path: "/kit", method: "PUT", body: { item, column, done } }, { onError: (e) => toast.error(errorMessage(e)) });
  const packed = s.kit.items.filter((i) => s.kitTicks[i]?.packed).length;
  const received = s.kit.items.filter((i) => s.kitTicks[i]?.received).length;
  const missing = s.status === "on_shoot" || s.status === "returned" ? s.kit.items.filter((i) => s.kitTicks[i]?.packed && !s.kitTicks[i]?.received) : [];
  return (
    <SectionCard
      title={`Kit: ${s.kit.name}`}
      description={`${packed}/${s.kit.items.length} packed · ${received}/${s.kit.items.length} back`}
      contentClassName="p-0"
      actions={
        editable && (
          <span className="flex gap-2">
            {s.status === "planned" && (
              <Button size="xs" variant="secondary" onClick={() => act.mutate({ path: "/kit/all", body: { column: "packed" } })}>
                <CheckCheck />
                All packed
              </Button>
            )}
            {(s.status === "on_shoot" || s.status === "packed") && (
              <Button size="xs" variant="secondary" onClick={() => act.mutate({ path: "/kit/all", body: { column: "received" } })}>
                <CheckCheck />
                All back
              </Button>
            )}
          </span>
        )
      }
    >
      <Table>
        <THead>
          <TR>
            <TH>Item</TH>
            <TH>Packed</TH>
            <TH>Used</TH>
            <TH>Back</TH>
          </TR>
        </THead>
        <TBody>
          {s.kit.items.map((i) => {
            const t = s.kitTicks[i] ?? {};
            return (
              <TR key={i} className={cn(missing.includes(i) && "bg-danger-soft/40")}>
                <TD>{i}</TD>
                {(["packed", "shot", "received"] as const).map((col) => (
                  <TD key={col}>
                    <Checkbox
                      aria-label={`${i}: ${col}`}
                      checked={!!t[col]}
                      disabled={!editable || s.status === "closed" || (col === "packed" && s.status !== "planned")}
                      onCheckedChange={(on) => tick(i, col, on === true)}
                    />
                  </TD>
                ))}
              </TR>
            );
          })}
        </TBody>
      </Table>
    </SectionCard>
  );
}

export function LiveShoot({ id }: { id: string }) {
  const can = useCan();
  const shoot = useShoot(id);
  const act = useShootAction(id);
  const [clientName, setClientName] = useState("");
  const [incident, setIncident] = useState(false);
  if (shoot.isPending) return <SkeletonRows rows={8} />;
  if (shoot.error) return <Alert tone="danger">{errorMessage(shoot.error)}</Alert>;
  const s = shoot.data;
  const editable = can("production", "edit");
  const run = (path: string, done: string, body?: unknown) =>
    act.mutate({ path, body }, { onSuccess: () => toast.success(done), onError: (e) => toast.error(errorMessage(e)) });
  const missing = s.kit.items.filter((i) => s.kitTicks[i]?.packed && !s.kitTicks[i]?.received);
  const sig = (k: "giver" | "receiver" | "client") => s.signatures[k];
  const signed = (k: "giver" | "receiver") => [sig(k)!.byName, fmtDate(sig(k)!.at)].filter(Boolean).join(" · ");
  return (
    <>
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
        <Link href="/app/shoots">
          <ArrowLeft />
          Shoots
        </Link>
      </Button>
      <PageHeader
        eyebrow={<ShootStatusBadge status={s.status} />}
        title={s.title}
        description={`${s.client.name} · ${fmtDate(s.date)}${s.callTime ? ` · call ${s.callTime}` : ""}${s.location ? ` · ${s.location}` : ""}${s.batchNo ? ` · batch ${s.batchNo}` : ""}`}
        actions={
          editable && (
            <>
              {s.status === "packed" && (
                <Button onClick={() => run("/start", "Shoot started")}>
                  <Play />
                  Start the shoot
                </Button>
              )}
              {(s.status === "on_shoot" || s.status === "returned") && s.videos.some((v) => v.stage === "shoot_scheduled") && (
                <Button variant="secondary" onClick={() => run("/videos-shot", "Videos moved to Shot")}>
                  <Clapperboard />
                  Videos are shot
                </Button>
              )}
              <Button variant="ghost" onClick={() => setIncident(true)}>
                <AlertTriangle />
                Raise an incident
              </Button>
            </>
          )
        }
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          <SectionCard title="Videos in this shoot" contentClassName="p-0">
            {!s.videos.length ? (
              <p className="px-5 pb-5 text-body text-muted-foreground">No videos added.</p>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Code</TH>
                    <TH>Video</TH>
                    <TH>Clip no.</TH>
                    <TH>VP</TH>
                    <TH>Editor</TH>
                    <TH>Stage</TH>
                  </TR>
                </THead>
                <TBody>
                  {s.videos.map((v) => (
                    <TR key={v.id}>
                      <TD>
                        <Link href={`/app/production/${v.id}`} className="tabular-nums font-medium hover:underline">
                          {v.code}
                        </Link>
                        <div>
                          <UrgencyBadge urgency={v.urgency} />
                        </div>
                      </TD>
                      <TD>{v.title}</TD>
                      <TD>
                        <ClipCell videoId={v.id} clipNo={v.clipNo} editable={editable} />
                      </TD>
                      <TD>
                        <VpCell videoId={v.id} on={v.protected} editable={editable} />
                      </TD>
                      <TD>{v.editor?.name ?? "—"}</TD>
                      <TD>
                        <StageBadge stage={v.stage} />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </SectionCard>
          <Kit s={s} editable={editable} />
        </div>
        <div className="space-y-4">
          <SectionCard title="Crew">
            <dl className="space-y-1 text-body">
              <div>
                <dt className="inline text-muted-foreground">Camera: </dt>
                <dd className="inline">{s.camera?.name ?? "—"}</dd>
              </div>
              <div>
                <dt className="inline text-muted-foreground">Content director: </dt>
                <dd className="inline">{s.director?.name ?? "—"}</dd>
              </div>
            </dl>
            {s.notes && <p className="mt-2 whitespace-pre-line text-body text-muted-foreground">{s.notes}</p>}
          </SectionCard>
          <SectionCard
            title="Time"
            description={s.minutes ? `${minutes(s.minutes)} logged on this shoot.` : "Travel, set-up, shooting and bringing the kit back."}
          >
            <TimeLog
              logs={s.timeLogs}
              canEdit={editable}
              defaultDate={s.date}
              onLog={(entry, done) => act.mutate({ path: "/time", body: entry }, { onSuccess: done, onError: (e) => toast.error(errorMessage(e)) })}
              onRemove={(logId) => act.mutate({ path: `/time/${logId}`, method: "DELETE" }, { onError: (e) => toast.error(errorMessage(e)) })}
            />
          </SectionCard>
          <SectionCard title="Before the shoot">
            <ul className="space-y-1.5">
              {s.preShootItems.map((i) => (
                <li key={i}>
                  <label className="flex items-center gap-2 text-body">
                    <Checkbox
                      checked={!!s.preShoot[i]}
                      disabled={!editable || s.status === "closed"}
                      onCheckedChange={(on) => act.mutate({ path: "/pre-shoot", method: "PUT", body: { item: i, done: on === true } })}
                    />
                    {i}
                  </label>
                </li>
              ))}
            </ul>
          </SectionCard>
          <SectionCard title="Signatures" description="Kit out, kit back, and the client's sign-off.">
            <ul className="space-y-3 text-body">
              <li className="flex items-center justify-between gap-2">
                <span>
                  <span className="font-medium">Kit signed out</span>
                  <span className="block text-muted-foreground">{sig("giver") ? signed("giver") : "Once everything is packed"}</span>
                </span>
                {!sig("giver") && editable && (
                  <Button size="xs" onClick={() => run("/sign", "Kit signed out", { as: "giver" })}>
                    <PenLine />
                    Sign
                  </Button>
                )}
              </li>
              <li className="flex items-center justify-between gap-2">
                <span>
                  <span className="font-medium">Kit back</span>
                  <span className="block text-muted-foreground">
                    {sig("receiver")
                      ? signed("receiver")
                      : missing.length && s.status !== "planned"
                        ? `Not back yet: ${missing.length} ${missing.length === 1 ? "item" : "items"}`
                        : "Once everything is back"}
                  </span>
                </span>
                {!sig("receiver") && sig("giver") && editable && (
                  <Button size="xs" onClick={() => run("/sign", "Kit back", { as: "receiver" })}>
                    <PenLine />
                    Sign
                  </Button>
                )}
              </li>
              <li className="space-y-1.5">
                <span className="font-medium">Client sign-off</span>
                {sig("client") ? (
                  <span className="block text-muted-foreground">
                    {sig("client")!.name} · {fmtDate(sig("client")!.at)}
                  </span>
                ) : sig("receiver") && editable ? (
                  <span className="flex gap-2">
                    <Input placeholder="Client's name" value={clientName} onChange={(e) => setClientName(e.target.value)} />
                    <Button size="sm" disabled={!clientName.trim()} onClick={() => run("/sign", "Closed", { as: "client", name: clientName.trim() })}>
                      Sign
                    </Button>
                  </span>
                ) : (
                  <span className="block text-muted-foreground">After the kit is back</span>
                )}
              </li>
            </ul>
          </SectionCard>
          {s.incidents.length > 0 && (
            <SectionCard title="Incidents">
              <ul className="space-y-2">
                {s.incidents.map((i) => (
                  <li
                    key={i.id}
                    className={cn("rounded-lg border p-2.5 text-body", i.resolved ? "border-border opacity-60" : "border-danger/30 bg-danger-soft/30")}
                  >
                    <div>{i.note}</div>
                    {i.items.length > 0 && <div className="text-muted-foreground">{i.items.join(", ")}</div>}
                    {!i.resolved && editable && (
                      <Button size="xs" variant="ghost" className="mt-1" onClick={() => run(`/incidents/${i.id}/resolve`, "Resolved")}>
                        Resolved
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </div>
      </div>
      <NoteDialog
        open={incident}
        title="Raise an incident"
        description={missing.length ? `Not back yet: ${missing.join(", ")}. What happened?` : "What happened?"}
        required
        confirm="Raise"
        onClose={() => setIncident(false)}
        onConfirm={(note) => {
          setIncident(false);
          run("/incidents", "Incident raised", { items: missing, note });
        }}
      />
    </>
  );
}

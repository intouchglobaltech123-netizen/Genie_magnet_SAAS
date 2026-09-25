"use client";

import { useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { AlertTriangle, ArrowLeft, Camera, Check, CheckCheck, CloudOff, MapPin, PackageCheck, PenLine, Play, Printer, Save, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";
import { UrgencyIcon } from "@/components/shared/video-bits";
import { clientById, kitItems, personById, preShootItems, shoots } from "@/lib/mock/core";
import { useDemo } from "@/lib/store";
import type { Shoot } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ClientTag } from "../bits";
import { fmt } from "../lib";
import { defaultKit, defaultPreShoot, useProduction, useProductionHydration, type Tick } from "../store";
import { shootStatusMeta } from "./shoots-list";
import { SignaturePad } from "./signature-pad";

const STATUS_FLOW: Shoot["status"][] = ["planned", "packed", "on-shoot", "returned", "closed"];
const COLS: { key: keyof Tick; label: string }[] = [
  { key: "packed", label: "Packed" },
  { key: "shot", label: "Shooted" },
  { key: "received", label: "Received" },
];

export function ShootSheet({ id }: { id: string }) {
  useProductionHydration();
  const shoot = shoots.find((s) => s.id === id);
  if (!shoot) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <Camera className="size-8 text-muted-foreground" />
        <div className="text-subheading font-semibold">Shoot not found</div>
        <Button variant="outline" asChild>
          <Link href="/shoots">
            <ArrowLeft /> Back to shoots
          </Link>
        </Button>
      </div>
    );
  }
  return <Sheet shoot={shoot} />;
}

function Sheet({ shoot }: { shoot: Shoot }) {
  const allVideos = useDemo((s) => s.videos);
  const updateVideo = useDemo((s) => s.updateVideo);
  const log = useDemo((s) => s.log);
  const p = useProduction();

  const kit = p.kit[shoot.id] ?? defaultKit(shoot);
  const pre = p.preShoot[shoot.id] ?? defaultPreShoot(shoot);
  const sign = { ...defaultSigns(shoot), ...p.shootSign[shoot.id] };
  const status = p.shootStatus[shoot.id] ?? shoot.status;
  const notes = p.shootNotes[shoot.id] ?? shoot.notes;
  const [notesDraft, setNotesDraft] = useState(notes);
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [incidentNote, setIncidentNote] = useState("");

  const items = kitItems[shoot.kit];
  const videos = allVideos.filter((v) => shoot.videoIds.includes(v.id));
  const count = (col: keyof Tick) => items.filter((it) => kit[it]?.[col]).length;
  const allPacked = count("packed") === items.length;
  const allReceived = count("received") === items.length;
  const missing = items.filter((it) => kit[it]?.packed && !kit[it]?.received);
  const returnPhase = status === "on-shoot" || status === "returned" || count("received") > 0;
  const c = clientById(shoot.clientId);

  const doSign = (who: "giver" | "receiver") => {
    const by = who === "giver" ? "Surya Prakash (cover for Naveen)" : personById(shoot.cameraId).name;
    p.signShoot(shoot.id, who, { by, at: new Date().toISOString() });
    if (who === "giver") {
      p.setShootStatus(shoot.id, "packed");
      log(`${shoot.batchNo} kit handed over to ${personById(shoot.cameraId).name} — ${items.length}/${items.length} packed`, "success");
      toast.success("Giver signed — kit handed over", { description: `${items.length} items released for ${shoot.projectName}` });
    } else {
      p.setShootStatus(shoot.id, sign.client ? "closed" : "returned");
      log(`${shoot.batchNo} kit returned and checked in — all ${items.length} items received`, "success");
      toast.success("Receiver signed — kit checked in");
    }
  };

  return (
    <div>
      <Link href="/shoots" className="mb-4 inline-flex items-center gap-1.5 text-body text-muted-foreground transition hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Shoots & Kit
      </Link>

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <ClientTag clientId={shoot.clientId} />
            <span className="font-mono text-body font-semibold">{shoot.batchNo}</span>
            <Badge tone={shootStatusMeta[status].tone} dot>
              {shootStatusMeta[status].label}
            </Badge>
            <Tooltip content="This sheet is available in the offline field app — ticks sync automatically when the phone reconnects.">
              <span>
                <Badge tone="gold">
                  <CloudOff /> Offline ready
                </Badge>
              </span>
            </Tooltip>
          </div>
          <h1 className="text-heading font-semibold leading-tight tracking-tight">{shoot.projectName}</h1>
          <p className="mt-1 text-body text-muted-foreground">Digital shoot sheet · works offline in the field app and syncs when back on network.</p>
        </div>
        <div className="flex gap-2">
          {status === "packed" && (
            <Button
              variant="outline"
              onClick={() => {
                p.setShootStatus(shoot.id, "on-shoot");
                log(`${shoot.batchNo} shoot started at ${shoot.location}`, "accent");
                toast.success("Shoot started", { description: "Tick items in the Shooted column as they are used." });
              }}
            >
              <Play /> Start shoot
            </Button>
          )}
          <Button variant="outline" onClick={() => toast.success("Shoot sheet exported", { description: `${shoot.batchNo}-shoot-sheet.pdf (A4)` })}>
            <Printer /> Print
          </Button>
        </div>
      </div>

      {/* status flow */}
      <div className="mb-5 flex items-center gap-1 overflow-x-auto scrollbar-thin">
        {STATUS_FLOW.map((s, i) => {
          const cur = STATUS_FLOW.indexOf(status);
          return (
            <div key={s} className="flex items-center gap-1">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-body font-medium",
                  i < cur ? "bg-primary-soft text-primary" : i === cur ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {i < cur && <Check className="size-3" />}
                {shootStatusMeta[s].label}
              </span>
              {i < STATUS_FLOW.length - 1 && <span className="h-px w-5 bg-border" />}
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          {/* Paper form header */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-2.5">
              <span className="text-body font-semibold uppercase tracking-[0.18em] text-muted-foreground">Genie Magnet · Shoot sheet</span>
              <span className="font-mono text-body text-muted-foreground">{shoot.id.toUpperCase()}</span>
            </div>
            <div className="grid grid-cols-2 gap-px bg-border md:grid-cols-4">
              {(
                [
                  ["Project name", shoot.projectName],
                  ["Shooting date", `${fmt(shoot.date, "EEE, d MMM yyyy")}`],
                  ["Batch no.", <span key="b" className="font-mono">{shoot.batchNo}</span>],
                  ["Call time", shoot.callTime],
                  ["Camera man", <span key="cm" className="inline-flex items-center gap-1.5"><Avatar name={personById(shoot.cameraId).name} size="xs" />{personById(shoot.cameraId).name}</span>],
                  ["Content director", <span key="cd" className="inline-flex items-center gap-1.5"><Avatar name={personById(shoot.directorId).name} size="xs" />{personById(shoot.directorId).name}</span>],
                  ["Shoot location", <span key="l" className="inline-flex items-start gap-1"><MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />{shoot.location}</span>],
                  ["Video count", `${shoot.videoIds.length} videos · ${shoot.kit === "dual" ? "Dual" : "Single"} cam`],
                ] as [string, React.ReactNode][]
              ).map(([k, val]) => (
                <div key={k} className="bg-card px-4 py-3">
                  <div className="text-body font-medium uppercase tracking-wider text-muted-foreground">{k}</div>
                  <div className="mt-1 text-body font-medium">{val}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Videos in this shoot */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Videos in this shoot</CardTitle>
                <CardDescription>Fill clip numbers on set — they carry through to the editing sheet.</CardDescription>
              </div>
            </CardHeader>
            <Table>
              <THead>
                <TR>
                  <TH>Video code</TH>
                  <TH>Urgency</TH>
                  <TH>Video name</TH>
                  <TH>Clip no.</TH>
                  <TH className="text-center">VP</TH>
                  <TH>Editor</TH>
                </TR>
              </THead>
              <TBody>
                {videos.map((v) => (
                  <TR key={v.id}>
                    <TD className="font-mono text-body font-medium">
                      <Link href={`/production/${v.id}`} className="hover:text-primary">
                        {v.code}
                      </Link>
                    </TD>
                    <TD>
                      <UrgencyIcon urgency={v.urgency} withLabel />
                    </TD>
                    <TD className="max-w-[260px] truncate font-medium">{v.title}</TD>
                    <TD>
                      <Input value={v.clipNo} onChange={(e) => updateVideo(v.id, { clipNo: e.target.value })} className="h-8 w-40 font-mono text-body" />
                    </TD>
                    <TD className="text-center">
                      <Checkbox
                        checked={v.videoProtection}
                        className="data-[state=checked]:border-success data-[state=checked]:bg-success"
                        onCheckedChange={(ch) => {
                          updateVideo(v.id, { videoProtection: !!ch });
                          log(`${v.code} VP ${ch ? "ticked on shoot sheet" : "removed"}`, ch ? "success" : "warning");
                          toast(ch ? `${v.code} footage protected` : `${v.code} VP removed`);
                        }}
                      />
                    </TD>
                    <TD>
                      <span className="inline-flex items-center gap-1.5 text-body">
                        <Avatar name={personById(v.editorId).name} size="xs" />
                        {personById(v.editorId).name}
                      </span>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>

          {/* Equipment checklist */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Equipment checklist · {shoot.kit === "dual" ? "Dual Cam Shoot" : "Single Cam Shoot"}</CardTitle>
                <CardDescription>Tick when packed at the studio, used on the shoot, and received back.</CardDescription>
              </div>
              <div className="flex flex-wrap justify-end gap-1.5">
                <Button
                  size="xs"
                  variant="outline"
                  disabled={allPacked}
                  onClick={() => {
                    p.setColumn(shoot.id, "packed", true);
                    toast.success(`All ${items.length} items marked packed`);
                  }}
                >
                  <PackageCheck /> Mark all packed
                </Button>
                {returnPhase && (
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={allReceived}
                    onClick={() => {
                      p.setColumn(shoot.id, "received", true);
                      toast.success(`All ${items.length} items marked received`);
                    }}
                  >
                    <CheckCheck /> Mark all received
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pb-0">
              <div className="grid grid-cols-3 gap-3 pb-4">
                {COLS.map((col) => (
                  <div key={col.key} className="rounded-xl border border-border px-3 py-2.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-body font-medium text-muted-foreground">{col.label}</span>
                      <span className="text-subheading font-semibold tabular">
                        {count(col.key)}
                        <span className="text-body font-normal text-muted-foreground">/{items.length}</span>
                      </span>
                    </div>
                    <Progress value={(count(col.key) / items.length) * 100} tone={count(col.key) === items.length ? "success" : "accent"} className="mt-2" />
                  </div>
                ))}
              </div>
            </CardContent>
            <div className="max-h-[520px] overflow-y-auto border-t border-border scrollbar-thin">
              <Table>
                <THead className="sticky top-0 z-10 bg-card">
                  <TR>
                    <TH className="w-10">#</TH>
                    <TH>Item</TH>
                    {COLS.map((col) => (
                      <TH key={col.key} className="w-24 text-center">
                        {col.label}
                      </TH>
                    ))}
                  </TR>
                </THead>
                <TBody>
                  {items.map((it, i) => {
                    const t = kit[it] ?? { packed: false, shot: false, received: false };
                    const miss = t.packed && !t.received && returnPhase;
                    return (
                      <TR key={it} className={cn(miss && status === "returned" && "bg-warning-soft/40")}>
                        <TD className="text-body tabular text-muted-foreground">{i + 1}</TD>
                        <TD className="text-body">{it}</TD>
                        {COLS.map((col) => (
                          <TD key={col.key} className="text-center">
                            <Checkbox
                              checked={t[col.key]}
                              onCheckedChange={(ch) => p.setTick(shoot.id, it, col.key, !!ch)}
                              className={cn(col.key === "received" && "data-[state=checked]:border-success data-[state=checked]:bg-success")}
                            />
                          </TD>
                        ))}
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          {/* Sign-offs */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Kit sign-off</CardTitle>
                <CardDescription>Giver signs when everything is packed; receiver signs on return.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <SignBox
                label="Giver sign"
                sub="Store / technical"
                sig={sign.giver}
                enabled={allPacked}
                why={`${items.length - count("packed")} items not packed yet`}
                onSign={() => doSign("giver")}
              />
              <SignBox
                label="Receiver sign"
                sub={`On return · ${personById(shoot.cameraId).name}`}
                sig={sign.receiver}
                enabled={allReceived && !!sign.giver}
                why={!sign.giver ? "Giver must sign first" : `${items.length - count("received")} items not received`}
                onSign={() => doSign("receiver")}
              />
              {returnPhase && !allReceived && missing.length > 0 && (
                <div className="rounded-xl border border-warning/30 bg-warning-soft p-3">
                  <div className="flex items-center gap-2 text-body font-semibold text-warning">
                    <AlertTriangle className="size-4" /> {missing.length} items not returned
                  </div>
                  <ul className="mt-1.5 space-y-0.5 text-body text-foreground/80">
                    {missing.slice(0, 5).map((m) => (
                      <li key={m}>• {m}</li>
                    ))}
                    {missing.length > 5 && <li className="text-muted-foreground">+{missing.length - 5} more</li>}
                  </ul>
                  <Button size="xs" variant="danger" className="mt-2.5" onClick={() => setIncidentOpen(true)}>
                    <ShieldAlert /> Raise incident
                  </Button>
                </div>
              )}
              {p.incidents
                .filter((x) => x.shootId === shoot.id)
                .map((inc) => (
                  <div key={inc.id} className="rounded-xl border border-danger/30 bg-danger-soft p-3 text-body">
                    <div className="font-semibold text-danger">Incident raised · {format(parseISO(inc.at), "d MMM, HH:mm")}</div>
                    <div className="mt-0.5 text-foreground/80">{inc.items.join(", ")}</div>
                    {inc.note && <div className="mt-1 text-muted-foreground">“{inc.note}”</div>}
                  </div>
                ))}
            </CardContent>
          </Card>

          {/* Pre-shoot */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Pre-shoot checklist</CardTitle>
                <CardDescription>Set readiness before the talent arrives</CardDescription>
              </div>
              <span className="text-body font-semibold tabular">
                {preShootItems.filter((x) => pre[x]).length}/{preShootItems.length}
              </span>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-1.5">
              {preShootItems.map((it) => (
                <label
                  key={it}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-body transition",
                    pre[it] ? "border-primary/30 bg-primary-soft/40" : "border-border hover:bg-muted/50",
                  )}
                >
                  <Checkbox checked={!!pre[it]} onCheckedChange={(ch) => p.setPreShoot(shoot.id, it, !!ch)} />
                  {it}
                </label>
              ))}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Important notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} rows={3} placeholder="Consent forms, permissions, talent timings…" />
              <div className="flex justify-end">
                <Button
                  size="xs"
                  variant="outline"
                  disabled={notesDraft === notes}
                  onClick={() => {
                    p.setShootNotes(shoot.id, notesDraft);
                    toast.success("Notes saved");
                  }}
                >
                  <Save /> Save
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Client signature */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Client signature</CardTitle>
                <CardDescription>{c.contacts[0]!.name} confirms the shoot was completed as briefed.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {sign.client ? (
                <div className="rounded-xl border border-success/30 bg-success-soft/40 p-3">
                  {sign.client.dataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sign.client.dataUrl} alt="Client signature" className="h-20 w-full object-contain" />
                  ) : (
                    <div className="flex h-20 items-center justify-center font-[cursive] text-heading italic text-foreground/80">{sign.client.by}</div>
                  )}
                  <div className="mt-1 flex items-center gap-1.5 border-t border-border pt-2 text-body text-success">
                    <Check className="size-3.5" /> Signed by {sign.client.by} · {format(parseISO(sign.client.at), "d MMM, HH:mm")}
                  </div>
                </div>
              ) : (
                <SignaturePad
                  onSave={(dataUrl) => {
                    p.signShoot(shoot.id, "client", { by: c.contacts[0]!.name, at: new Date().toISOString(), dataUrl });
                    if (sign.receiver) p.setShootStatus(shoot.id, "closed");
                    log(`${c.contacts[0]!.name} signed the ${shoot.batchNo} shoot sheet`, "success");
                    toast.success("Client signature captured");
                  }}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-10 flex flex-col items-center gap-1 border-t border-border pt-6 text-center">
        <div className="text-body font-medium italic tracking-tight text-foreground/80">Shoot with purpose. Edit with precision. Deliver excellence.</div>
        <div className="text-body uppercase tracking-[0.2em] text-muted-foreground">Genie Magnet</div>
      </div>

      <Dialog open={incidentOpen} onOpenChange={setIncidentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Raise kit incident</DialogTitle>
            <DialogDescription>
              {shoot.batchNo} · {missing.length} items packed but not returned. Custodian: {personById(shoot.cameraId).name}.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {missing.map((m) => (
                <Badge key={m} tone="danger">
                  {m}
                </Badge>
              ))}
            </div>
            <Textarea value={incidentNote} onChange={(e) => setIncidentNote(e.target.value)} placeholder="What happened? e.g. Headset left at client location — courier arranged" rows={3} />
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIncidentOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                p.addIncident({ shootId: shoot.id, items: missing, note: incidentNote });
                log(`Kit incident on ${shoot.batchNo}: ${missing.length} items missing — assigned to ${personById(shoot.cameraId).name}`, "danger");
                toast.error("Incident raised", { description: `${missing.length} items flagged · Ashwin notified` });
                setIncidentOpen(false);
                setIncidentNote("");
              }}
            >
              <ShieldAlert /> Raise incident
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function defaultSigns(shoot: Shoot): { giver?: { by: string; at: string }; receiver?: { by: string; at: string }; client?: { by: string; at: string; dataUrl?: string } } {
  const out: ReturnType<typeof defaultSigns> = {};
  if (shoot.status !== "planned") out.giver = { by: "Naveen Raj", at: `${shoot.date}T06:10:00` };
  if (shoot.status === "closed") {
    out.receiver = { by: personById(shoot.cameraId).name, at: `${shoot.date}T20:05:00` };
    out.client = { by: clientById(shoot.clientId).contacts[0]!.name, at: `${shoot.date}T13:30:00` };
  }
  return out;
}

function SignBox({ label, sub, sig, enabled, why, onSign }: { label: string; sub: string; sig?: { by: string; at: string }; enabled: boolean; why: string; onSign: () => void }) {
  return (
    <div className={cn("flex items-center gap-3 rounded-xl border p-3", sig ? "border-success/30 bg-success-soft/40" : "border-dashed border-border")}>
      <div className="min-w-0 flex-1">
        <div className="text-body font-semibold">{label}</div>
        <div className="truncate text-body text-muted-foreground">
          {sig ? `${sig.by} · ${format(parseISO(sig.at), "d MMM, HH:mm")}` : enabled ? sub : why}
        </div>
      </div>
      {sig ? (
        <Badge tone="success">
          <Check /> Signed
        </Badge>
      ) : (
        <Button size="sm" variant={enabled ? "accent" : "outline"} disabled={!enabled} onClick={onSign}>
          <PenLine /> Sign
        </Button>
      )}
    </div>
  );
}

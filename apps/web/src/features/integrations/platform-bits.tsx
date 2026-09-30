"use client";

import { useState } from "react";
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, Plus, RefreshCw, ShieldCheck, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { clientById } from "@/lib/mock/core";
import { useDemo } from "@/lib/store";
import { cn, fmtDate } from "@/lib/utils";
import { PLATFORMS, platformById, POSTS_OWN_CHANNELS, useIntegrations, type PlatformDef, type PlatformId } from "./platforms";

export function PlatformTile({ p, size = "md", className }: { p: PlatformDef; size?: "sm" | "md" | "lg"; className?: string }) {
  const s = { sm: "size-5 text-[10px] rounded-md", md: "size-8 text-body rounded-lg", lg: "size-10 text-body rounded-xl" }[size];
  return (
    <span
      title={p.name}
      aria-label={p.name}
      className={cn("inline-flex shrink-0 items-center justify-center font-bold text-white", s, className)}
      style={{ backgroundColor: p.color }}
    >
      {p.abbr}
    </span>
  );
}

/** Connected accounts for one client, with "Add platform". */
export function ClientPlatforms({ clientId, dense }: { clientId: string; dense?: boolean }) {
  const all = useIntegrations((s) => s.connections);
  const reconnect = useIntegrations((s) => s.reconnect);
  const disconnect = useIntegrations((s) => s.disconnect);
  const log = useDemo((s) => s.log);
  const [adding, setAdding] = useState(false);
  const mine = all.filter((c) => c.clientId === clientId);
  const own = POSTS_OWN_CHANNELS[clientId];
  const c = clientById(clientId);

  return (
    <div className="space-y-2">
      {own && <div className="rounded-xl border border-dashed border-border-strong bg-surface-secondary p-3 text-body text-muted-foreground">{own}</div>}
      {mine.map((conn) => {
        const p = platformById(conn.platform);
        return (
          <div key={conn.id} className={cn("flex flex-wrap items-center gap-3 rounded-xl border p-3", conn.status === "error" ? "border-danger/30 bg-danger-soft/40" : conn.status === "expiring" ? "border-warning/30 bg-warning-soft/40" : "border-border bg-surface")}>
            <PlatformTile p={p} />
            <div className="min-w-0 flex-1 text-body">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{p.name}</span>
                <span className="text-muted-foreground">{conn.handle}</span>
              </div>
              <div className={cn(conn.status === "connected" ? "text-muted-foreground" : conn.status === "error" ? "text-danger" : "text-warning")}>
                {conn.note ?? `Connected ${fmtDate(conn.since, { day: "numeric", month: "short", year: "numeric" })}${dense ? "" : ` · ${p.supports.join(", ")}`}`}
              </div>
            </div>
            {conn.status === "connected" ? (
              <Badge tone="success">
                <CheckCircle2 /> Connected
              </Badge>
            ) : (
              <Button
                size="xs"
                variant={conn.status === "error" ? "danger" : "outline"}
                onClick={() => {
                  reconnect(conn.id);
                  log(`${c.name}: ${p.name} reconnected`, "success");
                  toast.success(`${p.name} reconnected`, { description: "Scheduled posts will go out as planned." });
                }}
              >
                <RefreshCw /> Reconnect
              </Button>
            )}
            {!dense && (
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Disconnect ${p.name}`}
                onClick={() => {
                  disconnect(conn.id);
                  toast(`${p.name} disconnected`, { description: "Nothing will be posted to this account." });
                }}
              >
                <Unplug />
              </Button>
            )}
          </div>
        );
      })}
      <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
        <Plus /> Add platform
      </Button>
      <AddPlatformDialog key={String(adding)} open={adding} onOpenChange={setAdding} clientId={clientId} />
    </div>
  );
}

const SCOPES: Record<string, string[]> = {
  Meta: ["Publish reels, posts and stories to the account you choose", "Read post insights (reach, views, saves)", "No access to your messages or ads billing"],
  Google: ["Upload videos and Shorts to the channel you choose", "Read video views and watch time", "No access to your email or other Google data"],
  LinkedIn: ["Post videos and updates to the page you choose", "Read page follower and post statistics"],
  X: ["Post updates and videos", "Read post engagement"],
};

export function AddPlatformDialog({ open, onOpenChange, clientId }: { open: boolean; onOpenChange: (o: boolean) => void; clientId: string }) {
  const connections = useIntegrations((s) => s.connections);
  const connect = useIntegrations((s) => s.connect);
  const log = useDemo((s) => s.log);
  const [step, setStep] = useState<"pick" | "allow" | "account">("pick");
  const [pid, setPid] = useState<PlatformId | null>(null);
  const c = clientById(clientId);
  const [handle, setHandle] = useState("");
  const p = pid ? platformById(pid) : undefined;
  const have = new Set(connections.filter((x) => x.clientId === clientId).map((x) => x.platform));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{step === "pick" ? `Add a platform for ${c.name}` : step === "allow" ? `Connect ${p!.name}` : `Choose the ${p!.name} account`}</DialogTitle>
          <DialogDescription>
            {step === "pick"
              ? "Every platform works the same way: schedule, publish, and bring results back into the monthly report."
              : step === "allow"
                ? `${c.contacts[0]!.name} signs in on ${p!.provider}'s own page and approves access — Genie Magnet never sees the password.`
                : "Pick the page or channel to post to."}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {step === "pick" && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PLATFORMS.map((x) => {
                const connected = have.has(x.id);
                return (
                  <button
                    key={x.id}
                    type="button"
                    disabled={!x.available || connected}
                    onClick={() => {
                      setPid(x.id);
                      setHandle(x.id === "youtube" ? `@${c.name.toLowerCase().replace(/[^a-z]/g, "")}` : x.id === "linkedin" || x.id === "facebook" ? c.name : `@${c.name.toLowerCase().replace(/[^a-z]/g, "")}`);
                      setStep("allow");
                    }}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3 text-left transition hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
                  >
                    <PlatformTile p={x} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-body font-semibold">{x.name}</span>
                      <span className="block truncate text-body text-muted-foreground">{x.supports.join(" · ")}</span>
                    </span>
                    {connected ? <Badge tone="success">Added</Badge> : !x.available ? <Badge tone="neutral">{x.phase}</Badge> : null}
                  </button>
                );
              })}
            </div>
          )}
          {step === "allow" && p && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-secondary p-3">
                <PlatformTile p={p} size="lg" />
                <div className="text-body">
                  <div className="font-semibold">Genie Magnet OS would like to:</div>
                  <div className="text-muted-foreground">Shown on {p.provider}&apos;s sign-in page</div>
                </div>
              </div>
              <ul className="space-y-1.5 text-body">
                {(SCOPES[p.provider] ?? SCOPES.Meta!).map((s) => (
                  <li key={s} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" /> {s}
                  </li>
                ))}
              </ul>
              <p className="flex items-center gap-1.5 text-body text-muted-foreground">
                <ShieldCheck className="size-4 text-success" /> Access can be removed any time, from here or from {p.provider}.
              </p>
            </div>
          )}
          {step === "account" && p && (
            <div className="space-y-3">
              <Field label={p.id === "youtube" ? "Channel" : p.id === "facebook" || p.id === "linkedin" ? "Page" : "Account"}>
                <Input value={handle} onChange={(e) => setHandle(e.target.value)} />
              </Field>
              <p className="flex items-start gap-2 text-body text-muted-foreground">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" /> Posts only go out after the client approves the video, in the slot you schedule.
              </p>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          {step !== "pick" && (
            <Button variant="ghost" className="mr-auto" onClick={() => setStep(step === "account" ? "allow" : "pick")}>
              <ArrowLeft /> Back
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {step === "allow" && <Button onClick={() => setStep("account")}>Allow access</Button>}
          {step === "account" && p && (
            <Button
              disabled={!handle.trim()}
              onClick={() => {
                connect(clientId, p.id, handle.trim());
                log(`${c.name}: ${p.name} connected (${handle.trim()})`, "success");
                toast.success(`${p.name} connected`, { description: `${handle.trim()} is ready for scheduling and insights.` });
                onOpenChange(false);
              }}
            >
              <CheckCircle2 /> Connect {p.name}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

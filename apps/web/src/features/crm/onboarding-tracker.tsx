"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Lock, LockOpen, Send, ShieldAlert, ShieldQuestion } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { onboardingClients, onboardingTemplate } from "@/lib/mock/crm";
import { useDemo } from "@/lib/store";
import { cn, inr } from "@/lib/utils";
import { useCrmDemo } from "./crm-store";

export function OnboardingTracker() {
  const [sel, setSel] = useState(onboardingClients[0]!.id);
  const { onboarding, exceptions } = useCrmDemo();
  const doneFor = (id: string) => onboarding[id] ?? onboardingClients.find((c) => c.id === id)!.initialDone;

  return (
    <div>
      <PageHeader
        eyebrow="Module 11 · Client Onboarding"
        title="Onboarding"
        description="A won deal isn't ready for production until the basics are in place. The onboarding gate blocks shoots and edits until mandatory items are done."
        depth="preview"
      />
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="space-y-2">
          {onboardingClients.map((c) => {
            const done = doneFor(c.id);
            const complete = done.length === onboardingTemplate.length;
            return (
              <button
                key={c.id}
                onClick={() => setSel(c.id)}
                className={cn(
                  "w-full cursor-pointer rounded-2xl border bg-card p-4 text-left shadow-card transition hover:border-accent/40",
                  sel === c.id ? "border-accent ring-2 ring-accent/15" : "border-border",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13.5px] font-semibold">{c.name}</span>
                  <Badge tone={complete ? "success" : exceptions[c.id] ? "warning" : "accent"}>{complete ? "Completed" : exceptions[c.id] ? "Exception" : "In progress"}</Badge>
                </div>
                <div className="mt-1 text-[12px] text-muted-foreground">
                  {c.packageName} · won {format(parseISO(c.wonOn), "d MMM")}
                </div>
                <Progress className="mt-3" value={(done.length / onboardingTemplate.length) * 100} tone={complete ? "success" : "accent"} />
                <div className="mt-1 text-[11.5px] text-muted-foreground tabular">
                  {done.length}/{onboardingTemplate.length} items
                </div>
              </button>
            );
          })}
        </div>
        <Detail key={sel} id={sel} />
      </div>
    </div>
  );
}

function Detail({ id }: { id: string }) {
  const c = onboardingClients.find((x) => x.id === id)!;
  const { onboarding, toggleOnboarding, exceptions, requestException } = useCrmDemo();
  const log = useDemo((s) => s.log);
  const [exOpen, setExOpen] = useState(false);
  const [reason, setReason] = useState("");
  const done = onboarding[id] ?? c.initialDone;
  const mandatory = onboardingTemplate.filter((i) => i.mandatory);
  const missing = mandatory.filter((i) => !done.includes(i.id));
  const gateOpen = missing.length === 0;
  const exception = exceptions[id];

  return (
    <div className="space-y-4">
      <Card
        className={cn(
          "overflow-hidden",
          gateOpen ? "border-success/40" : exception ? "border-warning/40" : "border-danger/30",
        )}
      >
        <div className={cn("flex flex-col gap-4 p-5 sm:flex-row sm:items-center", gateOpen ? "bg-success-soft/50" : exception ? "bg-warning-soft/50" : "bg-danger-soft/40")}>
          <span
            className={cn(
              "inline-flex size-11 shrink-0 items-center justify-center rounded-xl",
              gateOpen ? "bg-success text-white" : exception ? "bg-warning text-white" : "bg-danger text-white",
            )}
          >
            {gateOpen ? <LockOpen className="size-5" /> : exception ? <ShieldQuestion className="size-5" /> : <Lock className="size-5" />}
          </span>
          <div className="flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Onboarding gate</div>
            <div className="text-[16px] font-semibold">
              {gateOpen ? "Clear — production can start" : exception ? "Exception requested — awaiting Janarthanan" : `Production blocked · ${missing.length} mandatory item${missing.length > 1 ? "s" : ""} pending`}
            </div>
            <div className="text-[12.5px] text-muted-foreground">
              {gateOpen
                ? `First cycle starts ${format(parseISO(c.targetStart), "d MMM yyyy")}. Shoots and edits are unlocked.`
                : exception
                  ? `Reason: ${exception}`
                  : `Missing: ${missing.map((m) => m.label.toLowerCase()).join(", ")}`}
            </div>
          </div>
          {!gateOpen && !exception && (
            <Button variant="outline" size="sm" onClick={() => setExOpen(true)}>
              <ShieldAlert /> Request exception
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{c.name}</CardTitle>
            <CardDescription>
              {c.contact} · {c.city} · {c.service} · {inr(c.monthlyFee)}/mo · owner {c.ownerName}
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="soft"
            onClick={() => {
              toast.success("Reminder sent to client", { description: `WhatsApp checklist link sent to ${c.contact}` });
            }}
          >
            <Send /> Nudge client
          </Button>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {onboardingTemplate.map((item) => {
            const checked = done.includes(item.id);
            return (
              <label key={item.id} className="flex cursor-pointer items-center gap-3 py-3 first:pt-0">
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => {
                    toggleOnboarding(id, item.id, c.initialDone);
                    if (!checked) {
                      log(`${c.name}: ${item.label} ✓`, "success");
                      const remaining = missing.filter((m) => m.id !== item.id).length;
                      if (item.mandatory && remaining === 0) toast.success("Onboarding gate cleared", { description: "Production is unlocked for " + c.name });
                    }
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className={cn("flex items-center gap-2 text-[13px] font-medium", checked && "text-muted-foreground line-through")}>
                    {item.label}
                    {item.mandatory && !checked && <Badge tone="danger">Required</Badge>}
                    {!item.mandatory && <Badge tone="neutral">Optional</Badge>}
                  </div>
                  <div className="text-[12px] text-muted-foreground">{item.detail}</div>
                </div>
                <div className="hidden items-center gap-1.5 text-[12px] text-muted-foreground sm:flex">
                  <Avatar name={item.owner} size="xs" /> {item.owner.split(" ")[0]}
                </div>
              </label>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={exOpen} onOpenChange={setExOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request gate exception</DialogTitle>
            <DialogDescription>Start production before onboarding is complete. The founder is notified and the exception is logged.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div className="rounded-lg bg-muted/60 p-3 text-[12.5px]">
              <b>Still missing:</b> {missing.map((m) => m.label).join(", ")}
            </div>
            <Field label="Reason">
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Diwali content must be shot by 5 Oct; brand files promised by Monday" />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setExOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="accent"
              disabled={!reason.trim()}
              onClick={() => {
                requestException(id, reason.trim());
                log(`Onboarding exception requested for ${c.name}`, "warning");
                toast("Exception sent to Janarthanan", { description: "You'll be notified when it's approved" });
                setExOpen(false);
              }}
            >
              Send request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

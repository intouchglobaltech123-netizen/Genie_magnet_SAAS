"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, Clapperboard, Lock, ShieldAlert, X, CalendarClock, FileWarning, Inbox } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/feedback";
import { Tooltip } from "@/components/ui/tooltip";
import { personById } from "@/lib/mock/core";
import { leaveBalances, type LeaveRequest } from "@/lib/mock/people";
import { useDemo } from "@/lib/store";
import { cn, fmtDate } from "@/lib/utils";

const MIN_REASON = 20;

const typeLabel: Record<LeaveRequest["type"], string> = { CL: "Casual leave", SL: "Sick leave", EL: "Earned leave", LOP: "Loss of pay" };

function range(r: LeaveRequest) {
  return r.from === r.to ? fmtDate(r.from, { day: "numeric", month: "short", weekday: "short" }) : `${fmtDate(r.from)} – ${fmtDate(r.to)}`;
}

export function LeaveRequests({
  requests,
  onDecide,
}: {
  requests: LeaveRequest[];
  onDecide: (id: string, status: "approved" | "rejected", exceptionReason?: string) => void;
}) {
  const [exceptionFor, setExceptionFor] = useState<LeaveRequest | null>(null);
  const [reason, setReason] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "decided">("all");

  const decide = (r: LeaveRequest, status: "approved" | "rejected", why?: string) => {
    const name = personById(r.personId).name;
    onDecide(r.id, status, why);
    if (status === "approved") {
      toast.success(`${typeLabel[r.type]} approved for ${name}`, {
        description: why ? "Approved with exception — reason logged for audit." : `${range(r)} · ${r.days} day${r.days > 1 ? "s" : ""} deducted from ${r.type}`,
      });
      useDemo.getState().log(`${name} — ${r.type} ${range(r)} approved${why ? " with exception (conflicts acknowledged)" : ""}`, why ? "warning" : "success");
    } else {
      toast(`${typeLabel[r.type]} rejected for ${name}`, { description: "Employee notified on WhatsApp and email." });
      useDemo.getState().log(`${name} — ${r.type} ${range(r)} rejected`, "danger");
    }
  };

  const shown = requests.filter((r) => (filter === "all" ? true : filter === "pending" ? r.status === "pending" : r.status !== "pending"));

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Filter leave requests" className="flex w-fit items-center gap-1 rounded-lg bg-muted p-1 text-body">
        {(["all", "pending", "decided"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={cn(
              "cursor-pointer rounded-md px-3 py-1 font-medium capitalize text-muted-foreground transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35",
              filter === f && "bg-card text-text-primary shadow-sm",
            )}
          >
            {f} {f === "pending" && <span className="tabular ml-1 text-warning">{requests.filter((r) => r.status === "pending").length}</span>}
          </button>
        ))}
      </div>

      {shown.map((r) => {
        const p = personById(r.personId);
        const bal = leaveBalances[r.personId];
        const hasLocked = r.conflicts?.some((c) => c.locked);
        const pending = r.status === "pending";
        return (
          <Card key={r.id} className={cn("overflow-hidden", pending && r.conflicts?.length && "border-warning/50")}>
            <div className="flex flex-col gap-4 p-5 md:flex-row md:items-start">
              <Avatar name={p.name} size="lg" />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-subheading font-semibold">{p.name}</span>
                  <span className="text-body text-muted-foreground">{p.role}</span>
                  <Badge tone={r.status === "approved" ? "success" : r.status === "rejected" ? "danger" : "warning"} dot>
                    {r.status === "approved" ? (r.exceptionReason ? "Approved · exception" : "Approved") : r.status === "rejected" ? "Rejected" : "Pending"}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body">
                  <span className="font-medium">
                    {typeLabel[r.type]} · {range(r)}
                  </span>
                  <span className="tabular text-muted-foreground">
                    {r.days} day{r.days > 1 ? "s" : ""}
                  </span>
                  {bal && r.type !== "LOP" && (
                    <span className="tabular text-muted-foreground">
                      {r.type} balance: {bal[r.type]}
                    </span>
                  )}
                  <span className="text-muted-foreground">Applied {fmtDate(r.appliedOn)}</span>
                </div>
                <p className="text-body text-muted-foreground">“{r.reason}”</p>
                {r.status !== "pending" && (
                  <p className="text-body text-muted-foreground">
                    {r.status === "approved" ? "Approved" : "Rejected"} by {r.approver ?? "Janarthanan"}
                    {r.decidedOn ? ` · ${fmtDate(r.decidedOn, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}` : ""}
                    {r.exceptionReason && <> · Exception: “{r.exceptionReason}”</>}
                  </p>
                )}
              </div>

              {pending && (
                <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
                  <Button variant="outline" size="sm" onClick={() => decide(r, "rejected")}>
                    <X /> Reject
                  </Button>
                  {hasLocked ? (
                    <>
                      <Tooltip content="Blocked — conflicts with a locked shoot. Use “Approve with exception”.">
                        <span tabIndex={0}>
                          <Button size="sm" variant="success" disabled>
                            <Lock /> Approve
                          </Button>
                        </span>
                      </Tooltip>
                      <Button
                        size="sm"
                        variant="accent"
                        onClick={() => {
                          setReason("");
                          setExceptionFor(r);
                        }}
                      >
                        <ShieldAlert /> Approve with exception
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="success" onClick={() => decide(r, "approved")}>
                      <Check /> Approve
                    </Button>
                  )}
                </div>
              )}
            </div>

            {r.conflicts?.length ? (
              <div className={cn("border-t px-5 py-4", pending ? "border-warning/30 bg-warning-soft" : "border-border bg-muted/50")}>
                <div className={cn("mb-2 flex items-center gap-2 text-body font-semibold", pending ? "text-warning" : "text-muted-foreground")}>
                  <AlertTriangle className="size-4" />
                  {r.conflicts.length} scheduling conflict{r.conflicts.length > 1 ? "s" : ""} on {range(r)}
                </div>
                <ul className="space-y-1.5">
                  {r.conflicts.map((c) => (
                    <li key={c.label} className="flex items-center gap-2 text-body text-foreground">
                      {c.kind === "shoot" ? <Clapperboard className="size-3.5 text-muted-foreground" /> : c.kind === "review" ? <CalendarClock className="size-3.5 text-muted-foreground" /> : <FileWarning className="size-3.5 text-muted-foreground" />}
                      {c.label}
                      {c.locked && (
                        <Badge tone="danger">
                          <Lock /> Locked
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
                {pending && (
                  <p className="mt-2 text-body text-muted-foreground">
                    Suggested: move Surya&apos;s edits to Rahul Menon (freelance, 65% utilised) or ask Surya to shift the leave to Thu 1 Oct.
                  </p>
                )}
              </div>
            ) : null}
          </Card>
        );
      })}

      {!shown.length && (
        <EmptyState
          icon={Inbox}
          title={filter === "pending" ? "No pending requests" : "No leave requests"}
          description="Nothing here — all caught up."
          action={
            filter !== "all" ? (
              <Button variant="outline" size="sm" onClick={() => setFilter("all")}>
                Show all requests
              </Button>
            ) : undefined
          }
        />
      )}

      <Dialog open={!!exceptionFor} onOpenChange={(o) => !o && setExceptionFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve with exception</DialogTitle>
            <DialogDescription>
              {exceptionFor && `${personById(exceptionFor.personId).name}'s leave overlaps a locked shoot. Your reason is saved to the audit log and shared with the production lead.`}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <ul className="space-y-1.5 rounded-xl border border-warning/40 bg-warning-soft p-3 text-body">
              {exceptionFor?.conflicts?.map((c) => (
                <li key={c.label} className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
                  {c.label}
                </li>
              ))}
            </ul>
            <Field label="Reason for exception" required hint={`${reason.trim().length}/${MIN_REASON} characters minimum`}>
              <Textarea
                autoFocus
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Family wedding booked months ago; Rahul Menon covers KVR-0926-08 edit, Vignesh runs Nova shoot solo."
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setExceptionFor(null)}>
              Cancel
            </Button>
            <Button
              variant="accent"
              disabled={reason.trim().length < MIN_REASON}
              onClick={() => {
                if (exceptionFor) decide(exceptionFor, "approved", reason.trim());
                setExceptionFor(null);
              }}
            >
              <ShieldAlert /> Approve with exception
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

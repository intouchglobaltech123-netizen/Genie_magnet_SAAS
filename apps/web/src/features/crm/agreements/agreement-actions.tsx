"use client";

import { useState } from "react";
import { addMonths, format, parseISO } from "date-fns";
import { GitPullRequestArrow, Pause, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { TODAY } from "@/lib/mock/core";
import { useDemo } from "@/lib/store";
import { inr } from "@/lib/utils";
import { useCrmDemo } from "@/features/crm/crm-store";
import type { LiveAgreement } from "./shared";

const today = format(parseISO(TODAY), "yyyy-MM-dd");

export function AgreementActions({ a, clientName }: { a: LiveAgreement; clientName: string }) {
  const [dlg, setDlg] = useState<"renew" | "pause" | "cr" | null>(null);
  const patch = useCrmDemo((s) => s.patchAgreement);
  const log = useDemo((s) => s.log);
  const paused = a.status === "paused";

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setDlg("cr")}>
        <GitPullRequestArrow /> Change request
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          if (paused) {
            patch(a.id, { status: "active" }, { at: today, text: "Agreement resumed — cycles re-enabled from next month", by: "Janarthanan", kind: "change" });
            log(`${clientName} agreement resumed`, "success");
            toast.success("Agreement resumed");
          } else setDlg("pause");
        }}
      >
        {paused ? <Play /> : <Pause />} {paused ? "Resume" : "Pause"}
      </Button>
      <Button variant="accent" size="sm" onClick={() => setDlg("renew")}>
        <RefreshCw /> Renew
      </Button>

      <RenewDialog open={dlg === "renew"} onClose={() => setDlg(null)} a={a} clientName={clientName} />
      <PauseDialog open={dlg === "pause"} onClose={() => setDlg(null)} a={a} clientName={clientName} />
      <CrDialog open={dlg === "cr"} onClose={() => setDlg(null)} a={a} clientName={clientName} />
    </>
  );
}

type P = { open: boolean; onClose: () => void; a: LiveAgreement; clientName: string };

function RenewDialog({ open, onClose, a, clientName }: P) {
  const [term, setTerm] = useState("12");
  const [uplift, setUplift] = useState("8");
  const patch = useCrmDemo((s) => s.patchAgreement);
  const log = useDemo((s) => s.log);
  const newFee = Math.round((a.monthlyFee * (1 + Number(uplift) / 100)) / 500) * 500;
  const newEnd = format(addMonths(parseISO(a.endDate), Number(term)), "yyyy-MM-dd");
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renew agreement</DialogTitle>
          <DialogDescription>
            {clientName} · current term ends {format(parseISO(a.endDate), "d MMM yyyy")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Renewal term">
              <Select value={term} onValueChange={setTerm} options={["6", "12", "24"].map((t) => ({ value: t, label: `${t} months` }))} />
            </Field>
            <Field label="Price uplift">
              <Select value={uplift} onValueChange={setUplift} options={["0", "5", "8", "10", "15"].map((t) => ({ value: t, label: `${t}%` }))} />
            </Field>
          </div>
          <div className="rounded-xl border border-border bg-muted/40 p-4 text-body">
            <div className="grid grid-cols-2 gap-y-2">
              <span className="text-muted-foreground">Current fee</span>
              <span className="text-right tabular">{inr(a.monthlyFee)}/mo</span>
              <span className="text-muted-foreground">Renewed fee</span>
              <span className="text-right font-semibold tabular">{inr(newFee)}/mo</span>
              <span className="text-muted-foreground">Additional annual revenue</span>
              <span className="text-right font-medium text-success tabular">+{inr((newFee - a.monthlyFee) * 12)}</span>
              <span className="text-muted-foreground">New end date</span>
              <span className="text-right tabular">{format(parseISO(newEnd), "d MMM yyyy")}</span>
            </div>
            <div className="mt-3 border-t border-border pt-3 text-body text-muted-foreground">
              Scope stays {a.units.map((u) => `${u.perCycle} ${u.label.toLowerCase()}`).join(", ")} · {a.revisionsPerDeliverable} revisions each. Renewal letter goes to the approver for e-sign.
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="accent"
            onClick={() => {
              patch(
                a.id,
                { status: "active", endDate: newEnd, monthlyFee: newFee },
                { at: today, text: `Renewed for ${term} months with ${uplift}% uplift; fee ${inr(a.monthlyFee)} → ${inr(newFee)}`, by: "Janarthanan", kind: "renew" },
              );
              log(`${clientName} renewal sent for e-sign (${uplift}% uplift)`, "success");
              toast.success("Renewal sent for e-sign", { description: `${inr(newFee)}/mo until ${format(parseISO(newEnd), "MMM yyyy")}` });
              onClose();
            }}
          >
            Send renewal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PauseDialog({ open, onClose, a, clientName }: P) {
  const [reason, setReason] = useState("Client request — festive season budget freeze");
  const [months, setMonths] = useState("1");
  const patch = useCrmDemo((s) => s.patchAgreement);
  const log = useDemo((s) => s.log);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pause agreement</DialogTitle>
          <DialogDescription>No new cycles are generated while paused. In-progress deliverables continue.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <Field label="Pause for">
            <Select value={months} onValueChange={setMonths} options={["1", "2", "3"].map((m) => ({ value: m, label: `${m} month${m === "1" ? "" : "s"}` }))} />
          </Field>
          <Field label="Reason">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              patch(a.id, { status: "paused" }, { at: today, text: `Paused for ${months} month(s): ${reason}`, by: "Janarthanan", kind: "change" });
              log(`${clientName} agreement paused`, "warning");
              toast(`${clientName} paused`, { description: "Oct cycle will not be generated" });
              onClose();
            }}
          >
            Pause agreement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CrDialog({ open, onClose, a, clientName }: P) {
  const [type, setType] = useState("units");
  const [detail, setDetail] = useState("");
  const [fee, setFee] = useState("");
  const patch = useCrmDemo((s) => s.patchAgreement);
  const log = useDemo((s) => s.log);
  const labels: Record<string, string> = {
    units: "Change units per cycle",
    service: "Add a service",
    terms: "Change billing / payment terms",
    revisions: "Change revision allowance",
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agreement change request</DialogTitle>
          <DialogDescription>Changes are versioned — the original commitment stays on record.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <Field label="Type of change">
            <Select value={type} onValueChange={setType} options={Object.entries(labels).map(([value, label]) => ({ value, label }))} />
          </Field>
          <Field label="What changes" required>
            <Textarea value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="e.g. Reels 8 → 10 per cycle from Nov 2026" />
          </Field>
          <Field label="New monthly fee (optional)" hint={`Current: ${inr(a.monthlyFee)}`}>
            <Input type="number" value={fee} onChange={(e) => setFee(e.target.value)} placeholder={String(a.monthlyFee)} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="accent"
            disabled={!detail.trim()}
            onClick={() => {
              patch(a.id, {}, { at: today, text: `Change requested — ${labels[type]}: ${detail}${fee ? ` · proposed fee ${inr(Number(fee))}` : ""} (awaiting client sign-off)`, by: "Ashwin", kind: "note" });
              log(`Agreement change raised for ${clientName}`, "accent");
              toast.success("Change request raised", { description: "Sent to client approver for sign-off" });
              setDetail("");
              setFee("");
              onClose();
            }}
          >
            Raise request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

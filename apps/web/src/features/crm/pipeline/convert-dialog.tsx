"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Building2, CalendarRange, ClipboardCheck, FileSignature, PartyPopper, Receipt, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { personById } from "@/lib/mock/core";
import { packageForService } from "@/lib/mock/crm";
import { useDemo } from "@/lib/store";
import type { Lead } from "@/lib/types";
import { inr } from "@/lib/utils";
import { useCrmDemo } from "@/features/crm/crm-store";

export function ConvertDialog({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  const log = useDemo((s) => s.log);
  const markConverted = useCrmDemo((s) => s.markConverted);
  const discounts = useCrmDemo((s) => s.discounts);
  const router = useRouter();
  if (!lead) return <Dialog open={false} />;
  const pkg = packageForService[lead.service];
  const units = pkg.units.reduce((s, u) => s + u.perCycle, 0);
  const owner = personById(lead.ownerId);
  const disc = discounts[lead.id];
  const discPct = disc && (disc.status === "approved" || disc.status === "auto-approved") ? disc.pct : 0;
  const fee = Math.round(lead.value * (1 - discPct / 100));
  const gst = Math.round(fee * 0.18);

  const rows = [
    { icon: Building2, title: "Client record", detail: `${lead.company} · contact ${lead.name} · ${lead.phone}` },
    { icon: FileSignature, title: `Agreement from “${pkg.name}”`, detail: `${inr(fee)}/month${discPct ? ` (after ${discPct}% approved discount)` : ""} · 12 months · 2 revisions per deliverable · 4-day turnaround` },
    { icon: ClipboardCheck, title: "Onboarding checklist", detail: "10 items · 7 mandatory · production blocked until the gate clears" },
    { icon: CalendarRange, title: "First monthly cycle · Oct 2026", detail: `${units} deliverables — ${pkg.units.map((u) => `${u.perCycle} ${u.label.toLowerCase()}`).join(", ")}` },
    { icon: Receipt, title: "Billing schedule", detail: `Monthly advance on the 1st · ${inr(fee)} + GST ${inr(gst)} · first invoice 1 Oct` },
    { icon: Users, title: "Owners", detail: `Account: ${owner.name} · Delivery: Ashwin · Creative: Karthik Subramanian` },
  ];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl overflow-hidden">
        <div className="relative bg-grid">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-success/10 to-transparent" />
          <DialogHeader className="relative">
            <motion.div
              initial={{ scale: 0.4, rotate: -20, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 14 }}
              className="mb-2 inline-flex size-11 items-center justify-center rounded-xl bg-success-soft text-success"
            >
              <PartyPopper className="size-5" />
            </motion.div>
            <DialogTitle>Deal won — {lead.company}</DialogTitle>
            <p className="text-[13px] text-muted-foreground">Convert to agreement. Here&apos;s what Agency OS will set up automatically:</p>
          </DialogHeader>
        </div>
        <DialogBody className="space-y-2 pt-2">
          {rows.map((r, i) => (
            <motion.div
              key={r.title}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 * i + 0.1 }}
              className="flex items-start gap-3 rounded-xl border border-border p-3"
            >
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <r.icon className="size-4" />
              </span>
              <div className="min-w-0">
                <div className="text-[13px] font-medium">{r.title}</div>
                <div className="text-[12px] text-muted-foreground">{r.detail}</div>
              </div>
            </motion.div>
          ))}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Later
          </Button>
          <Button
            variant="success"
            onClick={() => {
              markConverted(lead.id);
              log(`${lead.company} converted — agreement, onboarding & Oct cycle created`, "success");
              toast.success("Agreement created", {
                description: `${pkg.name} for ${lead.company} · onboarding checklist sent to ${owner.name}`,
                action: { label: "Onboarding", onClick: () => router.push("/onboarding") },
              });
              onClose();
            }}
          >
            Confirm & create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ConvertedNote() {
  return (
    <Link href="/onboarding" className="text-[11.5px] text-success underline-offset-2 hover:underline">
      Agreement created → onboarding
    </Link>
  );
}

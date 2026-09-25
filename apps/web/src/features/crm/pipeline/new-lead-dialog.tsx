"use client";

import { useState } from "react";
import { AlertTriangle, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { people } from "@/lib/mock/core";
import { useDemo } from "@/lib/store";
import type { Lead } from "@/lib/types";

const SOURCES: Lead["source"][] = ["Website", "Meta Ads", "Google Ads", "WhatsApp", "Referral", "BNI", "Instagram", "Event", "Walk-in"];
const SERVICES: Lead["service"][] = ["Video Production", "Social Media Management", "Personal Branding", "Website", "Consulting"];
const OWNERS = people.filter((p) => ["p-jana", "p-ashwin", "p-priya"].includes(p.id));

const empty = { name: "", company: "", phone: "", email: "", source: "Instagram" as Lead["source"], service: "Video Production" as Lead["service"], value: "", ownerId: "p-priya" };

const digits = (s: string) => s.replace(/\D/g, "").slice(-10);

export function NewLeadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const leads = useDemo((s) => s.leads);
  const addLead = useDemo((s) => s.addLead);
  const log = useDemo((s) => s.log);
  const [f, setF] = useState(empty);
  const set = <K extends keyof typeof empty>(k: K, v: (typeof empty)[K]) => setF((p) => ({ ...p, [k]: v }));

  const dupes = leads.filter((l) => {
    const phone = digits(f.phone);
    return (
      (phone.length >= 10 && digits(l.phone) === phone) ||
      (f.email.trim().length > 4 && l.email.toLowerCase() === f.email.trim().toLowerCase()) ||
      (f.company.trim().length > 3 && l.company.toLowerCase().includes(f.company.trim().toLowerCase()))
    );
  });

  const valid = f.name.trim() && f.company.trim() && (f.phone.trim() || f.email.trim());

  const submit = () => {
    if (!valid) return;
    addLead({
      name: f.name.trim(),
      company: f.company.trim(),
      phone: f.phone.trim(),
      email: f.email.trim(),
      source: f.source,
      service: f.service,
      stage: "New",
      value: Number(f.value) || 40000,
      ownerId: f.ownerId,
      nextFollowUp: "2026-09-26",
      score: 50,
      notes: dupes.length ? `Possible duplicate of ${dupes[0]!.company}` : undefined,
    });
    log(`New lead: ${f.company.trim()} (${f.source})`, "accent");
    toast.success("Lead created", { description: `${f.company} assigned to ${OWNERS.find((o) => o.id === f.ownerId)?.name} · follow-up tomorrow` });
    setF(empty);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-5 text-primary" /> New lead
          </DialogTitle>
          <DialogDescription>Captured leads get an owner and a follow-up date automatically.</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact name">
            <Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Kavitha Rajan" />
          </Field>
          <Field label="Company">
            <Input value={f.company} onChange={(e) => set("company", e.target.value)} placeholder="e.g. Kavitha Bakes" />
          </Field>
          <Field label="Phone">
            <Input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98xxx xxxxx" />
          </Field>
          <Field label="Email">
            <Input value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="name@company.in" />
          </Field>
          <Field label="Source">
            <Select value={f.source} onValueChange={(v) => set("source", v as Lead["source"])} options={SOURCES.map((s) => ({ value: s, label: s }))} />
          </Field>
          <Field label="Service interest">
            <Select value={f.service} onValueChange={(v) => set("service", v as Lead["service"])} options={SERVICES.map((s) => ({ value: s, label: s }))} />
          </Field>
          <Field label="Est. monthly value (₹)">
            <Input type="number" inputMode="numeric" value={f.value} onChange={(e) => set("value", e.target.value)} placeholder="40000" />
          </Field>
          <Field label="Owner">
            <Select value={f.ownerId} onValueChange={(v) => set("ownerId", v)} options={OWNERS.map((o) => ({ value: o.id, label: `${o.name} · ${o.role}` }))} />
          </Field>
          {dupes.length > 0 && (
            <div className="flex gap-2.5 rounded-xl border border-warning/40 bg-warning-soft p-3 text-body sm:col-span-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
              <div>
                <div className="font-medium text-foreground">Possible duplicate</div>
                {dupes.slice(0, 2).map((d) => (
                  <div key={d.id} className="text-muted-foreground">
                    {d.company} · {d.name} · {d.phone} — currently in <b className="text-foreground">{d.stage}</b>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="accent" disabled={!valid} onClick={submit}>
            {dupes.length ? "Create anyway" : "Create lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

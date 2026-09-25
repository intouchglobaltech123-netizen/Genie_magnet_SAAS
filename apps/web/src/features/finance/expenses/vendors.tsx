"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Building2, CheckCircle2, Plus, Search, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/lib/mock/finance";
import { useDemo } from "@/lib/store";
import { cn, fmtDate, inr, inrCompact } from "@/lib/utils";
import { CATEGORY_STYLE, useExpenses } from "./store";

const GSTIN_RE = /^(\d{2})[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const STATE_CODES: Record<string, string> = { "33": "Tamil Nadu", "29": "Karnataka", "32": "Kerala", "27": "Maharashtra", "36": "Telangana", "37": "Andhra Pradesh", "07": "Delhi" };

export function VendorsTab() {
  const vendors = useExpenses((s) => s.vendors);
  const expenses = useExpenses((s) => s.expenses);
  const payVendor = useExpenses((s) => s.payVendor);
  const log = useDemo((s) => s.log);
  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const payable = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of expenses)
      if (e.approval === "approved" && e.paymentStatus === "unpaid" && e.paidBy === "company") m.set(e.vendor, (m.get(e.vendor) ?? 0) + e.amount);
    return m;
  }, [expenses]);

  const rows = vendors
    .filter((v) => !q || `${v.name} ${v.category} ${v.city} ${v.gstin}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (payable.get(b.name) ?? 0) - (payable.get(a.name) ?? 0) || b.ytdSpend - a.ytdSpend);
  const maxSpend = Math.max(...vendors.map((v) => v.ytdSpend), 1);
  const totalYtd = vendors.reduce((s, v) => s + v.ytdSpend, 0);

  return (
    <Card>
      <CardHeader className="flex-col gap-3 md:flex-row md:items-center">
        <div>
          <CardTitle>Vendors & freelancers</CardTitle>
          <CardDescription>
            {vendors.length} active · FY spend {inrCompact(totalYtd)} · GSTINs verified for input credit
          </CardDescription>
        </div>
        <div className="flex w-full gap-2 md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search vendor, GSTIN…" className="pl-9" />
          </div>
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
            <Plus /> Add vendor
          </Button>
        </div>
      </CardHeader>
      <Table>
        <THead>
          <TR>
            <TH className="pl-5">Vendor</TH>
            <TH>Category</TH>
            <TH>GSTIN</TH>
            <TH>Terms</TH>
            <TH className="text-right">FY spend</TH>
            <TH>Last payment</TH>
            <TH>Rating</TH>
            <TH className="pr-5 text-right">Payable</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((v) => {
            const due = payable.get(v.name) ?? 0;
            const style = CATEGORY_STYLE[v.category] ?? CATEGORY_STYLE.Utilities!;
            const validGstin = GSTIN_RE.test(v.gstin);
            return (
              <TR key={v.id}>
                <TD className="pl-5">
                  <div className="flex items-center gap-2.5">
                    <span className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-body font-semibold", style.soft, style.text)}>
                      {v.name.charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-medium">{v.name}</div>
                      <div className="truncate text-body text-muted-foreground">
                        {v.city} · {v.contact}
                      </div>
                    </div>
                  </div>
                </TD>
                <TD>
                  <Badge tone="neutral">{v.category}</Badge>
                </TD>
                <TD>
                  <div className={cn("text-body", validGstin ? "font-mono" : "text-muted-foreground")}>{v.gstin}</div>
                  {validGstin && <div className="text-body text-muted-foreground">{STATE_CODES[v.gstin.slice(0, 2)] ?? "Other state"}</div>}
                </TD>
                <TD className="text-body text-muted-foreground">{v.terms}</TD>
                <TD className="text-right">
                  <div className="font-medium tabular">{inr(v.ytdSpend)}</div>
                  <div className="ml-auto mt-1 h-1 w-20 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full", style.strip)} style={{ width: `${(v.ytdSpend / maxSpend) * 100}%` }} />
                  </div>
                </TD>
                <TD className="text-body">
                  {v.lastPayment.date ? (
                    <>
                      <div className="tabular">{inr(v.lastPayment.amount)}</div>
                      <div className="text-body text-muted-foreground">{fmtDate(v.lastPayment.date)}</div>
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TD>
                <TD>
                  {v.rating ? (
                    <span className="inline-flex items-center gap-1 text-body tabular">
                      <Star className="size-3.5 fill-accent text-accent-strong" /> {v.rating.toFixed(1)}
                    </span>
                  ) : (
                    <Badge tone="outline">New</Badge>
                  )}
                </TD>
                <TD className="pr-5 text-right">
                  {due > 0 ? (
                    <Button
                      size="xs"
                      variant="accent"
                      onClick={() => {
                        const paid = payVendor(v.name);
                        toast.success(`${inr(paid)} paid to ${v.name}`, { description: `NEFT from HDFC current a/c · remittance advice emailed${v.category === "Freelancer" ? " · TDS 1% u/s 194C deducted" : ""}` });
                        log(`Vendor payment ${inr(paid)} released to ${v.name}`, "accent");
                      }}
                    >
                      Pay {inr(due)}
                    </Button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-body text-muted-foreground">
                      <CheckCircle2 className="size-3.5 text-success" /> Nil
                    </span>
                  )}
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
      <AddVendorDialog open={addOpen} onOpenChange={setAddOpen} />
    </Card>
  );
}

function AddVendorDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const addVendor = useExpenses((s) => s.addVendor);
  const [name, setName] = useState("Erode Sound Hire");
  const [category, setCategory] = useState<ExpenseCategory>("Equipment rental");
  const [city, setCity] = useState("Erode");
  const [gstin, setGstin] = useState("33AAHFE4410C1ZR");
  const [terms, setTerms] = useState("Net 15");
  const g = gstin.trim().toUpperCase();
  const valid = GSTIN_RE.test(g);
  const submit = () => {
    if (!name.trim()) return;
    addVendor({ name: name.trim(), category, city, gstin: g || "Unregistered", registered: valid, terms, contact: "Contact to be added" });
    toast.success(`${name.trim()} added to vendors`, { description: valid ? `GSTIN verified · ${STATE_CODES[g.slice(0, 2)] ?? "Other state"}` : "Unregistered vendor — no GST input credit" });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add vendor</DialogTitle>
          <DialogDescription>Vendors with a valid GSTIN let us claim input tax credit.</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid grid-cols-2 gap-3">
          <Field label="Vendor name" className="col-span-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Category">
            <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)} options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))} />
          </Field>
          <Field label="City">
            <Input value={city} onChange={(e) => setCity(e.target.value)} />
          </Field>
          <Field label="GSTIN" hint={g ? (valid ? `✓ Valid format · ${STATE_CODES[g.slice(0, 2)] ?? "Other state"}` : "Format: 33ABCDE1234F1Z5") : "Leave blank if unregistered"}>
            <Input value={gstin} onChange={(e) => setGstin(e.target.value)} className={cn("font-mono uppercase", g && !valid && "border-danger")} />
          </Field>
          <Field label="Payment terms">
            <Select value={terms} onValueChange={setTerms} options={["Advance", "Net 7", "Net 15", "Net 30"].map((t) => ({ value: t, label: t }))} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="accent" size="sm" onClick={submit} disabled={!name.trim()}>
            <Building2 /> Add vendor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

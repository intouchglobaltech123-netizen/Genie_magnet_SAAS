"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Paperclip, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { clients, employees, personById } from "@/lib/mock/core";
import { EXPENSE_CATEGORIES, overheadPools, type Expense, type ExpenseCategory } from "@/lib/mock/finance";
import { useDemo } from "@/lib/store";
import { inr } from "@/lib/utils";
import { ReceiptTile } from "./receipt";
import { useExpenses } from "./store";

export function NewExpenseButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="accent" size="sm" onClick={() => setOpen(true)}>
        <Plus /> New expense
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">{open && <NewExpenseForm onDone={() => setOpen(false)} />}</DialogContent>
      </Dialog>
    </>
  );
}

function NewExpenseForm({ onDone }: { onDone: () => void }) {
  const addExpense = useExpenses((s) => s.addExpense);
  const videos = useDemo((s) => s.videos);
  const log = useDemo((s) => s.log);
  const [requesterId, setRequesterId] = useState("p-vignesh");
  const [category, setCategory] = useState<ExpenseCategory>("Travel");
  const [vendor, setVendor] = useState("Ola Outstation");
  const [description, setDescription] = useState("Cab — Appakudal ⇄ Erode mill (testimonial shoot)");
  const [amount, setAmount] = useState("3450");
  const [gstBill, setGstBill] = useState(false);
  const [alloc, setAlloc] = useState("c-kaveri");
  const [videoCode, setVideoCode] = useState("KVR-0926-08");
  const [pool, setPool] = useState(overheadPools[0]!.name);
  const [paidBy, setPaidBy] = useState<Expense["paidBy"]>("employee");
  const [receipt, setReceipt] = useState(false);

  const amt = Number(amount) || 0;
  const gst = gstBill ? Math.round((amt * 18) / 118) : 0;
  const clientVideos = videos.filter((v) => v.clientId === alloc);
  const approverId = amt > 10000 ? "p-jana" : "p-ashwin";

  const submit = () => {
    if (amt <= 0 || !vendor.trim()) return;
    const code = addExpense({
      vendor: vendor.trim(),
      description: description.trim() || vendor.trim(),
      category,
      requesterId,
      approverId,
      clientId: alloc === "overhead" ? undefined : alloc,
      videoCode: alloc === "overhead" ? undefined : videoCode,
      overheadPool: alloc === "overhead" ? pool : undefined,
      amount: amt,
      gst,
      itc: gstBill && !["Food & refreshments", "Travel"].includes(category),
      paidBy,
      mode: paidBy === "employee" ? "UPI" : "NEFT",
      receipt,
    });
    toast.success(`${code} submitted for approval`, { description: `${inr(amt)} · routed to ${personById(approverId).name}${receipt ? "" : " · receipt pending"}` });
    log(`${personById(requesterId).name} submitted expense ${code} — ${vendor.trim()} (${inr(amt)})`, "accent");
    onDone();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>New expense request</DialogTitle>
        <DialogDescription>Goes to {personById(approverId).name} for approval{amt > 10000 ? " (above ₹10,000)" : ""}</DialogDescription>
      </DialogHeader>
      <DialogBody className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Requested by">
            <Select value={requesterId} onValueChange={setRequesterId} options={employees.map((p) => ({ value: p.id, label: p.name }))} />
          </Field>
          <Field label="Category">
            <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)} options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))} />
          </Field>
          <Field label="Vendor / payee">
            <Input value={vendor} onChange={(e) => setVendor(e.target.value)} />
          </Field>
          <Field label="Amount incl. GST (₹)">
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="tabular" />
          </Field>
          <Field label="Description" className="col-span-2">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="Allocate to">
            <Select
              value={alloc}
              onValueChange={(v) => {
                setAlloc(v);
                const first = videos.find((x) => x.clientId === v);
                if (first) setVideoCode(first.code);
              }}
              options={[...clients.map((c) => ({ value: c.id, label: c.name })), { value: "overhead", label: "Overhead (no project)" }]}
            />
          </Field>
          {alloc === "overhead" ? (
            <Field label="Overhead pool">
              <Select value={pool} onValueChange={setPool} options={[...overheadPools.map((p) => ({ value: p.name, label: p.name })), { value: "Sales & marketing", label: "Sales & marketing" }]} />
            </Field>
          ) : (
            <Field label="Video">
              <Select value={videoCode} onValueChange={setVideoCode} options={clientVideos.map((v) => ({ value: v.code, label: `${v.code} · ${v.title}` }))} />
            </Field>
          )}
          <Field label="Paid by">
            <Select
              value={paidBy}
              onValueChange={(v) => setPaidBy(v as Expense["paidBy"])}
              options={[
                { value: "employee", label: "Employee (reimburse)" },
                { value: "company", label: "Company (pay vendor)" },
              ]}
            />
          </Field>
          <div className="flex items-end">
            <label className="flex h-9 cursor-pointer items-center gap-2 text-[13px]">
              <Checkbox checked={gstBill} onCheckedChange={(v) => setGstBill(v === true)} />
              GST tax invoice {gstBill && <span className="text-muted-foreground tabular">· GST {inr(gst)}</span>}
            </label>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-border p-3">
          <ReceiptTile expense={{ vendor: vendor || "?", amount: amt, category, receipt }} />
          <div className="min-w-0 flex-1 text-[13px]">
            {receipt ? (
              <span className="inline-flex items-center gap-1.5 text-success">
                <CheckCircle2 className="size-4" /> bill_{vendor.split(" ")[0]?.toLowerCase() || "receipt"}_25sep.jpg attached
              </span>
            ) : (
              <span className="text-muted-foreground">Attach a photo of the bill — required for approval</span>
            )}
          </div>
          <Button variant="outline" size="xs" onClick={() => setReceipt((r) => !r)}>
            <Paperclip /> {receipt ? "Remove" : "Attach receipt"}
          </Button>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button variant="accent" size="sm" onClick={submit} disabled={amt <= 0 || !vendor.trim()}>
          Submit {inr(amt)}
        </Button>
      </DialogFooter>
    </>
  );
}

"use client";

import { useState } from "react";
import { Building2, Plus } from "lucide-react";
import { toast } from "sonner";
import { clientInput, scopeOf } from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ApiError, errorMessage } from "./api";
import { useCan, useClients, useCreateClient, useMe } from "./queries";

const FITMENT: Record<string, string> = { amazing: "Amazing", bread_winning: "Bread-winning", convenience: "Convenience", dangerous: "Dangerous" };
const FITMENT_TONE = { amazing: "success", bread_winning: "info", convenience: "neutral", dangerous: "danger" } as const;

const empty = { name: "", code: "", industry: "", city: "", contactName: "", contactPhone: "", contactEmail: "", approver: true };

function AddClientDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const create = useCreateClient();
  const [f, setF] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = {
      name: f.name,
      code: f.code.toUpperCase(),
      industry: f.industry || undefined,
      city: f.city || undefined,
      contacts: [{ name: f.contactName, phone: f.contactPhone, email: f.contactEmail || undefined, approver: f.approver }],
    };
    // The same rules the API applies, so mistakes show before sending.
    const parsed = clientInput.safeParse(input);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])));
      return;
    }
    setErrors({});
    create.mutate(parsed.data, {
      onSuccess: (c) => {
        toast.success(`${c.name} added`);
        setF(empty);
        onOpenChange(false);
      },
      onError: (err) => {
        if (err instanceof ApiError && err.body.issues) setErrors(Object.fromEntries(err.body.issues.map((i) => [i.path, i.message])));
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Add a client</DialogTitle>
            <DialogDescription>The contact is the person who approves the work. You can add more contacts later.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
              <Field label="Client name" required error={errors.name}>
                <Input value={f.name} onChange={set("name")} />
              </Field>
              <Field label="Code" hint="2–4 letters, used in video codes" required error={errors.code}>
                <Input value={f.code} maxLength={4} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} placeholder="KVR" />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Industry" error={errors.industry}>
                <Input value={f.industry} onChange={set("industry")} />
              </Field>
              <Field label="City" error={errors.city}>
                <Input value={f.city} onChange={set("city")} />
              </Field>
            </div>
            <div className="rounded-lg border border-border-subtle p-4">
              <div className="mb-3 text-body font-medium">Contact person</div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" required error={errors["contacts.0.name"] ?? errors.contacts}>
                  <Input value={f.contactName} onChange={set("contactName")} />
                </Field>
                <Field label="Phone" required error={errors["contacts.0.phone"]}>
                  <Input value={f.contactPhone} onChange={set("contactPhone")} placeholder="+91 98400 11001" />
                </Field>
                <Field label="Email" error={errors["contacts.0.email"]}>
                  <Input type="email" value={f.contactEmail} onChange={set("contactEmail")} />
                </Field>
                <label className="flex items-center gap-2 self-end pb-2 text-body">
                  <Checkbox checked={f.approver} onCheckedChange={(v) => setF({ ...f, approver: v === true })} />
                  Approves the work
                </label>
              </div>
            </div>
            {create.error && !(create.error instanceof ApiError && create.error.body.issues) && <Alert tone="danger">{errorMessage(create.error)}</Alert>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Adding…" : "Add client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function LiveClients() {
  const me = useMe().data!;
  const can = useCan();
  const clients = useClients();
  const [adding, setAdding] = useState(false);
  const ownOnly = !!me.permissions && scopeOf(me.permissions, "clients") === "own";
  const canAdd = can("clients", "edit");

  return (
    <>
      <PageHeader
        title="Clients"
        description="Everyone your agency works for, with the people who approve their work."
        actions={
          canAdd && (
            <Button onClick={() => setAdding(true)}>
              <Plus />
              Add client
            </Button>
          )
        }
      />
      {ownOnly && (
        <Alert tone="info" className="mb-4">
          Your role shows only the clients you look after.
        </Alert>
      )}
      <Card className="overflow-hidden">
        {clients.isPending ? (
          <div className="p-4">
            <SkeletonRows rows={5} />
          </div>
        ) : clients.error ? (
          <div className="p-4">
            <Alert tone="danger">{errorMessage(clients.error)}</Alert>
          </div>
        ) : !clients.data.length ? (
          <EmptyState
            icon={Building2}
            title="No clients yet"
            description={canAdd ? "Add your first client. Importing from Excel is coming next." : "Clients you look after will appear here."}
            action={
              canAdd && (
                <Button onClick={() => setAdding(true)}>
                  <Plus />
                  Add client
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Code</TH>
                  <TH>Client</TH>
                  <TH>City</TH>
                  <TH>Approver</TH>
                  <TH>Fitment</TH>
                  <TH numeric>Health</TH>
                </TR>
              </THead>
              <TBody>
                {clients.data.map((c) => {
                  const approver = c.contacts.find((p) => p.approver) ?? c.contacts[0];
                  return (
                    <TR key={c.id}>
                      <TD>
                        <Badge tone="outline" className="font-mono">
                          {c.code}
                        </Badge>
                      </TD>
                      <TD>
                        <div className="font-medium">{c.name}</div>
                        {c.industry && <div className="text-muted-foreground">{c.industry}</div>}
                      </TD>
                      <TD>{c.city ?? "—"}</TD>
                      <TD>
                        {approver ? (
                          <>
                            <div>{approver.name}</div>
                            <div className="whitespace-nowrap text-muted-foreground">{approver.phone}</div>
                          </>
                        ) : (
                          "—"
                        )}
                      </TD>
                      <TD>{c.fitment ? <Badge tone={FITMENT_TONE[c.fitment]}>{FITMENT[c.fitment]}</Badge> : "—"}</TD>
                      <TD numeric>{c.health ?? "—"}</TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </div>
        )}
      </Card>
      <AddClientDialog open={adding} onOpenChange={setAdding} />
    </>
  );
}

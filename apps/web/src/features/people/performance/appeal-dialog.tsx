"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { personById } from "@/lib/mock/core";
import { compositeFor, scorecards } from "./data";

export interface Appeal {
  kra: string;
  reason: string;
  status: "under-review" | "resolved";
}

export function AppealDialog({
  personId,
  onOpenChange,
  onSubmit,
}: {
  personId: string | null;
  onOpenChange: (o: boolean) => void;
  onSubmit: (personId: string, a: Appeal) => void;
}) {
  return (
    <Dialog open={!!personId} onOpenChange={onOpenChange}>
      <DialogContent>{personId && <Body key={personId} personId={personId} onSubmit={onSubmit} close={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  );
}

function Body({ personId, onSubmit, close }: { personId: string; onSubmit: (id: string, a: Appeal) => void; close: () => void }) {
  const person = personById(personId);
  const kras = scorecards.flatMap((s) => s.people.filter((p) => p.personId === personId).flatMap((p) => p.kras.map((k) => k.kra)));
  const options = (kras.length ? kras : ["Overall composite"]).map((k) => ({ value: k, label: k }));
  const [kra, setKra] = useState(personId === "p-surya" ? "QC first-pass rate" : options[0].value);
  const [reason, setReason] = useState(
    personId === "p-surya"
      ? "Two QC fails on KVR-0926-03 were due to the client's late logo change, not an editing error. Requesting those be counted as client-driven revisions."
      : "",
  );
  const score = compositeFor(personId);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Appeal score — {person.name}</DialogTitle>
        <DialogDescription>
          Current composite <b className="tabular">{score?.toFixed(1)}</b>. Appeals go to Ashwin (manager) and are decided within 5 working days.
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="space-y-4">
        <Field label="Which measure are you appealing?" required>
          <Select value={kra} onValueChange={setKra} options={options} />
        </Field>
        <Field label="Reason & evidence" required hint="Link video codes, QC notes or client emails where possible.">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain what the score doesn't reflect…" className="min-h-28" />
        </Field>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={close}>
          Cancel
        </Button>
        <Button
          variant="accent"
          onClick={() => {
            if (reason.trim().length < 10) {
              toast.error("Please add a short reason (10+ characters)");
              return;
            }
            onSubmit(personId, { kra, reason: reason.trim(), status: "under-review" });
            close();
          }}
        >
          Submit appeal
        </Button>
      </DialogFooter>
    </>
  );
}

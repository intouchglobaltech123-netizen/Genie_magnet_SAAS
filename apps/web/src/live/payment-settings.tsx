"use client";

import { useState } from "react";
import { Copy, PlugZap, RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";
import { paymentConnectionInput, type PaymentSettings } from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/card";
import { Alert, SkeletonRows } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/input";
import { ApiError, errorMessage } from "./api";
import { useCan, usePayments, usePaymentsAction } from "./queries";

const copy = (text: string) =>
  navigator.clipboard.writeText(text).then(
    () => toast.success("Copied"),
    () => toast.error("Copy it from the box"),
  );

function Keys({ s, canEdit }: { s: PaymentSettings; canEdit: boolean }) {
  const act = usePaymentsAction();
  const c = s.connection;
  const [f, setF] = useState({ keyId: c?.keyId ?? "", keySecret: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = () => {
    const parsed = paymentConnectionInput.safeParse(f);
    if (!parsed.success) return setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
    setErrors({});
    act.mutate(
      { step: "connect", body: parsed.data },
      {
        onSuccess: (r) => {
          setF({ ...f, keySecret: "" });
          if (r.connection?.status === "connected") toast.success("Razorpay is connected");
          else toast.error(r.connection?.lastError ?? "Razorpay did not accept these keys");
        },
        onError: (e) =>
          e instanceof ApiError && e.body.issues ? setErrors(Object.fromEntries(e.body.issues.map((i) => [i.path, i.message]))) : toast.error(errorMessage(e)),
      },
    );
  };
  return (
    <SectionCard
      title="Your Razorpay account"
      description={
        c ? undefined : "In the Razorpay Dashboard → Account & Settings → API keys, generate a key and paste both parts here. Use test keys first to try it."
      }
      actions={
        c && (
          <span className="flex items-center gap-2">
            <Badge tone={c.mode === "live" ? "accent" : "warning"}>{c.mode === "live" ? "Live" : "Test mode"}</Badge>
            <Badge tone={c.status === "connected" ? "success" : c.status === "error" ? "danger" : "neutral"}>
              {c.status === "connected" ? "Connected" : c.status === "error" ? "Not working" : "Not checked"}
            </Badge>
            {canEdit && (
              <Button size="xs" variant="ghost" disabled={act.isPending} onClick={() => act.mutate({ step: "check" })}>
                <RefreshCw />
                Check
              </Button>
            )}
          </span>
        )
      }
    >
      {c?.status === "error" && c.lastError && (
        <Alert tone="danger" className="mb-3">
          Razorpay said: {c.lastError}
        </Alert>
      )}
      <fieldset disabled={!canEdit} className="grid gap-3 sm:grid-cols-2">
        <Field label="Key ID" error={errors.keyId}>
          <Input className="tabular-nums" value={f.keyId} onChange={(e) => setF({ ...f, keyId: e.target.value })} placeholder="rzp_live_…" />
        </Field>
        <Field label="Key secret" error={errors.keySecret} hint={c ? `Saved (${c.secretHint}) — paste a new one to replace it` : undefined}>
          <Input type="password" autoComplete="off" value={f.keySecret} onChange={(e) => setF({ ...f, keySecret: e.target.value })} />
        </Field>
      </fieldset>
      {canEdit && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button disabled={act.isPending} onClick={save}>
            <PlugZap />
            {c ? "Save" : "Connect"}
          </Button>
          {c && (
            <Button
              variant="ghost"
              disabled={act.isPending}
              onClick={() => act.mutate({ step: "disconnect" }, { onSuccess: () => toast.success("Disconnected — new invoices get no payment link") })}
            >
              <Unplug />
              Disconnect
            </Button>
          )}
        </div>
      )}
    </SectionCard>
  );
}

/** Settings → Payments (P3-10): the agency's own Razorpay, so every issued invoice carries a payment link. */
export function LivePaymentSettings() {
  const can = useCan();
  const s = usePayments();
  const canEdit = can("settings", "edit");
  return (
    <>
      <PageHeader
        title="Payments"
        description="Take invoice payments through your own Razorpay account: each issued invoice gets a payment link (in the client's portal too), and is marked paid by itself when the money arrives."
      />
      {s.isPending ? (
        <SkeletonRows rows={6} />
      ) : s.error ? (
        <Alert tone="danger">{errorMessage(s.error)}</Alert>
      ) : (
        <div className="space-y-4">
          {s.data.provider === "outbox" && <Alert tone="info">On this server payment links are pretend ones — no money moves.</Alert>}
          <Keys key={s.data.connection?.keyId ?? "new"} s={s.data} canEdit={canEdit} />
          {s.data.connection && (
            <SectionCard
              title="Paid by itself"
              description="So Razorpay tells the app when a link is paid: Razorpay Dashboard → Account & Settings → Webhooks → Add new webhook. Paste these, and tick the events payment_link.paid, payment_link.cancelled and payment_link.expired."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["Webhook URL", s.data.connection.webhookUrl],
                    ["Secret", s.data.connection.webhookSecret],
                  ] as const
                ).map(([label, value]) => (
                  <Field key={label} label={label}>
                    <div className="flex gap-2">
                      <Input readOnly value={value} onFocus={(e) => e.target.select()} className="tabular-nums" />
                      <Button variant="secondary" size="icon-sm" aria-label={`Copy ${label}`} onClick={() => copy(value)}>
                        <Copy />
                      </Button>
                    </div>
                  </Field>
                ))}
              </div>
            </SectionCard>
          )}
        </div>
      )}
    </>
  );
}

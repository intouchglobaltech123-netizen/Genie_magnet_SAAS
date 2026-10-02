"use client";

import { useState } from "react";
import { CheckCircle2, Copy, PlugZap, RefreshCw, Send, Unplug } from "lucide-react";
import { toast } from "sonner";
import { WHATSAPP_PURPOSES, type WhatsAppPurposeKey, type WhatsAppSettings, whatsappConnectionInput } from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/card";
import { Alert, SkeletonRows } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/input";
import { ApiError, errorMessage } from "./api";
import { useCan, useWhatsApp, useWhatsAppAction, useWhatsAppTest } from "./queries";

const copy = (text: string) =>
  navigator.clipboard.writeText(text).then(
    () => toast.success("Copied"),
    () => toast.error("Copy it from the box"),
  );

function Copyable({ label, value }: { label: string; value: string }) {
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <Input readOnly value={value} onFocus={(e) => e.target.select()} className="font-mono" />
        <Button variant="secondary" size="icon-sm" aria-label={`Copy ${label}`} onClick={() => copy(value)}>
          <Copy />
        </Button>
      </div>
    </Field>
  );
}

function Connection({ s, canEdit }: { s: WhatsAppSettings; canEdit: boolean }) {
  const act = useWhatsAppAction();
  const c = s.connection;
  const [f, setF] = useState({
    phoneNumberId: c?.phoneNumberId ?? "",
    businessId: c?.businessId ?? "",
    accessToken: "",
    appSecret: "",
    quietFrom: c?.quietFrom ?? "21:00",
    quietTo: c?.quietTo ?? "08:00",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = () => {
    const parsed = whatsappConnectionInput.safeParse(f);
    if (!parsed.success) return setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
    setErrors({});
    act.mutate(
      { step: "connect", body: parsed.data },
      {
        onSuccess: (r) => {
          setF({ ...f, accessToken: "", appSecret: "" });
          if (r.connection?.status === "connected") toast.success(`Connected: ${r.connection.displayPhone ?? "your number"}`);
          else if (r.connection?.status === "error") toast.error(r.connection.lastError ?? "WhatsApp did not accept these details");
          else toast.success("Saved");
        },
        onError: (e) =>
          e instanceof ApiError && e.body.issues ? setErrors(Object.fromEntries(e.body.issues.map((i) => [i.path, i.message]))) : toast.error(errorMessage(e)),
      },
    );
  };
  return (
    <SectionCard
      title="Your WhatsApp number"
      description={
        c
          ? undefined
          : "Use your agency's WhatsApp Business number on the WhatsApp Cloud API. In Meta's WhatsApp Manager → API setup you find the phone number ID and can make a permanent access token (System user → Generate token, with whatsapp_business_messaging)."
      }
      actions={
        c && (
          <span className="flex items-center gap-2">
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
      {c?.status === "connected" && (
        <p className="mb-3 flex items-center gap-2 text-body">
          <CheckCircle2 className="size-4 text-success" />
          {c.displayPhone}
          {c.verifiedName && <span className="text-muted-foreground">· {c.verifiedName}</span>}
        </p>
      )}
      {c?.status === "error" && c.lastError && (
        <Alert tone="danger" className="mb-3">
          WhatsApp said: {c.lastError}
        </Alert>
      )}
      <fieldset disabled={!canEdit} className="grid gap-3 sm:grid-cols-2">
        <Field label="Phone number ID" error={errors.phoneNumberId}>
          <Input value={f.phoneNumberId} onChange={(e) => setF({ ...f, phoneNumberId: e.target.value })} inputMode="numeric" />
        </Field>
        <Field label="WhatsApp Business account ID" error={errors.businessId} hint="Optional">
          <Input value={f.businessId} onChange={(e) => setF({ ...f, businessId: e.target.value })} inputMode="numeric" />
        </Field>
        <Field label="Permanent access token" error={errors.accessToken} hint={c ? `Saved (${c.tokenHint}) — paste a new one to replace it` : undefined}>
          <Input type="password" autoComplete="off" value={f.accessToken} onChange={(e) => setF({ ...f, accessToken: e.target.value })} />
        </Field>
        <Field
          label="App secret"
          error={errors.appSecret}
          hint={c?.hasAppSecret ? "Saved — paste a new one to replace it" : "Meta app → App settings → Basic. Needed for replies."}
        >
          <Input type="password" autoComplete="off" value={f.appSecret} onChange={(e) => setF({ ...f, appSecret: e.target.value })} />
        </Field>
        <Field label="No messages to clients from" error={errors.quietFrom}>
          <Input type="time" value={f.quietFrom} onChange={(e) => setF({ ...f, quietFrom: e.target.value })} />
        </Field>
        <Field label="Until" error={errors.quietTo} hint="India time; messages wait until then">
          <Input type="time" value={f.quietTo} onChange={(e) => setF({ ...f, quietTo: e.target.value })} />
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
              onClick={() => act.mutate({ step: "disconnect" }, { onSuccess: () => toast.success("Disconnected — no more messages are sent") })}
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

function Webhook({ s }: { s: WhatsAppSettings }) {
  const c = s.connection!;
  return (
    <SectionCard
      title="Replies and receipts"
      description="So the app hears back — delivered, read, and the client's Approve or Request changes. In your Meta app → WhatsApp → Configuration → Webhook, paste these two, then subscribe to “messages”."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Copyable label="Callback URL" value={c.webhookUrl} />
        <Copyable label="Verify token" value={c.verifyToken} />
      </div>
      {!c.hasAppSecret && (
        <Alert tone="warning" className="mt-3">
          Add your app secret above: replies are only believed when Meta signs them with it.
        </Alert>
      )}
    </SectionCard>
  );
}

function TemplateRow({ purpose, s, canEdit }: { purpose: WhatsAppPurposeKey; s: WhatsAppSettings; canEdit: boolean }) {
  const act = useWhatsAppAction();
  const spec = WHATSAPP_PURPOSES[purpose];
  const saved = s.templates.find((t) => t.purpose === purpose);
  const [name, setName] = useState(saved?.name ?? spec.name);
  const [language, setLanguage] = useState(saved?.language ?? "en");
  return (
    <li className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{spec.label}</span>
        {saved ? <Badge tone="success">Added</Badge> : <Badge tone="neutral">Not added</Badge>}
      </div>
      <div className="rounded-md bg-surface-secondary px-3 py-2 text-body">
        {spec.suggested}
        {spec.buttons.length > 0 && <span className="block text-muted-foreground">Buttons (quick reply): {spec.buttons.join(", ")}</span>}
        <span className="block text-muted-foreground">{spec.variables.map((v, i) => `{{${i + 1}}} ${v}`).join(" · ")}</span>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Button size="xs" variant="ghost" onClick={() => copy(spec.suggested)}>
          <Copy />
          Copy the wording
        </Button>
        {canEdit && (
          <>
            <Input aria-label="Template name" className="w-56 font-mono" value={name} onChange={(e) => setName(e.target.value)} />
            <Input aria-label="Language" className="w-20" value={language} onChange={(e) => setLanguage(e.target.value)} />
            <Button
              size="sm"
              variant="secondary"
              disabled={act.isPending}
              onClick={() =>
                act.mutate(
                  { step: "template", body: { purpose, name, language, active: true } },
                  {
                    onSuccess: () => toast.success("Template added"),
                    onError: (e) => toast.error(e instanceof ApiError && e.body.issues ? e.body.issues[0]!.message : errorMessage(e)),
                  },
                )
              }
            >
              {saved ? "Save" : "Add"}
            </Button>
            {saved && (
              <Button size="sm" variant="ghost" disabled={act.isPending} onClick={() => act.mutate({ step: "removeTemplate", purpose })}>
                Remove
              </Button>
            )}
          </>
        )}
      </div>
    </li>
  );
}

function TestMessage() {
  const test = useWhatsAppTest();
  const [phone, setPhone] = useState("");
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label="Send a test to">
        <Input placeholder="+91 98400 00000" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-56" />
      </Field>
      <Button
        variant="secondary"
        disabled={phone.trim().length < 8 || test.isPending}
        onClick={() => test.mutate(phone, { onSuccess: (r) => toast.success(`Sent with ${r.template}`), onError: (e) => toast.error(errorMessage(e)) })}
      >
        <Send />
        Send a test
      </Button>
    </div>
  );
}

/** Settings → WhatsApp (P3-07): the agency's own number, the replies address, its templates, and a test message. */
export function LiveWhatsAppSettings() {
  const can = useCan();
  const s = useWhatsApp();
  const canEdit = can("settings", "edit");
  return (
    <>
      <PageHeader
        title="WhatsApp"
        description="Your own WhatsApp Business number sends clients their approval requests, onboarding reminders, invoices and news that a video is live — only to contacts who agreed, never in your quiet hours."
      />
      {s.isPending ? (
        <SkeletonRows rows={8} />
      ) : s.error ? (
        <Alert tone="danger">{errorMessage(s.error)}</Alert>
      ) : (
        <div className="space-y-4">
          {s.data.provider === "outbox" && (
            <Alert tone="info">On this server messages stay in the app (see WhatsApp messages) — nothing reaches WhatsApp.</Alert>
          )}
          <Connection key={s.data.connection?.phoneNumberId ?? "new"} s={s.data} canEdit={canEdit} />
          {s.data.connection && <Webhook s={s.data} />}
          {s.data.connection && (
            <SectionCard
              title="Message templates"
              description="WhatsApp only lets businesses start a conversation with a template it has approved. Create each one in WhatsApp Manager → Message templates (category Utility) with this wording, then add its name here."
            >
              <ul className="space-y-3">
                {(Object.keys(WHATSAPP_PURPOSES) as WhatsAppPurposeKey[]).map((p) => (
                  <TemplateRow key={p} purpose={p} s={s.data} canEdit={canEdit} />
                ))}
              </ul>
              {canEdit && s.data.templates.length > 0 && (
                <div className="mt-4 border-t border-border pt-4">
                  <TestMessage />
                </div>
              )}
            </SectionCard>
          )}
        </div>
      )}
    </>
  );
}

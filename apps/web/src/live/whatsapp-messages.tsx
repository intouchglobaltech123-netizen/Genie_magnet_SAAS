"use client";

import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, MessageCircle } from "lucide-react";
import type { WhatsAppMessageRow } from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card, SectionCard } from "@/components/ui/card";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { errorMessage } from "./api";
import { useWhatsAppMessages } from "./queries";

const STATUS: Record<WhatsAppMessageRow["status"], { label: string; tone: BadgeTone }> = {
  queued: { label: "Waiting to send", tone: "neutral" },
  sent: { label: "Sent", tone: "info" },
  delivered: { label: "Delivered", tone: "info" },
  read: { label: "Read", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  skipped: { label: "Not sent", tone: "warning" },
  received: { label: "Received", tone: "accent" },
};
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

function Rows({ rows, showClient }: { rows: WhatsAppMessageRow[]; showClient: boolean }) {
  return (
    <ul className="divide-y divide-border">
      {rows.map((m) => (
        <li key={m.id} className="flex gap-3 px-5 py-3 text-body">
          {m.direction === "in" ? (
            <ArrowDownLeft className="mt-0.5 size-4 shrink-0 text-primary" aria-label="From the client" />
          ) : (
            <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label="To the client" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground">
                {m.contact?.name ?? m.phone}
                {showClient && m.client && (
                  <>
                    {" · "}
                    <Link href={`/app/clients/${m.client.id}`} className="hover:underline">
                      {m.client.name}
                    </Link>
                  </>
                )}
                {" · "}
                {when(m.createdAt)}
              </span>
              <Badge tone={STATUS[m.status].tone}>{STATUS[m.status].label}</Badge>
            </div>
            <p className="mt-0.5 whitespace-pre-line break-words">{m.text}</p>
            {m.reason && <p className="text-warning">{m.reason}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** A client's recent WhatsApp messages, on their page. */
export function ClientWhatsApp({ clientId }: { clientId: string }) {
  const list = useWhatsAppMessages(clientId);
  if (!list.data?.length) return null;
  return (
    <SectionCard title="WhatsApp" description="Messages to and from this client's contacts." contentClassName="p-0">
      <Rows rows={list.data.slice(0, 8)} showClient={false} />
    </SectionCard>
  );
}

/** Every WhatsApp message sent or received (P3-07), newest first — with why one was not sent. */
export function LiveWhatsAppMessages() {
  const list = useWhatsAppMessages();
  return (
    <>
      <PageHeader
        title="WhatsApp messages"
        description="What went to clients on WhatsApp and what they sent back. “Not sent” says why — usually a contact who has not agreed yet."
      />
      {list.isPending ? (
        <SkeletonRows rows={6} />
      ) : list.error ? (
        <Alert tone="danger">{errorMessage(list.error)}</Alert>
      ) : !list.data.length ? (
        <EmptyState icon={MessageCircle} title="No messages yet" description="Connect your number in Settings → WhatsApp and add your templates." />
      ) : (
        <Card>
          <Rows rows={list.data} showClient />
        </Card>
      )}
    </>
  );
}

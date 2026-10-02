"use client";

import { useState } from "react";
import { Copy, LinkIcon, MessageCircle, PowerOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { PortalLinkRow } from "@gm/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SkeletonRows } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { errorMessage } from "./api";
import { fmtDate } from "./format";
import { Checkbox } from "@/components/ui/checkbox";
import { useContactWhatsApp, usePortalLinkAction, usePortalLinks } from "./queries";

/** wa.me wants the number with its country code and digits only. */
const whatsapp = (phone: string, text: string) => `https://wa.me/${phone.replace(/\D/g, "").replace(/^0+/, "")}?text=${encodeURIComponent(text)}`;

/**
 * The client portal on the client's page (P3-01): each contact's private link — made, replaced or switched off. A new
 * link is shown once, ready to copy or send on WhatsApp.
 */
export function ClientPortalLinks({
  clientId,
  clientName,
  agencyName,
  canEdit,
}: {
  clientId: string;
  clientName: string;
  agencyName: string;
  canEdit: boolean;
}) {
  const links = usePortalLinks(clientId);
  const act = usePortalLinkAction(clientId);
  const wa = useContactWhatsApp(clientId);
  const [shown, setShown] = useState<{ row: PortalLinkRow; link: string } | null>(null);
  return (
    <SectionCard
      title="Client portal"
      description="Each contact's own private link: topics to pick, scripts and videos to approve, invoices, and questions for you."
    >
      {links.isPending ? (
        <SkeletonRows rows={2} />
      ) : (
        <ul className="divide-y divide-border-subtle">
          {(links.data ?? []).map((r) => (
            <li key={r.contactId} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0 text-body">
                <div className="font-medium">{r.contactName}</div>
                <div className="text-muted-foreground">
                  {r.active ? (r.lastUsedAt ? `Opened ${fmtDate(r.lastUsedAt)}` : "Link made, not opened yet") : "No link"}
                </div>
                <label className="mt-1 flex items-center gap-2 text-muted-foreground">
                  <Checkbox
                    checked={r.whatsappOptIn}
                    disabled={!canEdit || wa.isPending}
                    onCheckedChange={(on) =>
                      wa.mutate(
                        { contactId: r.contactId, optIn: on === true, source: on === true ? "Told the team" : "Turned off by the team" },
                        { onError: (e) => toast.error(errorMessage(e)) },
                      )
                    }
                  />
                  WhatsApp messages{r.whatsappSource ? ` · ${r.whatsappSource}` : ""}
                </label>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {r.active && <Badge tone="success">On</Badge>}
                {canEdit && (
                  <>
                    <Button
                      size="xs"
                      variant="secondary"
                      disabled={act.isPending}
                      onClick={() =>
                        act.mutate(
                          { step: "make", contactId: r.contactId },
                          { onSuccess: (res) => setShown({ row: r, link: res.link }), onError: (e) => toast.error(errorMessage(e)) },
                        )
                      }
                    >
                      {r.active ? <RefreshCw /> : <LinkIcon />}
                      {r.active ? "New link" : "Make a link"}
                    </Button>
                    {r.active && (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Switch off ${r.contactName}'s link`}
                        disabled={act.isPending}
                        onClick={() =>
                          act.mutate(
                            { step: "remove", contactId: r.contactId },
                            { onSuccess: () => toast.success(`${r.contactName}'s link is switched off`), onError: (e) => toast.error(errorMessage(e)) },
                          )
                        }
                      >
                        <PowerOff />
                      </Button>
                    )}
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {shown && (
        <Dialog open onOpenChange={(o) => !o && setShown(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{shown.row.contactName}&apos;s portal link</DialogTitle>
              <DialogDescription>Shown only now — copy it or send it. A new link stops any earlier one.</DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-3">
              <Input readOnly value={shown.link} onFocus={(e) => e.target.select()} aria-label="Portal link" />
            </DialogBody>
            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() =>
                  navigator.clipboard.writeText(shown.link).then(
                    () => toast.success("Copied"),
                    () => toast.error("Copy it from the box"),
                  )
                }
              >
                <Copy />
                Copy
              </Button>
              <Button asChild>
                <a
                  href={whatsapp(
                    shown.row.phone,
                    `Hello ${shown.row.contactName}, here is your ${clientName} portal from ${agencyName} — topics, scripts and videos to approve, and invoices: ${shown.link}`,
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle />
                  Send on WhatsApp
                </a>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </SectionCard>
  );
}

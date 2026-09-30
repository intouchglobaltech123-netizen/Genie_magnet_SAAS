"use client";

import { MessageCircle, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fillTemplate, waTemplateById } from "@/lib/mock/whatsapp";
import { WhatsAppPreview } from "./whatsapp-preview";

/** Confirm-before-send dialog: shows exactly what the client will receive on WhatsApp. */
export function WhatsAppSendDialog({
  open,
  onOpenChange,
  title,
  description,
  to,
  templateId,
  vars,
  onSend,
  sendLabel = "Send on WhatsApp",
  time = "10:42 AM",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  to: { name: string; phone: string };
  templateId: string;
  vars: Record<string, string | number>;
  onSend: () => void;
  sendLabel?: string;
  time?: string;
}) {
  const t = waTemplateById(templateId);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogBody className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-body">
            <MessageCircle className="size-4 text-success" />
            <span className="font-medium">
              To {to.name} · {to.phone}
            </span>
            <Badge tone="outline">Template: {t.name}</Badge>
          </div>
          <WhatsAppPreview messages={[{ text: fillTemplate(t.body, vars), time, buttons: t.buttons }]} />
          <p className="text-body text-muted-foreground">Sent from the Genie Magnet WhatsApp Business number. Replies land in the client&apos;s timeline.</p>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onSend();
              onOpenChange(false);
            }}
          >
            <Send /> {sendLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

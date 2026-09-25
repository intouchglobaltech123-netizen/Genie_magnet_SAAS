"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useDemo } from "@/lib/store";
import { PORTAL_ACCOUNT_MANAGER, PORTAL_CLIENT_ID, requestTypes } from "@/lib/mock/portal";
import { portalVideos } from "./lib";

export function RequestDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const videos = useDemo((s) => s.videos);
  const addChangeRequest = useDemo((s) => s.addChangeRequest);
  const [type, setType] = useState("new-video");
  const [related, setRelated] = useState("none");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [by, setBy] = useState("2026-10-10");

  const mine = portalVideos(videos);
  const valid = title.trim().length > 2;

  const submit = () => {
    if (!valid) return;
    const label = requestTypes.find((t) => t.value === type)?.label ?? "Request";
    addChangeRequest({
      videoId: related === "none" ? `new:${PORTAL_CLIENT_ID}` : related,
      kind: "out-of-scope",
      summary: `Client request · ${title.trim()}${details.trim() ? ` — ${details.trim()}` : ""} (${label.split(" (")[0]}; wanted by ${by})`,
      status: "open",
    });
    toast.success("Request sent", {
      description: `${PORTAL_ACCOUNT_MANAGER.name}, your account manager, will send an estimate before any work starts.`,
    });
    setTitle("");
    setDetails("");
    setRelated("none");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request something new</DialogTitle>
          <DialogDescription>
            Tell us what you need. Anything outside your monthly package gets a clear estimate first — nothing is billed without your approval.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <Field label="What do you need?" required>
            <Select value={type} onValueChange={setType} options={requestTypes} />
          </Field>
          <Field label="Short title" required>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 15-second Pongal greeting reel" autoFocus />
          </Field>
          <Field label="Details" hint="References, product, language, where it will be posted.">
            <Textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="e.g. Use the sunrise mill shots, Tamil voice-over, for Instagram and WhatsApp status"
            />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Related video (optional)">
              <Select
                value={related}
                onValueChange={setRelated}
                options={[{ value: "none", label: "Not about an existing video" }, ...mine.map((v) => ({ value: v.id, label: v.title }))]}
              />
            </Field>
            <Field label="Needed by">
              <Input type="date" value={by} onChange={(e) => setBy(e.target.value)} />
            </Field>
          </div>
          <Alert tone="info" icon={Sparkles}>
            You&apos;ll receive an estimate with price and delivery date. Work begins only after you approve it here.
          </Alert>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="accent" onClick={submit} disabled={!valid}>
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

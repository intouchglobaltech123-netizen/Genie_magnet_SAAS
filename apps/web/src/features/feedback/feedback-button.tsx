"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2, MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { roleLabels } from "@/lib/nav";
import { useDemo } from "@/lib/store";
import { cn } from "@/lib/utils";
import { FEEDBACK_PRIORITIES, FEEDBACK_TYPES, moduleForPath } from "./meta";

const NAME_KEY = "gm-feedback-name";

/** Floating "Feedback" button on every screen: reviewers leave comments tied to the page they are on. */
export function FeedbackButton() {
  const pathname = usePathname();
  const role = useDemo((s) => s.role);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("change");
  const [priority, setPriority] = useState<string>("nice");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);


  if (pathname === "/login") return null;
  const moduleName = moduleForPath(pathname);

  const submit = async () => {
    if (!text.trim()) {
      setError("Tell us what you would like changed or added.");
      return;
    }
    setBusy(true);
    try {
      try {
        localStorage.setItem(NAME_KEY, name.trim());
      } catch {}
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type, priority, text, page: pathname, module: moduleName, role: roleLabels[role].label }),
      });
      if (!res.ok) throw new Error();
      toast.success("Feedback sent", { description: `Saved against ${moduleName}. Thank you!` });
      setText("");
      setError("");
      setOpen(false);
    } catch {
      toast.error("Could not send feedback", { description: "Please try again in a moment." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => {
          try {
            const saved = localStorage.getItem(NAME_KEY);
            if (saved && !name) setName(saved);
          } catch {}
          setOpen(true);
        }}
        className={cn(
          "fixed bottom-5 right-5 z-40 inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-primary px-4 text-body font-medium text-primary-foreground shadow-lg ring-1 ring-accent/40 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          "print:hidden",
        )}
        aria-label="Give feedback on this screen"
      >
        <MessageSquarePlus className="size-4" />
        <span className="hidden sm:inline">Feedback</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Feedback on this screen</DialogTitle>
            <DialogDescription>
              {moduleName} · viewing as {roleLabels[role].label}. Tell us what should change, what is missing, or what works well.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field label="Your name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ashwin" />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Type">
                <Select value={type} onValueChange={setType} options={[...FEEDBACK_TYPES]} aria-label="Feedback type" />
              </Field>
              <Field label="Priority">
                <Select value={priority} onValueChange={setPriority} options={[...FEEDBACK_PRIORITIES]} aria-label="Priority" />
              </Field>
            </div>
            <Field label="Comment" required error={error}>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                aria-invalid={!!error}
                placeholder="e.g. Add a column for the shoot location, and let the manager approve from this list."
              />
            </Field>
          </DialogBody>
          <DialogFooter className="items-center justify-between">
            <Link href="/feedback" onClick={() => setOpen(false)} className="text-body font-medium text-primary hover:underline dark:text-text-primary">
              View all feedback
            </Link>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={busy}>
                {busy && <Loader2 className="animate-spin" />}
                Send feedback
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

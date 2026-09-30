"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AskPanel } from "./ask-panel";
import { useGenie } from "./store";

/** "Ask Genie" from anywhere: top-bar button + side sheet. */
export function AskGenieButton() {
  const setAskOpen = useGenie((s) => s.setAskOpen);
  return (
    <Button variant="ghost" size="sm" onClick={() => setAskOpen(true)} className="text-primary dark:text-text-primary" aria-label="Ask Genie">
      <Sparkles className="text-accent-strong" />
      <span className="hidden xl:inline">Ask Genie</span>
    </Button>
  );
}

export function AskGenieSheet() {
  const open = useGenie((s) => s.askOpen);
  const setAskOpen = useGenie((s) => s.setAskOpen);
  return (
    <Dialog open={open} onOpenChange={setAskOpen}>
      <DialogContent side="right" className="flex max-w-md flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-accent-strong" /> Ask Genie
          </DialogTitle>
          <DialogDescription>Questions about clients, deadlines, approvals and money — answered from your data, with sources.</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col px-6 pb-6">
          <AskPanel className="flex-1" onNavigate={() => setAskOpen(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

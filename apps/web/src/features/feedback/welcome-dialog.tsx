"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Database, MessageSquarePlus, Network, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const SEEN_KEY = "gm-welcome-v1";
export const OPEN_WELCOME_EVENT = "gm:open-welcome";

const tips = [
  { icon: Database, title: "Sample data only", text: "Every name, number and video is dummy data. Click anything — changes stay in your browser, and Reset demo data (profile menu) clears them." },
  { icon: UserRound, title: "Switch roles", text: "Use the profile menu, top right, to see the system as Founder, Manager, Editor, Finance, HR or the Client." },
  { icon: Network, title: "Module Map", text: "Lists all 47 modules. Demo = fully clickable, Preview = sample screens, Planned = phase 2." },
  { icon: MessageSquarePlus, title: "Leave feedback anywhere", text: "The Feedback button, bottom right, saves your comment against the screen you are on. Everything is collected in one list." },
];

/** First-visit guide for reviewers opening the hosted demo link on their own. */
export function WelcomeDialog() {
  const pathname = usePathname();
  // Radix renders the dialog in a portal after mount, so reading storage here cannot cause a hydration mismatch.
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return !localStorage.getItem(SEEN_KEY);
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_WELCOME_EVENT, reopen);
    return () => window.removeEventListener(OPEN_WELCOME_EVENT, reopen);
  }, []);

  const close = (v: boolean) => {
    setOpen(v);
    if (!v)
      try {
        localStorage.setItem(SEEN_KEY, "1");
      } catch {}
  };

  if (pathname === "/login") return null;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Welcome to the Agency OS demo</DialogTitle>
          <DialogDescription>A clickable preview for Genie Magnet. Explore freely, then tell us what to change.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <ul className="space-y-4">
            {tips.map((t) => (
              <li key={t.title} className="flex gap-3">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <t.icon className="size-4" />
                </span>
                <div>
                  <p className="text-body font-semibold text-text-primary">{t.title}</p>
                  <p className="text-body text-muted-foreground">{t.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </DialogBody>
        <DialogFooter>
          <Button onClick={() => close(false)}>Start exploring</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

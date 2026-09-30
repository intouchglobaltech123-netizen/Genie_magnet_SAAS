"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, Database, MessageSquarePlus, Network, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const SEEN_KEY = "gm-welcome-v2";
export const OPEN_WELCOME_EVENT = "gm:open-welcome";

const tips = [
  { icon: Database, title: "Sample data only", text: "Every name, number and video is dummy data. Click anything — changes stay in your browser, and Reset demo data (profile menu) clears them." },
  { icon: UserRound, title: "Switch roles", text: "Use the profile menu, top right, to see the system as Founder, Manager, Editor, Finance, HR or the Client." },
  { icon: Network, title: "Module Map", text: "Lists every module. Demo = fully clickable, Preview = sample screens, Planned = overview of a later phase." },
  { icon: MessageSquarePlus, title: "Leave feedback anywhere", text: "The Feedback button, bottom right, saves your comment against the screen you are on. Everything is collected in one list." },
];

const whatsNew = [
  { href: "/onboarding", title: "Onboarding questionnaires", text: "Growth OS questions — essentials unlock the work, the rest within 7 days" },
  { href: "/content", title: "Content", text: "Ideas → client picks topics → scripts → client approves" },
  { href: "/genie", title: "Genie Assistant", text: "Drafts ready to approve, and Ask Genie" },
  { href: "/clients", title: "Clients", text: "Lifecycle tracker for every client" },
  { href: "/publishing", title: "Publishing & Integrations", text: "Add any platform, quotas, WhatsApp messages" },
  { href: "/reviews", title: "STOP calendar", text: "Daily, weekly, 14-day and 45-day reviews" },
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

  // Never on the login page or on a client's own questionnaire link.
  if (pathname === "/login" || pathname.startsWith("/q/")) return null;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Welcome to the Genie Magnet OS demo</DialogTitle>
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
          <div className="mt-5 border-t border-border-subtle pt-4">
            <p className="text-body font-semibold text-text-primary">New in this version</p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {whatsNew.map((w) => (
                <Link
                  key={w.href}
                  href={w.href}
                  onClick={() => close(false)}
                  className="group rounded-xl border border-border p-2.5 text-body transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
                >
                  <span className="flex items-center justify-between gap-1 font-medium text-text-primary">
                    {w.title} <ArrowUpRight className="size-3.5 text-muted-foreground transition group-hover:text-primary" />
                  </span>
                  <span className="block text-muted-foreground">{w.text}</span>
                </Link>
              ))}
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button onClick={() => close(false)}>Start exploring</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

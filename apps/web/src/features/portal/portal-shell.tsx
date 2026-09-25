"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { BrandMark } from "@/components/shell/brand";
import { useDemo } from "@/lib/store";
import { PORTAL_ACCOUNT_MANAGER, PORTAL_USER } from "@/lib/mock/portal";
import { cn } from "@/lib/utils";

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35";

const links = [
  { href: "/portal", label: "Overview" },
  { href: "/portal/library", label: "Library" },
];

export function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const setRole = useDemo((s) => s.setRole);

  const exit = () => {
    setRole("founder");
    toast.success("Back to internal view", { description: "Viewing as Founder / MD" });
    router.push("/");
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur-xl">
        <div className="h-0.5 bg-accent" aria-hidden />
        <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center gap-4 px-4 lg:gap-6 lg:px-8">
          <Link href="/portal" className={cn("flex min-w-0 items-center gap-2.5 rounded-lg", FOCUS)} aria-label="Agency OS · Client Hub — overview">
            <BrandMark />
            <span className="truncate text-body font-semibold tracking-tight text-primary dark:text-text-primary">
              Agency OS <span className="hidden font-normal text-muted-foreground min-[420px]:inline">· Client Hub</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {links.map((l) => {
              const active = l.href === "/portal" ? pathname === "/portal" : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-body font-medium transition-colors",
                    FOCUS,
                    active ? "bg-primary-soft text-primary dark:text-text-primary" : "text-muted-foreground hover:bg-muted hover:text-text-primary",
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Tooltip content={`${PORTAL_ACCOUNT_MANAGER.name} · ${PORTAL_ACCOUNT_MANAGER.hours}`}>
              <Button
                variant="ghost"
                size="sm"
                className="hidden md:inline-flex"
                onClick={() =>
                  toast.success(`Message sent to ${PORTAL_ACCOUNT_MANAGER.name}`, {
                    description: "Your account manager usually replies within 2 working hours.",
                  })
                }
              >
                <MessageCircle /> Message {PORTAL_ACCOUNT_MANAGER.name}
              </Button>
            </Tooltip>
            <div className="hidden items-center gap-2.5 border-l border-border pl-3 min-[420px]:flex">
              <Avatar name={PORTAL_USER.name} size="md" />
              <div className="hidden leading-tight sm:block">
                <div className="text-body font-medium">{PORTAL_USER.name}</div>
                <div className="text-body text-muted-foreground">{PORTAL_USER.company}</div>
              </div>
            </div>
            <Button variant="outline" size="xs" onClick={exit} className="ml-1" aria-label="Exit client view">
              <LogOut /> <span className="hidden sm:inline">Exit client view</span>
              <span className="sm:hidden">Exit</span>
            </Button>
          </div>
        </div>
        <nav className="flex gap-1 px-4 pb-2 sm:hidden">
          {links.map((l) => {
            const active = l.href === "/portal" ? pathname === "/portal" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1 text-body font-medium transition-colors",
                  FOCUS,
                  active ? "bg-primary-soft text-primary dark:text-text-primary" : "text-muted-foreground hover:bg-muted hover:text-text-primary",
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-8 lg:px-8 lg:py-10">{children}</main>
      <footer className="border-t border-border bg-surface-secondary">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-2 px-4 py-5 text-body text-muted-foreground lg:px-8">
          <span>Client Hub for {PORTAL_USER.company} · delivered by Genie Magnet</span>
          <span>Questions? {PORTAL_ACCOUNT_MANAGER.email} · {PORTAL_ACCOUNT_MANAGER.phone}</span>
        </div>
      </footer>
    </div>
  );
}

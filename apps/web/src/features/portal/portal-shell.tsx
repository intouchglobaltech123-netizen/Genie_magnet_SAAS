"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { useDemo } from "@/lib/store";
import { PORTAL_ACCOUNT_MANAGER, PORTAL_USER } from "@/lib/mock/portal";
import { cn } from "@/lib/utils";

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
      <header className="sticky top-0 z-30 border-b border-border bg-card/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center gap-6 px-4 lg:px-8">
          <Link href="/portal" className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-body font-bold text-primary-foreground">A</span>
            <span className="text-body font-semibold tracking-tight">
              Agency OS <span className="font-normal text-muted-foreground">· Client Hub</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {links.map((l) => {
              const active = l.href === "/portal" ? pathname === "/portal" : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-body font-medium transition",
                    active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
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
            <div className="flex items-center gap-2.5 border-l border-border pl-3">
              <Avatar name={PORTAL_USER.name} size="md" />
              <div className="hidden leading-tight sm:block">
                <div className="text-body font-medium">{PORTAL_USER.name}</div>
                <div className="text-body text-muted-foreground">{PORTAL_USER.company}</div>
              </div>
            </div>
            <Button variant="outline" size="xs" onClick={exit} className="ml-1">
              <LogOut className="!size-3.5" /> Exit client view
            </Button>
          </div>
        </div>
        <nav className="flex gap-1 px-4 pb-2 sm:hidden">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-md px-3 py-1 text-body text-muted-foreground">
              {l.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-8 lg:px-8 lg:py-10">{children}</main>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-2 px-4 py-5 text-body text-muted-foreground lg:px-8">
          <span>Client Hub for {PORTAL_USER.company} · delivered by Genie Magnet</span>
          <span>Questions? {PORTAL_ACCOUNT_MANAGER.email} · {PORTAL_ACCOUNT_MANAGER.phone}</span>
        </div>
      </footer>
    </div>
  );
}

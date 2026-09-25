"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronDown, ChevronRight, LogOut, Menu, Moon, RotateCcw, Search, Sun } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CommandMenu } from "@/components/shell/command-menu";
import { useRT } from "@/features/round-table/store";
import { navSections, roleLabels } from "@/lib/nav";
import { useDemo } from "@/lib/store";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useShell } from "./ui-store";

/** Section › Module › Detail, derived from the navigation map. */
function Breadcrumbs() {
  const pathname = usePathname();
  let match: { section: string; title: string; href: string } | undefined;
  for (const s of navSections)
    for (const i of s.items)
      if ((i.href === "/" ? pathname === "/" : pathname === i.href || pathname.startsWith(i.href + "/")) && (!match || i.href.length > match.href.length))
        match = { section: s.title, title: i.title, href: i.href };
  if (!match) return null;
  const deeper = pathname !== match.href;
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-body text-muted-foreground md:flex">
      <span className="truncate">{match.section}</span>
      <ChevronRight className="size-3.5 shrink-0 opacity-60" />
      {deeper ? (
        <Link href={match.href} className="truncate hover:text-primary">
          {match.title}
        </Link>
      ) : (
        <span className="truncate font-medium text-text-primary" aria-current="page">
          {match.title}
        </span>
      )}
      {deeper && (
        <>
          <ChevronRight className="size-3.5 shrink-0 opacity-60" />
          <span className="truncate font-medium text-text-primary" aria-current="page">
            Details
          </span>
        </>
      )}
    </nav>
  );
}

export function Topbar() {
  const router = useRouter();
  const { role, setRole, activity, reset } = useDemo();
  const setMobileOpen = useShell((s) => s.setMobileOpen);
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleTheme = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("gm-theme", next ? "dark" : "light");
    } catch {}
  };

  const switchRole = (r: Role) => {
    setRole(r);
    toast.success(`Viewing as ${roleLabels[r].label}`, { description: roleLabels[r].desc });
    router.push(r === "client" ? "/portal" : "/");
  };

  const me = roleLabels[role];

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur-md lg:px-8">
      <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
        <Menu />
      </Button>

      <Breadcrumbs />

      <button
        onClick={() => setCmdOpen(true)}
        className="ml-auto flex h-9 w-full min-w-0 max-w-xs cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-3 text-body text-muted-foreground transition-colors hover:border-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 md:ml-6 md:max-w-sm"
      >
        <Search className="size-4 shrink-0" />
        <span className="truncate">Search modules, clients, videos…</span>
        <kbd className="ml-auto hidden rounded border border-border bg-muted px-1.5 font-mono text-body sm:inline">Ctrl K</kbd>
      </button>

      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="icon-sm" onClick={toggleTheme} aria-label="Toggle dark mode">
          <Sun className="hidden dark:block" />
          <Moon className="dark:hidden" />
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="relative" aria-label="Notifications">
              <Bell />
              <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-danger ring-2 ring-background" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-96 max-w-[calc(100vw-2rem)] p-0">
            <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
              <span className="text-body font-semibold">Activity</span>
              <span className="text-body text-muted-foreground">Live across modules</span>
            </div>
            <ul className="scrollbar-thin max-h-96 overflow-y-auto p-2">
              {activity.slice(0, 12).map((a) => (
                <li key={a.id} className="flex gap-3 rounded-lg px-2 py-2 hover:bg-muted">
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      a.tone === "success" ? "bg-success" : a.tone === "danger" ? "bg-danger" : a.tone === "warning" ? "bg-warning" : "bg-secondary",
                    )}
                  />
                  <div className="min-w-0">
                    <p className="text-body">{a.text}</p>
                    <p className="mt-0.5 text-body text-muted-foreground">
                      {new Date(a.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-1 flex cursor-pointer items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
              <Avatar name={me.person} size="md" />
              <div className="hidden text-left sm:block">
                <div className="text-body font-medium leading-4 text-text-primary">{me.person.split(" · ")[0]}</div>
                <div className="text-body leading-4 text-muted-foreground">{me.label}</div>
              </div>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>View the system as…</DropdownMenuLabel>
            {(Object.keys(roleLabels) as Role[]).map((r) => (
              <DropdownMenuItem key={r} onSelect={() => switchRole(r)} className={cn(r === role && "bg-muted")}>
                <Avatar name={roleLabels[r].person} size="sm" />
                <div className="min-w-0">
                  <div className="font-medium">{roleLabels[r].label}</div>
                  <div className="truncate text-body text-muted-foreground">{roleLabels[r].desc}</div>
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                reset();
                useRT.getState().resetAll();
                toast("Demo data reset", { description: "All changes made during the demo were cleared." });
              }}
            >
              <RotateCcw /> Reset demo data
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => router.push("/login")}>
              <LogOut /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CommandMenu open={cmdOpen} onOpenChange={setCmdOpen} />
    </header>
  );
}

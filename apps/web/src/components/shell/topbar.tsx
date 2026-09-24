"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown, Moon, RotateCcw, Search, Sun } from "lucide-react";
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
import { roleLabels } from "@/lib/nav";
import { useDemo } from "@/lib/store";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Topbar() {
  const router = useRouter();
  const { role, setRole, activity, reset } = useDemo();
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
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl lg:px-8">
      <button
        onClick={() => setCmdOpen(true)}
        className="flex h-9 w-full max-w-md cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 text-[13px] text-muted-foreground transition hover:border-input"
      >
        <Search className="size-4" />
        <span>Search modules, clients, videos…</span>
        <kbd className="ml-auto rounded border border-border bg-muted px-1.5 font-mono text-[10.5px]">Ctrl K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-1.5">
        <Button variant="ghost" size="icon-sm" onClick={toggleTheme} aria-label="Toggle theme">
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
          <PopoverContent align="end" className="w-96 p-0">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-semibold">Activity</span>
              <span className="text-xs text-muted-foreground">Live across modules</span>
            </div>
            <ul className="scrollbar-thin max-h-96 overflow-y-auto p-2">
              {activity.slice(0, 12).map((a) => (
                <li key={a.id} className="flex gap-3 rounded-lg px-2 py-2 hover:bg-muted">
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      a.tone === "success" ? "bg-success" : a.tone === "danger" ? "bg-danger" : a.tone === "warning" ? "bg-warning" : "bg-accent",
                    )}
                  />
                  <div className="min-w-0">
                    <p className="text-[13px] leading-snug">{a.text}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
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
            <button className="ml-1 flex cursor-pointer items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition hover:bg-muted">
              <Avatar name={me.person} size="md" />
              <div className="hidden text-left leading-tight sm:block">
                <div className="text-[13px] font-medium">{me.person.split(" · ")[0]}</div>
                <div className="text-[11px] text-muted-foreground">{me.label}</div>
              </div>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>View the system as…</DropdownMenuLabel>
            {(Object.keys(roleLabels) as Role[]).map((r) => (
              <DropdownMenuItem key={r} onSelect={() => switchRole(r)} className={cn(r === role && "bg-muted")}>
                <Avatar name={roleLabels[r].person} size="sm" />
                <div className="min-w-0 leading-tight">
                  <div className="font-medium">{roleLabels[r].label}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{roleLabels[r].desc}</div>
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                reset();
                toast("Demo data reset", { description: "All changes made during the demo were cleared." });
              }}
            >
              <RotateCcw /> Reset demo data
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CommandMenu open={cmdOpen} onOpenChange={setCmdOpen} />
    </header>
  );
}

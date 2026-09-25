"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { navSections, type Depth } from "@/lib/nav";
import { useDemo } from "@/lib/store";
import { cn } from "@/lib/utils";
import { BrandMark, BrandWordmark } from "./brand";
import { useShell } from "./ui-store";

const depthDot: Record<Depth, string> = {
  demo: "bg-accent",
  preview: "bg-chart-4",
  planned: "bg-sidebar-muted/50",
};

const depthLabel: Record<Depth, string> = { demo: "Demo", preview: "Preview", planned: "Planned" };

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));
}

function NavList({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const role = useDemo((s) => s.role);
  const isActive = useIsActive();

  return (
    <nav className={cn("scrollbar-thin flex-1 overflow-y-auto pb-6 pt-2", collapsed ? "space-y-4 px-2.5" : "space-y-5 px-3")} aria-label="Main">
      {navSections.map((section) => {
        const items = section.items.filter((i) => !i.roles || i.roles.includes(role));
        if (!items.length) return null;
        return (
          <div key={section.title}>
            {collapsed ? (
              <div className="mx-auto mb-2 h-px w-6 bg-sidebar-border" />
            ) : (
              <div className="mb-1.5 px-2.5 text-body font-medium text-sidebar-muted">{section.title}</div>
            )}
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                const link = (
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex h-9 items-center gap-2.5 rounded-lg text-body transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
                      collapsed ? "justify-center px-0" : "px-2.5",
                      active
                        ? "bg-sidebar-active font-medium text-white"
                        : "text-sidebar-foreground hover:bg-sidebar-hover hover:text-white",
                    )}
                  >
                    {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-accent" aria-hidden />}
                    <Icon className={cn("size-4 shrink-0", active ? "text-accent" : "text-sidebar-muted group-hover:text-white")} />
                    {!collapsed && (
                      <>
                        <span className="truncate">{item.title}</span>
                        <span className={cn("ml-auto size-1.5 shrink-0 rounded-full", depthDot[item.depth])} title={depthLabel[item.depth]} />
                      </>
                    )}
                  </Link>
                );
                return (
                  <li key={item.href}>
                    {collapsed ? (
                      <Tooltip content={item.title} side="right">
                        {link}
                      </Tooltip>
                    ) : (
                      link
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-3 text-body text-sidebar-muted">
      {(Object.keys(depthDot) as Depth[]).map((d) => (
        <span key={d} className="flex items-center gap-1.5">
          <span className={cn("size-1.5 rounded-full", depthDot[d])} />
          {depthLabel[d]}
        </span>
      ))}
    </div>
  );
}

export function Sidebar() {
  const collapsed = useShell((s) => s.collapsed);
  const toggle = useShell((s) => s.toggleCollapsed);

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex",
        collapsed ? "w-[72px]" : "w-[256px]",
      )}
    >
      <Link href="/" className={cn("flex h-16 shrink-0 items-center gap-3", collapsed ? "justify-center" : "px-5")}>
        <BrandMark />
        {!collapsed && <BrandWordmark inverted sub="Genie Magnet · Workspace" />}
      </Link>

      <NavList collapsed={collapsed} />

      <div className={cn("flex shrink-0 items-center border-t border-sidebar-border py-3", collapsed ? "justify-center" : "justify-between px-5")}>
        {!collapsed && <Legend />}
        <Tooltip content={collapsed ? "Expand sidebar" : "Collapse sidebar"} side="right">
          <button
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          </button>
        </Tooltip>
      </div>
    </aside>
  );
}

/** Below the lg breakpoint the sidebar becomes a slide-in drawer. */
export function MobileSidebar() {
  const open = useShell((s) => s.mobileOpen);
  const setOpen = useShell((s) => s.setMobileOpen);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-primary/40 backdrop-blur-[1.5px] lg:hidden" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col bg-sidebar shadow-lg focus:outline-none lg:hidden"
        >
          <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
          <div className="flex h-16 shrink-0 items-center justify-between px-5">
            <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-3">
              <BrandMark />
              <BrandWordmark inverted sub="Genie Magnet · Workspace" />
            </Link>
            <DialogPrimitive.Close
              aria-label="Close navigation"
              className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-sidebar-muted hover:bg-sidebar-hover hover:text-white"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
          </div>
          <NavList collapsed={false} onNavigate={() => setOpen(false)} />
          <div className="border-t border-sidebar-border px-5 py-3">
            <Legend />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { navSections, type Depth } from "@/lib/nav";
import { useDemo } from "@/lib/store";
import { cn } from "@/lib/utils";

const depthDot: Record<Depth, string> = {
  demo: "bg-primary",
  preview: "bg-[#22b8a7]",
  planned: "bg-zinc-600",
};

export function Sidebar() {
  const pathname = usePathname();
  const role = useDemo((s) => s.role);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <Link href="/" className="flex h-14 shrink-0 items-center gap-2.5 px-5">
        <span className="relative inline-flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#8b7dff] via-[#6d5dfc] to-[#c8962d] shadow-lg shadow-[#6d5dfc]/30">
          <Sparkles className="size-3.5 text-white" strokeWidth={2.5} />
        </span>
        <div className="leading-tight">
          <div className="text-body font-semibold tracking-tight text-white">Agency OS</div>
          <div className="text-body text-zinc-500">Genie Magnet · Workspace</div>
        </div>
      </Link>

      <nav className="scrollbar-thin flex-1 space-y-5 overflow-y-auto px-3 pb-6 pt-2">
        {navSections.map((section) => {
          const items = section.items.filter((i) => !i.roles || i.roles.includes(role));
          if (!items.length) return null;
          return (
            <div key={section.title}>
              <div className="mb-1.5 px-2.5 text-body font-medium uppercase tracking-[0.08em] text-zinc-600">{section.title}</div>
              <ul className="space-y-px">
                {items.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "group flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-body transition-colors",
                          active ? "bg-sidebar-active text-white" : "text-sidebar-foreground hover:bg-sidebar-active/60 hover:text-zinc-200",
                        )}
                      >
                        <Icon className={cn("size-4 shrink-0", active ? "text-[#a89dff]" : "text-zinc-500 group-hover:text-zinc-300")} />
                        <span className="truncate">{item.title}</span>
                        <span className={cn("ml-auto size-1.5 shrink-0 rounded-full opacity-70", depthDot[item.depth])} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-5 py-3 text-body text-zinc-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-primary" />Demo</span>
          <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-[#22b8a7]" />Preview</span>
          <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-zinc-600" />Planned</span>
        </div>
      </div>
    </aside>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { isActive, SETTINGS_GROUPS, useNavVisible } from "./nav";

function useSettingsGroups() {
  const visible = useNavVisible();
  return SETTINGS_GROUPS.map((g) => ({ ...g, items: g.items.filter(visible) })).filter((g) => g.items.length);
}

/** Every settings page: its sections on the left (wide screens), the page on the right. */
export function SettingsFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const groups = useSettingsGroups();
  // The settings home lists every section itself.
  if (pathname === "/app/settings") return children;
  return (
    <div className="lg:grid lg:grid-cols-[208px_minmax(0,1fr)] lg:gap-8">
      <nav aria-label="Settings" className="hidden lg:block print:hidden">
        <div className="sticky top-20 space-y-5">
          <Link href="/app/settings" className="block px-2.5 text-subheading font-semibold text-text-primary hover:text-primary">
            Settings
          </Link>
          {groups.map((g) => (
            <div key={g.title}>
              <div className="mb-1 px-2.5 text-body text-muted-foreground">{g.title}</div>
              <ul className="space-y-0.5">
                {g.items.map((i) => {
                  const active = isActive(pathname, i.href);
                  return (
                    <li key={i.href}>
                      <Link
                        href={i.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex h-8 items-center rounded-lg px-2.5 text-body transition-colors",
                          active ? "bg-primary-soft font-medium text-primary" : "text-text-secondary hover:bg-muted hover:text-primary",
                        )}
                      >
                        <span className="truncate">{i.title}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** /app/settings: every setting this person may open, by section. */
export function SettingsHome() {
  const groups = useSettingsGroups();
  return (
    <>
      <PageHeader title="Settings" description="How your agency is set up, and who may do what." />
      <div className="grid items-start gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {groups.map((g) => (
          <Card key={g.title} className="p-2">
            <div className="px-3 pb-1 pt-2 text-subheading font-semibold">{g.title}</div>
            <ul>
              {g.items.map((i) => (
                <li key={i.href}>
                  <Link href={i.href} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-body transition-colors hover:bg-muted">
                    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                      <i.icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium text-text-primary">{i.title}</span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}

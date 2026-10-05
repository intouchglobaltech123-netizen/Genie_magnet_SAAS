"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Building2, CornerDownLeft, Film, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { allPages, useNavVisible } from "./nav";
import { useCan, useClients, useVideos } from "./queries";

const itemCls =
  "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-body text-text-primary data-[selected=true]:bg-primary-soft data-[selected=true]:text-primary [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground";
const groupCls =
  "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-body [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground";

/** The search box in the top bar (Ctrl K / ⌘K): every page this person may open, the clients and the videos. */
export function SearchButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search"
        className={cn(
          "flex h-9 min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-3 text-body text-muted-foreground transition-colors hover:border-secondary/40 hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
          className,
        )}
      >
        <Search className="size-4 shrink-0" />
        <span className="hidden truncate sm:inline">Search…</span>
        <kbd className="ml-auto hidden shrink-0 rounded-md border border-border bg-muted px-1.5 text-body text-muted-foreground md:inline">Ctrl K</kbd>
      </button>
      {open && <SearchDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function SearchDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const visible = useNavVisible();
  const can = useCan();
  const clients = useClients(can("clients", "view"));
  const videos = useVideos("", can("production", "view"));
  const pages = allPages().filter((p) => visible(p.item));
  const go = (href: string) => {
    onClose();
    router.push(href);
  };
  return (
    <DialogPrimitive.Root open onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-primary/30 backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[12vh] z-50 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-popover shadow-pop focus:outline-none"
        >
          <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>
          <Command loop>
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <Command.Input
                autoFocus
                placeholder="Search pages, clients and videos"
                className="h-12 w-full bg-transparent text-body outline-none placeholder:text-muted-foreground"
              />
              <kbd className="shrink-0 rounded-md border border-border bg-muted px-1.5 text-body text-muted-foreground">Esc</kbd>
            </div>
            <Command.List className="scrollbar-thin max-h-[min(60vh,440px)] overflow-y-auto p-2">
              <Command.Empty className="py-10 text-center text-body text-muted-foreground">Nothing found.</Command.Empty>
              <Command.Group heading="Pages" className={groupCls}>
                {pages.map(({ section, item }) => (
                  <Command.Item key={item.href} value={`${item.title} ${section ?? ""} ${item.href}`} onSelect={() => go(item.href)} className={itemCls}>
                    <item.icon />
                    <span className="truncate">{item.title}</span>
                    {section && <span className="ml-auto shrink-0 text-muted-foreground">{section}</span>}
                  </Command.Item>
                ))}
              </Command.Group>
              {!!clients.data?.length && (
                <Command.Group heading="Clients" className={groupCls}>
                  {clients.data
                    .filter((c) => !c.archivedAt)
                    .map((c) => (
                      <Command.Item key={c.id} value={`client ${c.name} ${c.code}`} onSelect={() => go(`/app/clients/${c.id}`)} className={itemCls}>
                        <Building2 />
                        <span className="truncate">{c.name}</span>
                        <span className="ml-auto shrink-0 text-muted-foreground">{c.code}</span>
                      </Command.Item>
                    ))}
                </Command.Group>
              )}
              {!!videos.data?.length && (
                <Command.Group heading="Videos" className={groupCls}>
                  {videos.data.slice(0, 200).map((v) => (
                    <Command.Item key={v.id} value={`video ${v.code} ${v.title}`} onSelect={() => go(`/app/production/${v.id}`)} className={itemCls}>
                      <Film />
                      <span className="shrink-0 tabular-nums text-muted-foreground">{v.code}</span>
                      <span className="truncate">{v.title}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>
            <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-body text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CornerDownLeft className="size-4" /> to open
              </span>
              <span>↑ ↓ to move</span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

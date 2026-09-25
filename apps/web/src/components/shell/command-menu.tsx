"use client";

import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Building2, Film } from "lucide-react";
import { allNavItems } from "@/lib/nav";
import { clients } from "@/lib/mock/core";
import { useDemo } from "@/lib/store";

export function CommandMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const videos = useDemo((s) => s.videos);

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  const itemCls =
    "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-body data-[selected=true]:bg-muted [&_svg]:size-4 [&_svg]:text-muted-foreground";
  const groupCls =
    "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-body [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[14vh] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-popover shadow-pop"
        >
          <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>
          <Command loop>
            <Command.Input
              autoFocus
              placeholder="Jump to a module, client or video…"
              className="h-12 w-full border-b border-border bg-transparent px-4 text-body outline-none placeholder:text-muted-foreground"
            />
            <Command.List className="scrollbar-thin max-h-[420px] overflow-y-auto p-2">
              <Command.Empty className="py-10 text-center text-body text-muted-foreground">No results.</Command.Empty>
              <Command.Group heading="Modules" className={groupCls}>
                {allNavItems.map((i) => (
                  <Command.Item key={i.href} value={`${i.title} ${i.summary}`} onSelect={() => go(i.href)} className={itemCls}>
                    <i.icon />
                    <span>{i.title}</span>
                    <span className="ml-auto truncate text-body text-muted-foreground">{i.summary}</span>
                  </Command.Item>
                ))}
              </Command.Group>
              <Command.Group heading="Clients" className={groupCls}>
                {clients.map((c) => (
                  <Command.Item key={c.id} value={`client ${c.name} ${c.code}`} onSelect={() => go(`/agreements?client=${c.id}`)} className={itemCls}>
                    <Building2 />
                    <span>{c.name}</span>
                    <span className="ml-auto text-body text-muted-foreground">{c.industry}</span>
                  </Command.Item>
                ))}
              </Command.Group>
              <Command.Group heading="Videos" className={groupCls}>
                {videos.map((v) => (
                  <Command.Item key={v.id} value={`video ${v.code} ${v.title}`} onSelect={() => go(`/production/${v.id}`)} className={itemCls}>
                    <Film />
                    <span className="font-mono text-body text-muted-foreground">{v.code}</span>
                    <span className="truncate">{v.title}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

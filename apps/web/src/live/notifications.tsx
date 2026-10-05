"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { NOTIFICATION_KINDS, type NotificationKind, type NotificationList, type NotificationPreferences } from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, SectionCard } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { errorMessage } from "./api";
import { useMarkRead, useNotificationPreferences, useNotifications, useSaveNotificationPreferences } from "./queries";

/** "5 min ago", "3 h ago", "2 Oct" */
function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function Item({ n, onOpen }: { n: NotificationList["items"][number]; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn("flex w-full cursor-pointer gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted", !n.read && "bg-primary-soft/40")}
    >
      <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-primary")} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className={cn("block text-body", !n.read && "font-semibold")}>{n.title}</span>
        {n.body && <span className="block truncate text-body text-muted-foreground">{n.body}</span>}
        <span className="block text-body text-muted-foreground">{ago(n.createdAt)}</span>
      </span>
    </button>
  );
}

/** The bell in the top bar: unread count and the latest few. */
export function NotificationBell() {
  const router = useRouter();
  const list = useNotifications();
  const read = useMarkRead();
  const unread = list.data?.unread ?? 0;
  const open = (n: NotificationList["items"][number]) => {
    if (!n.read) read.mutate([n.id]);
    if (n.link) router.push(n.link);
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
          <Bell />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-danger ring-2 ring-background" aria-hidden />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 max-w-[90vw] p-1.5">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>
            Notifications
            {unread > 0 && <span className="ml-1.5 font-normal text-muted-foreground">{unread > 99 ? "99+" : unread} unread</span>}
          </span>
          {unread > 0 && (
            <button type="button" className="cursor-pointer text-body font-normal text-primary hover:underline" onClick={() => read.mutate(undefined)}>
              Mark all read
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-96 overflow-y-auto">
          {!list.data?.items.length ? (
            <p className="px-2.5 py-6 text-center text-body text-muted-foreground">Nothing yet.</p>
          ) : (
            list.data.items.slice(0, 8).map((n) => <Item key={n.id} n={n} onOpen={() => open(n)} />)
          )}
        </div>
        <DropdownMenuSeparator />
        <Link href="/app/notifications" className="block rounded-lg px-2.5 py-2 text-center text-body text-primary hover:bg-muted">
          See all and choose what you are told
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Preferences({ initial }: { initial: NotificationPreferences }) {
  const save = useSaveNotificationPreferences();
  const [p, setP] = useState(initial);
  const groups = [...new Set(NOTIFICATION_KINDS.map((k) => k.group))];
  const dirty = JSON.stringify(p) !== JSON.stringify(initial);
  const toggle = (k: NotificationKind, on: boolean) => setP({ ...p, muted: on ? p.muted.filter((m) => m !== k) : [...p.muted, k] });
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <SectionCard key={g} title={g}>
          <ul className="space-y-3">
            {NOTIFICATION_KINDS.filter((k) => k.group === g).map((k) => (
              <li key={k.key} className="flex items-center justify-between gap-4">
                <span className="text-body">{k.label}</span>
                <Switch checked={!p.muted.includes(k.key)} onCheckedChange={(on) => toggle(k.key, on)} aria-label={k.label} />
              </li>
            ))}
          </ul>
        </SectionCard>
      ))}
      <SectionCard title="Quiet hours" description="No email or phone alerts in these hours once those arrive; notifications here still collect.">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="From">
            <Input type="time" value={p.quietFrom ?? ""} onChange={(e) => setP({ ...p, quietFrom: e.target.value || null })} className="w-32" />
          </Field>
          <Field label="To">
            <Input type="time" value={p.quietTo ?? ""} onChange={(e) => setP({ ...p, quietTo: e.target.value || null })} className="w-32" />
          </Field>
        </div>
      </SectionCard>
      <div className="flex justify-end gap-2">
        {save.error && <span className="mr-auto text-body text-danger">{errorMessage(save.error)}</span>}
        <Button variant="secondary" disabled={!dirty} onClick={() => setP(initial)}>
          Undo changes
        </Button>
        <Button disabled={!dirty || save.isPending} onClick={() => save.mutate(p, { onSuccess: (v) => (setP(v), toast.success("Saved")) })}>
          Save
        </Button>
      </div>
    </div>
  );
}

export function LiveNotifications() {
  const router = useRouter();
  const list = useNotifications();
  const prefs = useNotificationPreferences();
  const read = useMarkRead();
  return (
    <>
      <PageHeader
        title="Notifications"
        description="What needs your attention — approvals, sign-offs, clients finishing onboarding, invoices to issue."
        actions={
          !!list.data?.unread && (
            <Button variant="secondary" onClick={() => read.mutate(undefined)}>
              <CheckCheck />
              Mark all read
            </Button>
          )
        }
      />
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="settings">
            <Settings2 className="size-3.5" />
            What I am told
          </TabsTrigger>
        </TabsList>
        <TabsContent value="all">
          <Card className="p-1.5">
            {list.isPending ? (
              <div className="p-3">
                <SkeletonRows rows={5} />
              </div>
            ) : list.error ? (
              <Alert tone="danger">{errorMessage(list.error)}</Alert>
            ) : !list.data.items.length ? (
              <EmptyState icon={Bell} title="Nothing yet" description="You will be told here when something needs you." />
            ) : (
              list.data.items.map((n) => (
                <Item
                  key={n.id}
                  n={n}
                  onOpen={() => {
                    if (!n.read) read.mutate([n.id]);
                    if (n.link) router.push(n.link);
                  }}
                />
              ))
            )}
          </Card>
        </TabsContent>
        <TabsContent value="settings">
          {prefs.isPending ? (
            <SkeletonRows rows={6} />
          ) : prefs.error ? (
            <Alert tone="danger">{errorMessage(prefs.error)}</Alert>
          ) : (
            <Preferences initial={prefs.data} />
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Building2,
  CalendarDays,
  Camera,
  Check,
  CreditCard,
  FileBarChart,
  Clapperboard,
  ChevronDown,
  ClipboardList,
  ListChecks,
  FileSpreadsheet,
  FileSignature,
  Filter,
  FlaskConical,
  History,
  Inbox,
  Home,
  Landmark,
  Lightbulb,
  ListOrdered,
  LogOut,
  Megaphone,
  MessageCircle,
  Menu,
  Moon,
  Package,
  Plus,
  Receipt,
  Repeat,
  ReceiptIndianRupee,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Timer,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import type { AreaKey } from "@gm/shared";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/feedback";
import { BrandMark, BrandWordmark } from "@/components/shell/brand";
import { cn } from "@/lib/utils";
import { errorMessage } from "./api";
import { NotificationBell } from "./notifications";
import { useCan, useMe, useSignOut, useSwitchAgency } from "./queries";

/** On the team (not a client's person, whose role reaches only the client portal). */
const isTeam = (p: Record<string, unknown>) => Object.keys(p).some((area) => area !== "portal");

interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Shown only to people whose role has at least this access (view unless said) to this area. */
  area?: AreaKey;
  level?: "view" | "edit";
}

const NAV: { title: string; items: NavItem[] }[] = [
  {
    title: "Workspace",
    items: [
      { title: "Home", href: "/app", icon: Home },
      { title: "Sales pipeline", href: "/app/sales", icon: Filter, area: "crm" },
      { title: "Clients", href: "/app/clients", icon: Building2, area: "clients" },
      { title: "Client requests", href: "/app/requests", icon: Inbox, area: "clients" },
      { title: "WhatsApp messages", href: "/app/messages", icon: MessageCircle, area: "clients" },
      { title: "Onboarding", href: "/app/onboarding", icon: ClipboardList, area: "onboarding" },
      { title: "Content", href: "/app/content", icon: Lightbulb, area: "content" },
      { title: "Production", href: "/app/production", icon: Clapperboard, area: "production" },
      { title: "Shoots", href: "/app/shoots", icon: Camera, area: "production" },
      { title: "Calendar", href: "/app/calendar", icon: CalendarDays, area: "production" },
      { title: "Publishing", href: "/app/publishing", icon: Megaphone, area: "publishing" },
      { title: "Monthly delivery", href: "/app/cycles", icon: Repeat, area: "production" },
      { title: "Monthly reports", href: "/app/reports", icon: FileBarChart, area: "reports" },
      { title: "Agreements", href: "/app/agreements", icon: FileSignature, area: "agreements" },
      { title: "Invoices", href: "/app/invoices", icon: ReceiptIndianRupee, area: "invoices" },
      { title: "Import from Excel", href: "/app/import", icon: FileSpreadsheet, area: "clients", level: "edit" },
    ],
  },
  {
    title: "Settings",
    items: [
      { title: "Agency profile", href: "/app/settings/agency", icon: Landmark, area: "settings" },
      { title: "Packages", href: "/app/settings/packages", icon: Package },
      { title: "Pipeline stages", href: "/app/settings/pipeline", icon: ListOrdered, area: "settings" },
      { title: "Invoice settings", href: "/app/settings/invoices", icon: Receipt, area: "invoices" },
      { title: "Onboarding questions", href: "/app/settings/onboarding", icon: ListChecks, area: "onboarding" },
      { title: "Production", href: "/app/settings/production", icon: SlidersHorizontal, area: "production" },
      { title: "Team", href: "/app/settings/team", icon: Users, area: "team" },
      { title: "Roles and permissions", href: "/app/settings/roles", icon: ShieldCheck, area: "team" },
      { title: "WhatsApp", href: "/app/settings/whatsapp", icon: MessageCircle, area: "settings" },
      { title: "Payments", href: "/app/settings/payments", icon: CreditCard, area: "settings" },
      { title: "Background jobs", href: "/app/settings/jobs", icon: Timer, area: "settings" },
      { title: "Audit log", href: "/app/audit", icon: History, area: "audit" },
    ],
  },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const can = useCan();
  return (
    <nav className="scrollbar-thin flex-1 space-y-5 overflow-y-auto px-3 pb-6 pt-2" aria-label="Main">
      {NAV.map((section) => {
        const items = section.items.filter((i) => !i.area || can(i.area, i.level ?? "view"));
        if (!items.length) return null;
        return (
          <div key={section.title}>
            <div className="mb-1.5 px-2.5 text-body font-medium text-sidebar-muted">{section.title}</div>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active = item.href === "/app" ? pathname === "/app" : pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-body transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
                        active ? "bg-sidebar-active font-medium text-white" : "text-sidebar-foreground hover:bg-sidebar-hover hover:text-white",
                      )}
                    >
                      {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-accent" aria-hidden />}
                      <Icon className={cn("size-4 shrink-0", active ? "text-accent" : "text-sidebar-muted group-hover:text-white")} />
                      <span className="truncate">{item.title}</span>
                    </Link>
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

function SidebarFooter() {
  return (
    <div className="border-t border-sidebar-border px-5 py-3">
      <Link href="/" className="flex items-center gap-2 text-body text-sidebar-muted hover:text-white">
        <FlaskConical className="size-4" />
        Open the clickable demo
      </Link>
    </div>
  );
}

function AgencySwitcher() {
  const router = useRouter();
  const me = useMe().data;
  const switchAgency = useSwitchAgency();
  if (!me) return null;
  const active = me.agencies.find((a) => a.id === me.activeAgencyId);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="min-w-0 max-w-[60vw] justify-start gap-2 px-2">
          {active?.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- the agency's logo, a small data URL
            <img src={active.logo} alt="" className="size-6 shrink-0 rounded object-contain" />
          ) : (
            <Building2 className="text-muted-foreground" />
          )}
          <span className="truncate font-semibold text-text-primary">{active?.name ?? "Choose an agency"}</span>
          <ChevronDown className="opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Your agencies</DropdownMenuLabel>
        {me.agencies.map((a) => (
          <DropdownMenuItem
            key={a.id}
            onSelect={() =>
              a.id !== me.activeAgencyId &&
              switchAgency.mutate(a.id, {
                onSuccess: () => {
                  toast.success(`Now working in ${a.name}`);
                  router.push("/app");
                },
                onError: (e) => toast.error(errorMessage(e)),
              })
            }
          >
            <span className="min-w-0 flex-1 truncate">{a.name}</span>
            {a.id === me.activeAgencyId && <Check className="size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/app/new-agency")}>
          <Plus className="size-4" />
          Create a new agency
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const router = useRouter();
  const me = useMe().data;
  const signOut = useSignOut();
  if (!me) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
          <Avatar name={me.user.name} size="sm" />
          <span className="hidden max-w-40 truncate text-body font-medium sm:inline">{me.user.name}</span>
          <ChevronDown className="size-4 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <div className="truncate text-text-primary">{me.user.name}</div>
          <div className="truncate font-normal text-muted-foreground">{me.user.email}</div>
          {me.role && (
            <Badge tone="accent" className="mt-1.5">
              {me.role.name}
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() =>
            signOut.mutate(undefined, {
              onSuccess: () => router.replace("/app/sign-in"),
              onError: (e) => toast.error(errorMessage(e)),
            })
          }
        >
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function toggleTheme() {
  const next = !document.documentElement.classList.contains("dark");
  document.documentElement.classList.toggle("dark", next);
  try {
    localStorage.setItem("gm-theme", next ? "dark" : "light");
  } catch {}
}

/**
 * The real app's frame. Signed out → sign-in; signed in without an agency → their first agency, or creating one.
 */
export function LiveShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: me, isPending, error } = useMe();
  const switchAgency = useSwitchAgency();
  const [mobileOpen, setMobileOpen] = useState(false);
  const opening = useRef(false);

  const needsAgency = !!me && !me.activeAgencyId;
  const { mutate: openAgency } = switchAgency;
  useEffect(() => {
    if (me === null) router.replace(`/app/sign-in?next=${encodeURIComponent(pathname)}`);
    else if (needsAgency && me.agencies.length === 0) router.replace("/app/new-agency");
    else if (needsAgency && me.agencies[0] && !opening.current) {
      // Signed in but no agency open yet: open their first one (once).
      opening.current = true;
      openAgency(me.agencies[0].id);
    }
  }, [me, needsAgency, pathname, router, openAgency]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-subheading font-semibold">The server is not answering</h1>
          <p className="mt-2 text-body text-muted-foreground">{errorMessage(error)}</p>
          <Button className="mt-4" onClick={() => router.refresh()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (isPending || !me || needsAgency) {
    return (
      <div className="space-y-4 p-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[256px] flex-col border-r border-sidebar-border bg-sidebar lg:flex print:hidden">
        <Link href="/app" className="flex h-16 shrink-0 items-center gap-3 px-5">
          <BrandMark />
          <BrandWordmark inverted sub="Agency workspace" />
        </Link>
        <NavList />
        <SidebarFooter />
      </aside>

      <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-primary/40 backdrop-blur-[1.5px] lg:hidden" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col bg-sidebar shadow-lg focus:outline-none lg:hidden"
          >
            <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
            <div className="flex h-16 shrink-0 items-center justify-between px-5">
              <Link href="/app" onClick={() => setMobileOpen(false)} className="flex items-center gap-3">
                <BrandMark />
                <BrandWordmark inverted sub="Agency workspace" />
              </Link>
              <DialogPrimitive.Close
                aria-label="Close navigation"
                className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-sidebar-muted hover:bg-sidebar-hover hover:text-white"
              >
                <X className="size-4" />
              </DialogPrimitive.Close>
            </div>
            <NavList onNavigate={() => setMobileOpen(false)} />
            <SidebarFooter />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <div className="lg:pl-[256px] print:pl-0">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border bg-background/90 px-4 backdrop-blur-md lg:px-8 print:hidden">
          <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu />
          </Button>
          <AgencySwitcher />
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {me.permissions && isTeam(me.permissions) && <NotificationBell />}
            <Button variant="ghost" size="icon-sm" onClick={toggleTheme} aria-label="Toggle dark mode">
              <Sun className="hidden dark:block" />
              <Moon className="dark:hidden" />
            </Button>
            <UserMenu />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:max-w-none print:p-0">{children}</main>
      </div>
    </div>
  );
}

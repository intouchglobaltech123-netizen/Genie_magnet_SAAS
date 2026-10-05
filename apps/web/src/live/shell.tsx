"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Building,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  HelpCircle,
  KeyRound,
  LogOut,
  Menu,
  Moon,
  Plus,
  Sun,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { brandPalette } from "@gm/shared";
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
import { Alert, Skeleton } from "@/components/ui/feedback";
import { BrandMark, BrandWordmark } from "@/components/shell/brand";
import { cn, fmtDate } from "@/lib/utils";
import { errorMessage } from "./api";
import { helpFor } from "./help-articles";
import { HELP, inSettings, isActive, NAV_GROUPS, NAV_TOP, type NavItem, pageFor, SETTINGS, useNavVisible } from "./nav";
import { NotificationBell } from "./notifications";
import { istDay } from "./plan";
import { useMe, useSignOut, useSupportVisit, useSwitchAgency } from "./queries";
import { SearchButton } from "./search";

/** On the team (not a client's person, whose role reaches only the client portal). */
const isTeam = (p: Record<string, unknown>) => Object.keys(p).some((area) => area !== "portal");

const OPEN_KEY = "gm-nav-open";

function NavLink({ item, active, onNavigate, nested }: { item: NavItem; active: boolean; onNavigate?: () => void; nested?: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-9 items-center gap-2.5 rounded-lg pr-2.5 text-body transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
        nested ? "pl-9" : "pl-2.5",
        active ? "bg-sidebar-active font-medium text-white" : "text-sidebar-foreground hover:bg-sidebar-hover hover:text-white",
      )}
    >
      {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-accent" aria-hidden />}
      {!nested && <Icon className={cn("size-4 shrink-0", active ? "text-accent" : "text-sidebar-muted group-hover:text-white")} />}
      <span className="truncate">{item.title}</span>
    </Link>
  );
}

/** The side menu: Home and Genie on top, then sections that fold open (the one you are in opens by itself). */
function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const visible = useNavVisible();
  const groups = NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter(visible) })).filter((g) => g.items.length);
  const current = groups.find((g) => g.items.some((i) => isActive(pathname, i.href)))?.key;
  const [open, setOpen] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(OPEN_KEY) ?? "null") as string[] | null;
      if (saved) return saved;
    } catch {}
    return [];
  });
  const shown = current && !open.includes(current) ? [...open, current] : open;
  const toggle = (key: string) => {
    const next = shown.includes(key) ? shown.filter((k) => k !== key) : [...shown, key];
    setOpen(next);
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify(next));
    } catch {}
  };
  return (
    <nav className="scrollbar-sidebar flex-1 overflow-y-auto px-3 pb-4 pt-1" aria-label="Main">
      <ul className="space-y-0.5">
        {NAV_TOP.filter(visible).map((item) => (
          <li key={item.href}>
            <NavLink item={item} active={isActive(pathname, item.href)} onNavigate={onNavigate} />
          </li>
        ))}
      </ul>
      <div className="mt-4 space-y-0.5">
        {groups.map((g) => {
          const expanded = shown.includes(g.key);
          const here = g.key === current;
          const Icon = g.icon;
          return (
            <div key={g.key}>
              <button
                type="button"
                onClick={() => toggle(g.key)}
                aria-expanded={expanded}
                className={cn(
                  "group flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-body transition-colors hover:bg-sidebar-hover hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
                  here ? "font-medium text-white" : "text-sidebar-foreground",
                )}
              >
                <Icon className={cn("size-4 shrink-0", here ? "text-accent" : "text-sidebar-muted group-hover:text-white")} />
                <span className="truncate">{g.title}</span>
                <ChevronRight className={cn("ml-auto size-4 shrink-0 text-sidebar-muted transition-transform duration-200", expanded && "rotate-90")} />
              </button>
              {expanded && (
                <ul className="relative mb-1 mt-0.5 space-y-0.5 before:absolute before:inset-y-1 before:left-[17px] before:w-px before:bg-sidebar-border">
                  {g.items.map((item) => (
                    <li key={item.href}>
                      <NavLink item={item} nested active={isActive(pathname, item.href)} onNavigate={onNavigate} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

/** Settings and help, always at the foot of the side menu. */
function SidebarFooter({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-0.5 border-t border-sidebar-border px-3 py-3">
      <li>
        <NavLink item={SETTINGS} active={inSettings(pathname)} onNavigate={onNavigate} />
      </li>
      <li>
        <NavLink item={HELP} active={isActive(pathname, HELP.href) || isActive(pathname, "/app/support")} onNavigate={onNavigate} />
      </li>
    </ul>
  );
}

/** Where you are, after the agency's name: section › page (› details on a record's own page). */
function Trail() {
  const pathname = usePathname();
  const page = pageFor(pathname);
  if (!page || page.item.href === "/app") return null;
  const deeper = pathname !== page.item.href;
  return (
    <nav aria-label="You are here" className="hidden min-w-0 items-center gap-1.5 text-body text-muted-foreground lg:flex">
      <span className="text-border-strong" aria-hidden>
        /
      </span>
      {page.section && (
        <>
          <span className="truncate">{page.section}</span>
          <ChevronRight className="size-3.5 shrink-0 opacity-60" aria-hidden />
        </>
      )}
      {deeper ? (
        <>
          <Link href={page.item.href} className="truncate hover:text-primary">
            {page.item.title}
          </Link>
          <ChevronRight className="size-3.5 shrink-0 opacity-60" aria-hidden />
          <span className="truncate font-medium text-text-primary" aria-current="page">
            Details
          </span>
        </>
      ) : (
        <span className="truncate font-medium text-text-primary" aria-current="page">
          {page.item.title}
        </span>
      )}
    </nav>
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
        <Button variant="ghost" className="min-w-0 max-w-[45vw] shrink justify-start gap-2 px-2 md:max-w-64">
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
        {me.platformAdmin && (
          <DropdownMenuItem onSelect={() => router.push("/app/platform")}>
            <Building className="size-4" />
            Platform console
          </DropdownMenuItem>
        )}
        {!me.support && (
          <DropdownMenuItem onSelect={() => router.push("/app/account")}>
            <KeyRound className="size-4" />
            Change password
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => router.push("/")}>
          <FlaskConical className="size-4" />
          Open the clickable demo
        </DropdownMenuItem>
        <DropdownMenuItem className="sm:hidden" onSelect={toggleTheme}>
          <Moon className="size-4 dark:hidden" />
          <Sun className="hidden size-4 dark:block" />
          <span className="dark:hidden">Dark mode</span>
          <span className="hidden dark:inline">Light mode</span>
        </DropdownMenuItem>
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

/** The platform's announcements for this agency today (P6-09); each can be put away, in this browser. */
function Announcements() {
  const list = useMe().data?.announcements ?? [];
  const [hidden, setHidden] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("gm-announcements-hidden") ?? "[]") as string[];
    } catch {
      return [];
    }
  });
  const shown = list.filter((a) => !hidden.includes(a.id));
  if (!shown.length) return null;
  const hide = (id: string) => {
    const next = [...hidden, id];
    setHidden(next);
    try {
      localStorage.setItem("gm-announcements-hidden", JSON.stringify(next.slice(-50)));
    } catch {}
  };
  return (
    <div className="mb-5 space-y-2 print:hidden">
      {shown.map((a) => (
        <Alert key={a.id} tone={a.tone} title={a.title}>
          <div className="flex items-start justify-between gap-3">
            <span className="whitespace-pre-line">{a.body}</span>
            <Button size="xs" variant="ghost" aria-label="Put away" onClick={() => hide(a.id)}>
              <X />
            </Button>
          </div>
        </Alert>
      ))}
    </div>
  );
}

/** While the platform's support team is in an agency on its consent (P6-08): whose, how far, until when, and a way out. */
function SupportBanner() {
  const support = useMe().data?.support;
  const visit = useSupportVisit();
  if (!support) return null;
  return (
    <Alert tone="warning" className="mb-5 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>
          You are in {support.agencyName} as platform support ({support.level === "edit" ? "see and fix" : "see only"}) until{" "}
          {new Date(support.until).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}. Everything you do is in their audit log.
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={visit.isPending}
          onClick={() => visit.mutate({ step: "leave" }, { onError: (e) => toast.error(errorMessage(e)) })}
        >
          Leave
        </Button>
      </div>
    </Alert>
  );
}

/** Help in the top bar (P6-15): the guide for this page, the help centre, and writing to support from here. */
function HelpMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const guide = helpFor(pathname);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Help">
          <HelpCircle />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {guide && (
          <>
            <DropdownMenuLabel>On this page</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => router.push(`/app/help/${guide.slug}`)}>{guide.title}</DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onSelect={() => router.push("/app/help")}>All guides</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push(`/app/support?page=${encodeURIComponent(pathname)}`)}>Write to support</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The agency's colour across its team's app, when it chose so (P6-07): light and dark sets of the colour tokens. */
function BrandStyle() {
  const b = useMe().data?.branding;
  if (!b?.inApp || !b.color) return null;
  const p = brandPalette(b.color);
  const vars = (set: Record<string, string>) =>
    Object.entries(set)
      .map(([k, v]) => `${k}:${v};`)
      .join("");
  return <style>{`html:not(.dark){${vars(p.light)}}html.dark{${vars(p.dark)}}`}</style>;
}

/** The top of the side menu: the agency's logo and name when it brands the app, the platform's otherwise. */
function SidebarBrand() {
  const b = useMe().data?.branding;
  if (!b?.inApp)
    return (
      <>
        <BrandMark />
        <BrandWordmark inverted sub="Agency workspace" />
      </>
    );
  return (
    <>
      {b.logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- the agency's logo, a small data URL
        <img src={b.logo} alt="" className="size-8 shrink-0 rounded-lg bg-white object-contain p-0.5" />
      ) : (
        <span
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-subheading font-semibold text-primary-foreground"
          aria-hidden
        >
          {b.name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <div className="min-w-0 leading-tight">
        <div className="truncate text-subheading font-semibold tracking-tight text-white">{b.name}</div>
        <div className="truncate text-body text-sidebar-muted">Agency workspace</div>
      </div>
    </>
  );
}

/** The workspace is to be deleted (P6-10): when, and where the owner can stop it. */
function DeletionBanner() {
  const deletion = useMe().data?.deletion;
  if (!deletion) return null;
  return (
    <Alert tone="danger" className="mb-5 print:hidden">
      This workspace will be deleted on {fmtDate(istDay(deletion.deleteAfter), { day: "numeric", month: "long", year: "numeric" })}, with everything in it.
      Export what you need, or stop it, in{" "}
      <Link href="/app/settings/data" className="font-medium underline underline-offset-2">
        Settings → Your data
      </Link>
      .
    </Alert>
  );
}

/** The plan's state above every page (ADR 0011): read-only and why, a payment due, or the trial's days left. */
function PlanBanner() {
  const plan = useMe().data?.entitlements;
  const pathname = usePathname();
  const [today] = useState(() => Date.now());
  if (!plan?.status || pathname.startsWith("/app/settings/plan")) return null;
  const link = (
    <Link href="/app/settings/plan" className="font-medium underline underline-offset-2">
      Settings → Plan
    </Link>
  );
  if (plan.readOnly)
    return (
      <Alert tone="danger" className="mb-5 print:hidden">
        {plan.readOnlyReason?.replace("Settings → Plan", "") ?? "This workspace is read-only."} {link}
      </Alert>
    );
  if (plan.status === "past_due")
    return (
      <Alert tone="warning" className="mb-5 print:hidden">
        A payment is due. Pay it in {link} to keep working without a break.
      </Alert>
    );
  if (plan.status === "trialing" && plan.trialEndsAt) {
    const left = Math.max(0, Math.ceil((new Date(plan.trialEndsAt).getTime() - today) / 86_400_000));
    if (left > 7) return null;
    return (
      <Alert tone="info" className="mb-5 print:hidden">
        {left === 0 ? "The trial ends today" : `${left} ${left === 1 ? "day" : "days"} left in the trial`} of {plan.plan?.name}. Choose a plan in {link}.
      </Alert>
    );
  }
  return null;
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
    // The frame's own shape while the session loads, so the page does not jump when it arrives.
    return (
      <div className="min-h-screen bg-background" aria-busy="true">
        <div className="fixed inset-y-0 left-0 hidden w-[248px] border-r border-sidebar-border bg-sidebar lg:block" />
        <div className="lg:pl-[248px]">
          <div className="h-14 border-b border-border" />
          <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
            <Skeleton className="h-8 w-72" />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28 rounded-2xl" />
              ))}
            </div>
            <Skeleton className="h-72 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <BrandStyle />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-sidebar-border bg-sidebar lg:flex print:hidden">
        <Link href="/app" className="flex h-14 shrink-0 items-center gap-3 px-5">
          <SidebarBrand />
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
            <div className="flex h-14 shrink-0 items-center justify-between px-5">
              <Link href="/app" onClick={() => setMobileOpen(false)} className="flex min-w-0 items-center gap-3">
                <SidebarBrand />
              </Link>
              <DialogPrimitive.Close
                aria-label="Close navigation"
                className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-sidebar-muted hover:bg-sidebar-hover hover:text-white"
              >
                <X className="size-4" />
              </DialogPrimitive.Close>
            </div>
            <NavList onNavigate={() => setMobileOpen(false)} />
            <SidebarFooter onNavigate={() => setMobileOpen(false)} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <div className="lg:pl-[248px] print:pl-0">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6 lg:px-8 print:hidden">
          <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu />
          </Button>
          <AgencySwitcher />
          <Trail />
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {me.permissions && isTeam(me.permissions) && <SearchButton className="mr-2 w-9 justify-center px-0 sm:w-64 sm:justify-start sm:px-3 xl:w-80" />}
            {me.permissions && isTeam(me.permissions) && <NotificationBell />}
            {me.permissions && isTeam(me.permissions) && <HelpMenu />}
            <Button variant="ghost" size="icon-sm" className="hidden sm:inline-flex" onClick={toggleTheme} aria-label="Toggle dark mode">
              <Sun className="hidden dark:block" />
              <Moon className="dark:hidden" />
            </Button>
            <UserMenu />
          </div>
        </header>
        <main className="w-full px-4 py-6 sm:px-6 lg:px-8 lg:py-7 2xl:px-10 print:p-0">
          <SupportBanner />
          <DeletionBanner />
          <PlanBanner />
          <Announcements />
          {children}
        </main>
      </div>
    </div>
  );
}

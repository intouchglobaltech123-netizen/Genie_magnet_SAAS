"use client";

import { toast } from "sonner";
import { Check, FileText, Megaphone, Target, ListTodo, Gem, Radar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, fmtDate } from "@/lib/utils";
import { sourcingChannels, type RoleDoc } from "./data";

const competenceTone: Record<string, string> = {
  Skills: "bg-accent-soft text-accent",
  Knowledge: "bg-info-soft text-info",
  "Self Image": "bg-gold-soft text-gold",
  Motives: "bg-success-soft text-success",
  Traits: "bg-warning-soft text-warning",
};

export function RoleDocPanel({
  role,
  sourcing,
  onToggleSource,
}: {
  role: RoleDoc;
  sourcing: string[];
  onToggleSource: (s: string) => void;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader className="border-b border-border pb-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <FileText className="size-5" />
            </span>
            <div>
              <div className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground">Role Task Document</div>
              <CardTitle className="text-[18px]">{role.name}</CardTitle>
              <CardDescription>
                {role.department} · Hiring manager {role.hiringManager} · Posted {fmtDate(role.postedOn)}
              </CardDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toast.success("RTD exported", { description: `RTD-${role.name.replace(/\s/g, "-")}-v2.pdf ready to share with consultants.` })}
          >
            Export PDF
          </Button>
        </CardHeader>
        <CardContent className="space-y-6 pt-5">
          <Section icon={Target} title="Role definition">
            <p className="rounded-xl bg-muted/60 px-4 py-3 text-[14px] font-medium">“{role.definition}”</p>
          </Section>
          <div className="grid gap-6 md:grid-cols-2">
            <Section icon={Check} title="Key responsibilities / deliverables">
              <ul className="space-y-2">
                {role.deliverables.map((d, i) => (
                  <li key={d} className="flex gap-2.5 text-[13px]">
                    <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-md bg-success-soft text-[11px] font-semibold text-success tabular">
                      {i + 1}
                    </span>
                    {d}
                  </li>
                ))}
              </ul>
            </Section>
            <Section icon={ListTodo} title="Tasks & activities">
              <ul className="space-y-2">
                {role.tasks.map((t) => (
                  <li key={t} className="flex gap-2.5 text-[13px]">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
                    {t}
                  </li>
                ))}
              </ul>
            </Section>
          </div>
          <Section icon={Gem} title="Competence attributes">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {Object.entries(role.competence).map(([k, items]) => (
                <div key={k} className="rounded-xl border border-border p-3">
                  <span className={cn("inline-block rounded-md px-2 py-0.5 text-[11.5px] font-semibold", competenceTone[k])}>{k}</span>
                  <ul className="mt-2 space-y-1.5">
                    {items.map((x) => (
                      <li key={x} className="text-[12.5px] leading-snug text-muted-foreground">
                        {x}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Section>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Radar className="size-4 text-muted-foreground" /> Sourcing strategy
              </CardTitle>
              <CardDescription>Toggle the channels active for this role.</CardDescription>
            </div>
            <Badge tone="accent" className="tabular">
              {sourcing.length}/{sourcingChannels.length}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {sourcingChannels.map((s) => {
                const on = sourcing.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onToggleSource(s)}
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition",
                      on ? "border-accent/40 bg-accent-soft text-accent" : "border-border bg-card text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {on && <Check className="size-3.5" />}
                    {s}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Position</CardTitle>
              <CardDescription>Budget & approvals</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5 text-[13px]">
            <Row label="Openings">{role.openings}</Row>
            <Row label="Salary band">{role.budget}</Row>
            <Row label="Approver">Janarthanan (Founder)</Row>
            <Row label="Probation">6 months</Row>
            <Button
              variant="soft"
              size="sm"
              className="mt-2 w-full"
              onClick={() =>
                toast.success("Job post published", {
                  description: `${role.name} posted to ${sourcing.length} channel${sourcing.length === 1 ? "" : "s"}. Applicants will land in “Lead”.`,
                })
              }
            >
              <Megaphone /> Publish job post
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof Target; title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2.5 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3.5" /> {title}
      </div>
      {children}
    </section>
  );
}

"use client";

import { Bell, ChevronRight, Flag, Layers, Timer } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { Select } from "@/components/ui/select";
import { withOverrides, REMINDER_DAYS } from "./engine";
import { useOnboarding } from "./store";
import { agencyTemplate, clientTemplate, type QType, type QuestionnaireTemplate, type SectionWhen } from "./templates";

const TYPE_LABEL: Record<QType, string> = {
  text: "Short text",
  long: "Long text",
  number: "Number",
  currency: "Amount (₹)",
  choice: "Single choice",
  multi: "Multiple choice",
  yesno: "Yes / no",
  rating: "Rating 1–10",
  table: "Table",
  file: "File upload",
};

export function TemplatesView() {
  const windowDays = useOnboarding((s) => s.windowDays);
  const setWindowDays = useOnboarding((s) => s.setWindowDays);
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-body font-semibold">
              <Timer className="size-4 text-primary" /> Deeper questions window
            </div>
            <Select
              aria-label="Days to complete the deeper sections"
              value={String(windowDays)}
              onValueChange={(v) => {
                setWindowDays(Number(v));
                toast.success(`Window set to ${v} days`, { description: "Applies to open questionnaires and new ones." });
              }}
              options={[5, 7, 10, 14].map((d) => ({ value: String(d), label: `Complete within ${d} days` }))}
              className="max-w-64"
            />
          </div>
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-body font-semibold">
              <Bell className="size-4 text-primary" /> Reminders by Genie Assistant
            </div>
            <p className="text-body text-muted-foreground">
              Day {REMINDER_DAYS.join(" and day ")} · WhatsApp and in-app, with a link that opens at the next unanswered question.
            </p>
          </div>
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-body font-semibold">
              <Flag className="size-4 text-primary" /> After the window
            </div>
            <p className="text-body text-muted-foreground">Flagged to the account manager (client) or the owner (agency). Nothing is locked — work never stops.</p>
          </div>
        </div>
      </Card>
      <Alert tone="info" icon={Layers} title="Templates are versioned">
        Genie Magnet&apos;s Growth OS set is the default. Changing a section here creates a new draft version; answers already given keep the version they were answered on. In the SaaS, each agency
        can add, remove and reorder questions.
      </Alert>
      <TemplateCard template={clientTemplate} />
      <TemplateCard template={agencyTemplate} />
    </div>
  );
}

function TemplateCard({ template: base }: { template: QuestionnaireTemplate }) {
  const overrides = useOnboarding((s) => s.whenOverrides);
  const setWhen = useOnboarding((s) => s.setWhen);
  const windowDays = useOnboarding((s) => s.windowDays);
  const t = withOverrides(base, overrides);
  const count = (w: SectionWhen) => t.sections.filter((s) => s.when === w).reduce((n, s) => n + s.questions.length, 0);
  const edited = t.sections.some((s, i) => s.when !== base.sections[i]!.when);

  return (
    <Card>
      <CardHeader className="flex-wrap">
        <div className="min-w-0">
          <CardTitle className="flex flex-wrap items-center gap-2">
            {t.name}
            <Badge tone="outline">{edited ? `${t.version} → v1.1 draft` : t.version}</Badge>
          </CardTitle>
          <CardDescription>{t.audience}</CardDescription>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="danger">{count("required")} required questions</Badge>
          <Badge tone="info">
            {count("7days")} within {windowDays} days
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {t.sections.map((s) => (
          <details key={s.id} className="group rounded-xl border border-border bg-surface open:bg-surface-secondary/60">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 [&::-webkit-details-marker]:hidden">
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition group-open:rotate-90" />
              <div className="min-w-0 flex-1">
                <div className="text-body font-semibold">{s.title}</div>
                <div className="text-body text-muted-foreground">
                  {s.questions.length} questions · builds {s.builds}
                </div>
              </div>
              <div onClick={(e) => e.preventDefault()} className="w-full sm:w-52">
                <Select
                  aria-label={`When ${s.title} must be answered`}
                  value={s.when}
                  onValueChange={(v) => {
                    setWhen(t.id, s.id, v as SectionWhen);
                    toast.success(`${s.title}: ${v === "required" ? "required to start" : `within ${windowDays} days`}`, { description: `Saved to ${t.name} v1.1 draft.` });
                  }}
                  options={[
                    { value: "required", label: "Required to start" },
                    { value: "7days", label: `Within ${windowDays} days` },
                  ]}
                />
              </div>
            </summary>
            <ol className="space-y-2 border-t border-border-subtle p-3 pl-10">
              {s.questions.map((q, i) => (
                <li key={q.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-body">
                  <span className="tabular text-muted-foreground">{i + 1}.</span>
                  <span className="min-w-0 flex-1">{q.label}</span>
                  <Badge tone="neutral">{TYPE_LABEL[q.type]}</Badge>
                  {q.showIf && <Badge tone="outline">Only if {q.showIf.includes}</Badge>}
                  <span className="w-full pl-5 text-muted-foreground sm:w-auto sm:pl-0">→ {q.maps}</span>
                </li>
              ))}
            </ol>
          </details>
        ))}
      </CardContent>
    </Card>
  );
}

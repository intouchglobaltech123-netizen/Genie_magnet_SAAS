"use client";

import { Check, Lock, PenLine, RotateCcw, Send, ShieldCheck, Undo2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { personById } from "@/lib/mock/core";
import { useDemo } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useDaily } from "../daily-store";
import { GM_NAME, HR_NAME, type SheetTemplate } from "./config";
import type { Issue } from "./compute";
import type { DaySheet } from "./seed";
import { stampLabel } from "./time";

export function SignoffRail({
  personId,
  date,
  sheet,
  template,
  issues,
  onShowIssues,
}: {
  personId: string;
  date: string;
  sheet: DaySheet | undefined;
  template: SheetTemplate;
  issues: Issue[];
  onShowIssues: () => void;
}) {
  const { submit, signGm, signHr, reopen, setField } = useDaily();
  const log = useDemo((s) => s.log);
  const person = personById(personId);
  const first = person.name.split(" ")[0];
  const d = new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  const submitted = !!sheet?.submittedAt;
  const gm = !!sheet?.gmSignedAt;
  const hr = !!sheet?.hrSignedAt;

  const steps = [
    {
      key: "emp",
      role: template.employeeSignLabel,
      name: person.name,
      at: sheet?.submittedAt,
      done: submitted,
      active: !submitted,
      action: (
        <Button
          size="sm"
          variant="accent"
          className="w-full"
          onClick={() => {
            if (issues.length) {
              onShowIssues();
              toast.error(`Fix ${issues.length} item${issues.length > 1 ? "s" : ""} before submitting`, { description: issues[0]?.text });
              return;
            }
            submit(personId, date);
            log(`${person.name} submitted the ${template.short} data sheet for ${d}`, "accent");
            toast.success("Data sheet submitted", { description: `Sent to ${GM_NAME} for GM sign-off` });
          }}
        >
          <Send /> Submit sheet
        </Button>
      ),
    },
    {
      key: "gm",
      role: "GM",
      name: GM_NAME,
      at: sheet?.gmSignedAt,
      done: gm,
      active: submitted && !gm,
      action: (
        <div className="space-y-2">
          <input
            className="h-8 w-full rounded-md border border-input bg-card px-2.5 text-body placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            placeholder="GM remark (optional)"
            value={sheet?.gmNote ?? ""}
            onChange={(e) => setField(personId, date, { gmNote: e.target.value })}
          />
          <Button
            size="sm"
            className="w-full"
            onClick={() => {
              signGm(personId, date);
              log(`${GM_NAME} signed ${first}'s data sheet (${d})`, "success");
              toast.success(`Signed by ${GM_NAME} (GM)`, { description: "Forwarded to HR for final sign-off" });
            }}
          >
            <PenLine /> Sign as GM
          </Button>
        </div>
      ),
    },
    {
      key: "hr",
      role: "HR",
      name: HR_NAME,
      at: sheet?.hrSignedAt,
      done: hr,
      active: gm && !hr,
      action: (
        <Button
          size="sm"
          variant="success"
          className="w-full"
          onClick={() => {
            signHr(personId, date);
            log(`${HR_NAME} (HR) signed & locked ${first}'s data sheet (${d})`, "success");
            toast.success("Sheet locked & filed", { description: `Filed to ${person.name}'s employee record · feeds attendance, time & KRA` });
          }}
        >
          <ShieldCheck /> Sign as HR & lock
        </Button>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Sign-off</CardTitle>
          <CardDescription>Replaces wet signatures on the paper form</CardDescription>
        </div>
        {hr ? (
          <Badge tone="success">
            <Lock /> Locked
          </Badge>
        ) : submitted ? (
          <Badge tone="warning" dot>
            In review
          </Badge>
        ) : (
          <Badge tone="neutral" dot>
            Draft
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        <ol className="relative">
          {steps.map((s, i) => (
            <li key={s.key} className="relative flex gap-3 pb-5 last:pb-0">
              {i < steps.length - 1 && (
                <span className={cn("absolute left-[13px] top-7 bottom-0 w-px", s.done ? "bg-success/50" : "bg-border")} />
              )}
              <motion.span
                initial={false}
                animate={{ scale: s.done ? [1.25, 1] : 1 }}
                className={cn(
                  "relative z-10 inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-body font-semibold",
                  s.done
                    ? "border-success bg-success text-white"
                    : s.active
                      ? "border-primary bg-primary-soft text-primary ring-4 ring-primary/10"
                      : "border-border bg-muted text-muted-foreground",
                )}
              >
                {s.done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </motion.span>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-body font-semibold">{s.role}</span>
                  <span className="truncate text-body text-muted-foreground">{s.name}</span>
                </div>
                {s.done ? (
                  <div className="mt-1.5 rounded-lg border border-dashed border-success/40 bg-success-soft/40 px-3 py-2">
                    <div className="font-serif text-subheading italic leading-tight text-foreground/90">{s.name}</div>
                    <div className="mt-0.5 text-body text-muted-foreground tabular">Signed digitally · {stampLabel(s.at)}</div>
                    {s.key === "gm" && sheet?.gmNote && <div className="mt-1 text-body text-muted-foreground">“{sheet.gmNote}”</div>}
                  </div>
                ) : s.active ? (
                  <div className="mt-2">{s.action}</div>
                ) : (
                  <div className="mt-1 text-body text-muted-foreground">Waiting for previous step</div>
                )}
              </div>
            </li>
          ))}
        </ol>

        {submitted && !gm && (
          <Button
            size="xs"
            variant="ghost"
            className="mt-3 w-full text-muted-foreground"
            onClick={() => {
              reopen(personId, date);
              toast("Submission recalled — sheet is editable again");
            }}
          >
            <Undo2 /> Recall submission
          </Button>
        )}
        {hr && (
          <div className="mt-4 flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-body text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Lock className="size-3.5" /> Locked after HR sign-off
            </span>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => {
                reopen(personId, date);
                log(`${HR_NAME} reopened ${first}'s data sheet (${d}) for correction`, "warning");
                toast.warning("Sheet reopened for correction", { description: "Audit trail keeps the previous signatures" });
              }}
            >
              <RotateCcw /> Reopen (HR)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

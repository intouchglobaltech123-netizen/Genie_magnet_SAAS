"use client";

import { useState } from "react";
import { Plus, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_PRODUCTION_SETTINGS, formatVideoCode, type ProductionSettings, productionSettingsInput } from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/card";
import { Alert, SkeletonRows } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/input";
import { ApiError, errorMessage } from "./api";
import { useCan, useProductionSettings, useSaveProductionSettings } from "./queries";

const lines = (s: string) =>
  s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
const keyOf = (label: string, taken: string[]) => {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 30) || "item";
  let k = base;
  for (let i = 2; taken.includes(k); i++) k = `${base}_${i}`;
  return k;
};

function Form({ initial, canEdit }: { initial: ProductionSettings; canEdit: boolean }) {
  const save = useSaveProductionSettings();
  const [f, setF] = useState(initial);
  const [steps, setSteps] = useState(initial.editSteps.join("\n"));
  const [pre, setPre] = useState(initial.preShoot.join("\n"));
  const [kitText, setKitText] = useState(() => Object.fromEntries(initial.kits.map((k) => [k.key, k.items.join("\n")])));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const month = new Date().toISOString().slice(0, 7);
  const preview = (() => {
    try {
      return formatVideoCode(f.videoCodeFormat, "KVR", month, 5);
    } catch {
      return "";
    }
  })();
  const value = (): ProductionSettings => ({
    ...f,
    editSteps: lines(steps),
    preShoot: lines(pre),
    kits: f.kits.map((k) => ({ ...k, items: lines(kitText[k.key] ?? "") })),
  });
  const submit = () => {
    const parsed = productionSettingsInput.safeParse(value());
    if (!parsed.success) return setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])));
    setErrors({});
    save.mutate(parsed.data, {
      onSuccess: () => toast.success("Production settings saved", { description: "New checklists apply from now; ticks already made stay." }),
      onError: (e) =>
        e instanceof ApiError && e.body.issues ? setErrors(Object.fromEntries(e.body.issues.map((i) => [i.path, i.message]))) : toast.error(errorMessage(e)),
    });
  };
  const err = (prefix: string) => Object.entries(errors).find(([k]) => k.startsWith(prefix))?.[1];

  return (
    <div className="space-y-4">
      <fieldset disabled={!canEdit} className="space-y-4">
        <SectionCard title="Video codes" description="{CLIENT} the client's code, {MM} {YY} {YYYY} the month it is due, {00} the running number.">
          <Field label="Code format" error={errors.videoCodeFormat} hint={preview ? `The 5th video for KVR this month: ${preview}` : undefined}>
            <Input className="max-w-xs tabular-nums" value={f.videoCodeFormat} onChange={(e) => setF({ ...f, videoCodeFormat: e.target.value })} />
          </Field>
        </SectionCard>

        <SectionCard title="Formats" description="The kinds of video you make, and the editing time planned for each — more than that needs a reason.">
          <ul className="space-y-2">
            {f.formats.map((x, i) => (
              <li key={i} className="grid grid-cols-[1fr_140px_32px] gap-2">
                <Input
                  aria-label="Format name"
                  value={x.name}
                  onChange={(e) => setF({ ...f, formats: f.formats.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)) })}
                />
                <div className="flex items-center gap-1">
                  <Input
                    aria-label="Planned hours"
                    type="number"
                    min={0}
                    step={0.5}
                    value={x.minutes / 60}
                    onChange={(e) =>
                      setF({ ...f, formats: f.formats.map((y, j) => (j === i ? { ...y, minutes: Math.round(Number(e.target.value) * 60) } : y)) })
                    }
                  />
                  <span className="text-body text-muted-foreground">h</span>
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Remove"
                  disabled={f.formats.length === 1}
                  onClick={() => setF({ ...f, formats: f.formats.filter((_, j) => j !== i) })}
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
          {err("formats") && <p className="mt-1 text-body text-danger">{err("formats")}</p>}
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setF({ ...f, formats: [...f.formats, { name: "", minutes: 300 }] })}>
            <Plus />
            Add a format
          </Button>
        </SectionCard>

        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard title="Edit steps" description="One per line, in order. All are needed before the quality check.">
            <Textarea rows={10} value={steps} onChange={(e) => setSteps(e.target.value)} aria-label="Edit steps" />
            {err("editSteps") && <p className="mt-1 text-body text-danger">{err("editSteps")}</p>}
          </SectionCard>
          <SectionCard title="Before a shoot" description="One per line.">
            <Textarea rows={10} value={pre} onChange={(e) => setPre(e.target.value)} aria-label="Before a shoot" />
          </SectionCard>
        </div>

        <SectionCard
          title="Quality checks"
          description="Each is passed or failed by someone who may approve production; a failed check goes back to the editor."
        >
          <ul className="space-y-2">
            {f.qcChecks.map((c, i) => (
              <li key={c.key} className="grid gap-2 sm:grid-cols-[1fr_2fr_32px]">
                <Input
                  aria-label="Check"
                  value={c.label}
                  onChange={(e) => setF({ ...f, qcChecks: f.qcChecks.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)) })}
                />
                <Input
                  aria-label="What to check"
                  value={c.hint}
                  onChange={(e) => setF({ ...f, qcChecks: f.qcChecks.map((y, j) => (j === i ? { ...y, hint: e.target.value } : y)) })}
                />
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Remove"
                  disabled={f.qcChecks.length === 1}
                  onClick={() => setF({ ...f, qcChecks: f.qcChecks.filter((_, j) => j !== i) })}
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
          {err("qcChecks") && <p className="mt-1 text-body text-danger">{err("qcChecks")}</p>}
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() =>
              setF({
                ...f,
                qcChecks: [
                  ...f.qcChecks,
                  {
                    key: keyOf(
                      "check",
                      f.qcChecks.map((c) => c.key),
                    ),
                    label: "",
                    hint: "",
                  },
                ],
              })
            }
          >
            <Plus />
            Add a check
          </Button>
        </SectionCard>

        <SectionCard title="Kit lists" description="What goes out for a shoot and must come back. One item per line.">
          <div className="grid gap-4 lg:grid-cols-2">
            {f.kits.map((k, i) => (
              <div key={k.key} className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    aria-label="Kit name"
                    value={k.name}
                    onChange={(e) => setF({ ...f, kits: f.kits.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)) })}
                  />
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Remove this kit"
                    disabled={f.kits.length === 1}
                    onClick={() => setF({ ...f, kits: f.kits.filter((_, j) => j !== i) })}
                  >
                    <X />
                  </Button>
                </div>
                <Textarea
                  rows={12}
                  aria-label={`${k.name} items`}
                  value={kitText[k.key] ?? ""}
                  onChange={(e) => setKitText({ ...kitText, [k.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          {err("kits") && <p className="mt-1 text-body text-danger">{err("kits")}</p>}
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => {
              const key = keyOf(
                "kit",
                f.kits.map((k) => k.key),
              );
              setF({ ...f, kits: [...f.kits, { key, name: "New kit", items: [] }] });
            }}
          >
            <Plus />
            Add a kit list
          </Button>
        </SectionCard>
      </fieldset>
      {canEdit ? (
        <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
          {Object.keys(errors).length > 0 && <span className="mr-auto text-body text-danger">{Object.values(errors)[0]}</span>}
          <Button
            variant="ghost"
            onClick={() => {
              const d = DEFAULT_PRODUCTION_SETTINGS;
              setF(d);
              setSteps(d.editSteps.join("\n"));
              setPre(d.preShoot.join("\n"));
              setKitText(Object.fromEntries(d.kits.map((k) => [k.key, k.items.join("\n")])));
            }}
          >
            <RotateCcw />
            Growth OS defaults
          </Button>
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      ) : (
        <Alert tone="info">You can see the production settings; the owner, a manager or a team leader can change them.</Alert>
      )}
    </div>
  );
}

export function LiveProductionSettings() {
  const can = useCan();
  const settings = useProductionSettings();
  return (
    <>
      <PageHeader
        title="Production settings"
        description="How videos are coded, and every checklist used in production — your own, starting from the Growth OS defaults."
      />
      {settings.isPending ? (
        <SkeletonRows rows={8} />
      ) : settings.error ? (
        <Alert tone="danger">{errorMessage(settings.error)}</Alert>
      ) : (
        <Form initial={settings.data} canEdit={can("settings", "edit") || can("production", "approve")} />
      )}
    </>
  );
}

"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, Package as PackageIcon, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { PLATFORM_LABELS, BILLING_TERMS, DELIVERABLE_KINDS, type DeliverableKind, EXAMPLE_PACKAGES, type Package, packageInput, PLATFORMS } from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { ApiError, errorMessage } from "./api";
import { useCan, useDeletePackage, usePackages, useSavePackage, useSetPackageActive } from "./queries";

export const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export const PLATFORM_LABEL: Record<string, string> = PLATFORM_LABELS;
const KIND_LABEL: Record<DeliverableKind, string> = { video: "Video", post: "Post", story: "Story", other: "Other" };

export type Line = { name: string; perMonth: string; kind: DeliverableKind };

/** Deliverables a month (packages and agreements). Errors are keyed like the schema: `deliverables.0.name`. */
export function DeliverablesEditor({ lines, onChange, errors }: { lines: Line[]; onChange: (lines: Line[]) => void; errors: Record<string, string> }) {
  const setLine = (i: number, patch: Partial<Line>) => onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return (
    <div className="space-y-2">
      <div className="text-body font-medium text-text-secondary">
        Deliverables each month <span className="text-danger">*</span>
      </div>
      {lines.map((l, i) => (
        <div key={i} className="grid grid-cols-[1fr_90px_120px_32px] items-start gap-2">
          <Input aria-label="Deliverable" placeholder="e.g. Reels" value={l.name} onChange={(e) => setLine(i, { name: e.target.value })} />
          <Input aria-label="How many a month" type="number" min={1} value={l.perMonth} onChange={(e) => setLine(i, { perMonth: e.target.value })} />
          <Select
            aria-label="Kind"
            value={l.kind}
            onValueChange={(v) => setLine(i, { kind: v as DeliverableKind })}
            options={DELIVERABLE_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Remove this deliverable"
            disabled={lines.length === 1}
            onClick={() => onChange(lines.filter((_, j) => j !== i))}
          >
            <X />
          </Button>
          {(errors[`deliverables.${i}.name`] || errors[`deliverables.${i}.perMonth`]) && (
            <p className="col-span-4 text-body text-danger">{errors[`deliverables.${i}.name`] ?? errors[`deliverables.${i}.perMonth`]}</p>
          )}
        </div>
      ))}
      {errors.deliverables && <p className="text-body text-danger">{errors.deliverables}</p>}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={lines.length >= 20}
        onClick={() => onChange([...lines, { name: "", perMonth: "1", kind: "video" }])}
      >
        <Plus />
        Add a deliverable
      </Button>
    </div>
  );
}

export function PlatformPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="space-y-1.5">
      <div className="text-body font-medium text-text-secondary">Platforms</div>
      <div className="flex flex-wrap gap-2">
        {PLATFORMS.map((p) => {
          const on = value.includes(p);
          return (
            <button
              key={p}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((x) => x !== p) : [...value, p])}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1 text-body transition-colors",
                on ? "border-primary bg-primary-soft text-primary" : "border-border text-text-secondary hover:border-secondary/40",
              )}
            >
              {PLATFORM_LABEL[p]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
type Form = {
  name: string;
  description: string;
  monthlyFee: string;
  deliverables: Line[];
  shootDays: string;
  revisionsPerDeliverable: string;
  platforms: string[];
  billing: string;
};

const blank: Form = {
  name: "",
  description: "",
  monthlyFee: "",
  deliverables: [{ name: "Reels", perMonth: "8", kind: "video" }],
  shootDays: "1",
  revisionsPerDeliverable: "2",
  platforms: ["instagram"],
  billing: "Monthly advance",
};

const toForm = (p: Package): Form => ({
  name: p.name,
  description: p.description ?? "",
  monthlyFee: String(p.monthlyFee),
  deliverables: p.deliverables.map((d) => ({ name: d.name, perMonth: String(d.perMonth), kind: d.kind })),
  shootDays: String(p.shootDays),
  revisionsPerDeliverable: String(p.revisionsPerDeliverable),
  platforms: p.platforms,
  billing: p.billing ?? "",
});

function PackageDialog({ editing, open, onOpenChange }: { editing: Package | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const save = useSavePackage();
  const [f, setF] = useState<Form>(() => (editing ? toForm(editing) : blank));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = packageInput.safeParse({
      name: f.name,
      description: f.description || undefined,
      monthlyFee: Number(f.monthlyFee),
      deliverables: f.deliverables.map((l) => ({ name: l.name, perMonth: Number(l.perMonth), kind: l.kind })),
      shootDays: Number(f.shootDays),
      revisionsPerDeliverable: Number(f.revisionsPerDeliverable),
      platforms: f.platforms,
      billing: f.billing || undefined,
    });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])));
      return;
    }
    setErrors({});
    save.mutate(
      { id: editing?.id, input: parsed.data },
      {
        onSuccess: (p) => {
          toast.success(
            editing ? `${p.name} saved` : `${p.name} added`,
            editing ? { description: "New agreements use the new terms; signed ones keep theirs." } : {},
          );
          onOpenChange(false);
        },
        onError: (err) => {
          if (err instanceof ApiError && err.body.issues) setErrors(Object.fromEntries(err.body.issues.map((i) => [i.path, i.message])));
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : "New package"}</DialogTitle>
            <DialogDescription>
              {editing?.agreements
                ? `${editing.agreements} agreements use this package. They keep the terms they were signed with; changes apply to new agreements.`
                : "What you sell each month. Agreements and monthly quotas are made from it."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
              <Field label="Package name" required error={errors.name}>
                <Input value={f.name} onChange={set("name")} />
              </Field>
              <Field label="Fee a month (₹)" required error={errors.monthlyFee}>
                <Input type="number" min={0} step={500} value={f.monthlyFee} onChange={set("monthlyFee")} />
              </Field>
            </div>
            <Field label="Description" error={errors.description}>
              <Textarea rows={2} value={f.description} onChange={set("description")} />
            </Field>

            <DeliverablesEditor lines={f.deliverables} onChange={(deliverables) => setF({ ...f, deliverables })} errors={errors} />

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Shoot days a month" error={errors.shootDays}>
                <Input type="number" min={0} max={31} value={f.shootDays} onChange={set("shootDays")} />
              </Field>
              <Field label="Revisions per deliverable" error={errors.revisionsPerDeliverable}>
                <Input type="number" min={0} max={10} value={f.revisionsPerDeliverable} onChange={set("revisionsPerDeliverable")} />
              </Field>
              <Field label="Billing" hint="Default for new agreements." error={errors.billing}>
                <Input list="billing-terms" value={f.billing} onChange={set("billing")} />
              </Field>
              <datalist id="billing-terms">
                {BILLING_TERMS.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </div>

            <PlatformPicker value={f.platforms} onChange={(platforms) => setF({ ...f, platforms })} />
            {save.error && !(save.error instanceof ApiError && save.error.body.issues) && <Alert tone="danger">{errorMessage(save.error)}</Alert>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : editing ? "Save" : "Add package"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PackageCard({ p, canEdit, onEdit }: { p: Package; canEdit: boolean; onEdit: () => void }) {
  const setActive = useSetPackageActive();
  const remove = useDeletePackage();
  return (
    <Card className={cn(!p.active && "opacity-70")}>
      <CardContent className="flex h-full flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-subheading font-semibold">{p.name}</div>
            <div className="text-body text-muted-foreground">
              <span className="font-semibold text-text-primary">{inr(p.monthlyFee)}</span> a month{p.billing ? ` · ${p.billing}` : ""}
            </div>
          </div>
          {!p.active && <Badge tone="neutral">Archived</Badge>}
        </div>
        {p.description && <p className="text-body text-muted-foreground">{p.description}</p>}
        <ul className="space-y-1 text-body">
          {p.deliverables.map((d) => (
            <li key={d.name} className="flex justify-between gap-2">
              <span>{d.name}</span>
              <span className="font-medium tabular-nums">{d.perMonth}</span>
            </li>
          ))}
        </ul>
        <div className="text-body text-muted-foreground">
          {p.shootDays} shoot {p.shootDays === 1 ? "day" : "days"} · {p.revisionsPerDeliverable} {p.revisionsPerDeliverable === 1 ? "revision" : "revisions"}{" "}
          each
        </div>
        {p.platforms.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {p.platforms.map((pl) => (
              <Badge key={pl} tone="outline">
                {PLATFORM_LABEL[pl] ?? pl}
              </Badge>
            ))}
          </div>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border-subtle pt-3">
          <span className="text-body text-muted-foreground">{p.agreements === 1 ? "1 agreement" : `${p.agreements} agreements`}</span>
          {canEdit && (
            <div className="flex gap-1">
              <Button variant="ghost" size="icon-sm" aria-label={`Edit ${p.name}`} onClick={onEdit}>
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={p.active ? `Archive ${p.name}` : `Restore ${p.name}`}
                title={p.active ? "Archive: keep it on its agreements, stop offering it" : "Offer it again"}
                onClick={() =>
                  setActive.mutate(
                    { id: p.id, active: !p.active },
                    { onSuccess: () => toast.success(p.active ? `${p.name} archived` : `${p.name} restored`), onError: (e) => toast.error(errorMessage(e)) },
                  )
                }
              >
                {p.active ? <Archive /> : <ArchiveRestore />}
              </Button>
              {p.agreements === 0 && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${p.name}`}
                  onClick={() => remove.mutate(p.id, { onSuccess: () => toast.success(`${p.name} deleted`), onError: (e) => toast.error(errorMessage(e)) })}
                >
                  <Trash2 />
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function LivePackages() {
  const can = useCan();
  const canEdit = can("settings", "edit");
  const [showArchived, setShowArchived] = useState(false);
  const packages = usePackages(showArchived);
  const save = useSavePackage();
  const [dialog, setDialog] = useState<{ open: boolean; editing: Package | null; key: number }>({ open: false, editing: null, key: 0 });
  const open = (editing: Package | null) => setDialog((d) => ({ open: true, editing, key: d.key + 1 }));

  const addExamples = async () => {
    try {
      for (const input of EXAMPLE_PACKAGES) await save.mutateAsync({ input });
      toast.success("Example packages added", { description: "Change them to match what you sell." });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <>
      <PageHeader
        title="Packages"
        description="What your agency sells each month. Agreements copy a package's terms when they are made, so changing a package never changes a signed agreement."
        actions={
          <>
            <label className="flex items-center gap-2 text-body text-text-secondary">
              <Switch checked={showArchived} onCheckedChange={setShowArchived} />
              Show archived
            </label>
            {canEdit && (
              <Button onClick={() => open(null)}>
                <Plus />
                New package
              </Button>
            )}
          </>
        }
      />
      {packages.isPending ? (
        <SkeletonRows rows={6} />
      ) : packages.error ? (
        <Alert tone="danger">{errorMessage(packages.error)}</Alert>
      ) : !packages.data.length ? (
        <Card>
          <EmptyState
            icon={PackageIcon}
            title="No packages yet"
            description={canEdit ? "Start from the Growth OS examples and change them, or make your own." : "An owner or manager sets up the packages."}
            action={
              canEdit && (
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={addExamples} disabled={save.isPending}>
                    <Sparkles />
                    Add example packages
                  </Button>
                  <Button variant="secondary" onClick={() => open(null)}>
                    <Plus />
                    New package
                  </Button>
                </div>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {packages.data.map((p) => (
            <PackageCard key={p.id} p={p} canEdit={canEdit} onEdit={() => open(p)} />
          ))}
        </div>
      )}
      <PackageDialog key={dialog.key} editing={dialog.editing} open={dialog.open} onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))} />
    </>
  );
}

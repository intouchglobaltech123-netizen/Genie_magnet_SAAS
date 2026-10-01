"use client";

import { useMemo, useState } from "react";
import { Lock, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  type AreaKey,
  type Grant,
  PERMISSION_AREAS,
  PERMISSION_LEVELS,
  type PermissionArea,
  type PermissionLevel,
  type PermissionMatrix,
  type Role,
} from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, SkeletonRows } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { errorMessage } from "./api";
import { useCan, useCreateRole, useDeleteRole, useRoles, useUpdateRole } from "./queries";

const LEVEL_LABEL: Record<PermissionLevel, string> = { none: "No access", view: "View", edit: "View and change", approve: "Change and approve" };
const levelsUpTo = (max: PermissionLevel) => PERMISSION_LEVELS.slice(0, PERMISSION_LEVELS.indexOf(max) + 1);
const AREAS = PERMISSION_AREAS as readonly (PermissionArea & { key: AreaKey })[];
const groups = [...new Set(AREAS.map((a) => a.group))];

function CreateRoleDialog({
  open,
  onOpenChange,
  roles,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  roles: Role[];
  onCreated: (key: string) => void;
}) {
  const create = useCreateRole();
  const [name, setName] = useState("");
  const [copyFrom, setCopyFrom] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setName("");
          setCopyFrom("");
          create.reset();
        }
      }}
    >
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(
              { name, copyFrom: copyFrom || undefined },
              {
                onSuccess: (r) => {
                  toast.success(`${r.name} created`);
                  onOpenChange(false);
                  onCreated(r.key);
                },
              },
            );
          }}
        >
          <DialogHeader>
            <DialogTitle>New role</DialogTitle>
            <DialogDescription>Start from an existing role and change what you need, or start with no access.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field label="Name" required>
              <Input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Technical support" />
            </Field>
            <Field label="Start from">
              <Select
                value={copyFrom || "_none"}
                onValueChange={(v) => setCopyFrom(v === "_none" ? "" : v)}
                options={[{ value: "_none", label: "No access (start empty)" }, ...roles.map((r) => ({ value: r.key, label: `Copy of ${r.name}` }))]}
                aria-label="Start from"
              />
            </Field>
            {create.error && <Alert tone="danger">{errorMessage(create.error)}</Alert>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RoleEditor({ role, canEdit, onDeleted }: { role: Role; canEdit: boolean; onDeleted: () => void }) {
  const update = useUpdateRole();
  const remove = useDeleteRole();
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description ?? "");
  const [matrix, setMatrix] = useState<PermissionMatrix>(role.permissions);

  const editable = canEdit && !role.isOwner;
  const dirty = name !== role.name || description !== (role.description ?? "") || JSON.stringify(matrix) !== JSON.stringify(role.permissions);
  const setGrant = (area: AreaKey, grant: Grant | null) => {
    const next = { ...matrix };
    if (!grant || grant.level === "none") delete next[area];
    else next[area] = grant;
    setMatrix(next);
  };

  return (
    <Card>
      <CardContent className="space-y-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-3">
            {editable ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Role name">
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Field label="What this role is for">
                  <Textarea className="min-h-9" rows={1} value={description} onChange={(e) => setDescription(e.target.value)} />
                </Field>
              </div>
            ) : (
              <>
                <h2 className="text-subheading font-semibold">{role.name}</h2>
                {role.description && <p className="text-body text-muted-foreground">{role.description}</p>}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="neutral">{role.members === 1 ? "1 person" : `${role.members} people`}</Badge>
            {editable && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete ${role.name}`}
                disabled={role.members > 0 || remove.isPending}
                title={role.members > 0 ? "Give its people another role first" : undefined}
                onClick={() =>
                  remove.mutate(role.key, {
                    onSuccess: () => {
                      toast.success(`${role.name} deleted`);
                      onDeleted();
                    },
                    onError: (e) => toast.error(errorMessage(e)),
                  })
                }
              >
                <Trash2 />
              </Button>
            )}
          </div>
        </div>

        {role.isOwner && (
          <Alert tone="info" icon={Lock}>
            The owner always has full access, so the agency can never lock itself out. Only owners can make someone an owner.
          </Alert>
        )}
        {!canEdit && !role.isOwner && <Alert tone="info">You can see the roles; an owner can change them.</Alert>}

        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group}>
              <div className="mb-2 text-body font-semibold text-text-secondary">{group}</div>
              <div className="divide-y divide-border-subtle rounded-lg border border-border">
                {AREAS.filter((a) => a.group === group).map((area) => {
                  const grant = matrix[area.key];
                  const level = grant?.level ?? "none";
                  return (
                    <div key={area.key} className="grid items-center gap-3 px-3 py-2.5 sm:grid-cols-[1fr_210px_150px]">
                      <div className="min-w-0">
                        <div className="text-body font-medium">
                          {area.label} {area.sensitive && <Badge tone="warning">Sensitive</Badge>}
                        </div>
                        {area.hint && <div className="text-body text-muted-foreground">{area.hint}</div>}
                      </div>
                      <Select
                        value={level}
                        disabled={!editable}
                        aria-label={`${area.label} for ${role.name}`}
                        options={levelsUpTo(area.max).map((l) => ({ value: l, label: LEVEL_LABEL[l] }))}
                        onValueChange={(l) => setGrant(area.key, { level: l as PermissionLevel, scope: grant?.scope })}
                      />
                      {area.ownable ? (
                        <label className={cn("flex items-center gap-2 text-body", level === "none" && "opacity-40")}>
                          <Switch
                            checked={grant?.scope === "own"}
                            disabled={!editable || level === "none"}
                            onCheckedChange={(own) => setGrant(area.key, { level, scope: own ? "own" : undefined })}
                          />
                          Only their own
                        </label>
                      ) : (
                        <span />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {editable && (
          <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-wrap items-center justify-end gap-2 border-t border-border-subtle bg-surface-secondary px-5 py-3">
            {update.error && <span className="mr-auto text-body text-danger">{errorMessage(update.error)}</span>}
            <Button
              variant="secondary"
              disabled={!dirty}
              onClick={() => {
                setName(role.name);
                setDescription(role.description ?? "");
                setMatrix(role.permissions);
              }}
            >
              Undo changes
            </Button>
            <Button
              disabled={!dirty || update.isPending}
              onClick={() =>
                update.mutate(
                  { key: role.key, name, description: description || null, permissions: matrix },
                  { onSuccess: () => toast.success(`${name} saved`, { description: "Applies from each person's next action." }) },
                )
              }
            >
              {update.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function LiveRoles() {
  const can = useCan();
  const roles = useRoles();
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const canEdit = can("roles", "edit");
  const role = useMemo(() => roles.data?.find((r) => r.key === selected) ?? roles.data?.[0], [roles.data, selected]);

  return (
    <>
      <PageHeader
        title="Roles and permissions"
        description="For each role, choose what it may see, change and approve. Changes apply from each person's next action and are in the audit log."
        actions={
          canEdit && (
            <Button onClick={() => setCreating(true)}>
              <Plus />
              New role
            </Button>
          )
        }
      />
      {roles.isPending ? (
        <SkeletonRows rows={8} />
      ) : roles.error ? (
        <Alert tone="danger">{errorMessage(roles.error)}</Alert>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <nav aria-label="Roles" className="space-y-1 lg:sticky lg:top-24 lg:self-start">
            {roles.data.map((r) => (
              <button
                key={r.key}
                onClick={() => setSelected(r.key)}
                aria-current={r.key === role?.key ? "true" : undefined}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-body transition-colors",
                  r.key === role?.key ? "bg-primary-soft font-medium text-primary" : "hover:bg-muted",
                )}
              >
                {r.isOwner ? <Lock className="size-4 shrink-0" /> : <ShieldCheck className="size-4 shrink-0 opacity-60" />}
                <span className="min-w-0 flex-1 truncate">{r.name}</span>
                {r.isClient && <Badge tone="info">Client</Badge>}
                <span className="text-muted-foreground">{r.members}</span>
              </button>
            ))}
          </nav>
          {role && <RoleEditor key={role.key} role={role} canEdit={canEdit} onDeleted={() => setSelected(null)} />}
        </div>
      )}
      {roles.data && <CreateRoleDialog open={creating} onOpenChange={setCreating} roles={roles.data} onCreated={setSelected} />}
    </>
  );
}

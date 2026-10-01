"use client";

import { useState } from "react";
import { Copy, MailPlus, Trash2, UserMinus, Users } from "lucide-react";
import { toast } from "sonner";
import { OWNER_ROLE, type Team } from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { errorMessage } from "./api";
import { useCan, useCancelInvitation, useChangeRole, useInvite, useMe, useRemoveMember, useRoles, useTeam } from "./queries";

const date = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

async function copy(link: string) {
  try {
    await navigator.clipboard.writeText(link);
    toast.success("Invitation link copied", { description: "Send it to them on WhatsApp or by email." });
  } catch {
    toast.message("Copy this link", { description: link });
  }
}

/** Roles someone may hand out: only owners can make owners (the API checks everything else). */
function useRoleOptions() {
  const me = useMe().data;
  const roles = useRoles();
  const isOwner = me?.role?.key === OWNER_ROLE;
  return (roles.data ?? []).filter((r) => isOwner || !r.isOwner).map((r) => ({ value: r.key, label: r.name }));
}

function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const invite = useInvite();
  const options = useRoleOptions();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [link, setLink] = useState<string | null>(null);

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      setEmail("");
      setRole("");
      setLink(null);
      invite.reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        {link ? (
          <>
            <DialogHeader>
              <DialogTitle>Invitation ready</DialogTitle>
              <DialogDescription>Emails are not switched on yet, so send this link yourself. It works for 7 days, for {email} only.</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <div className="flex gap-2">
                <Input readOnly value={link} onFocus={(e) => e.target.select()} />
                <Button variant="secondary" onClick={() => copy(link)}>
                  <Copy />
                  Copy
                </Button>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button onClick={() => close(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              invite.mutate({ email, role }, { onSuccess: (r) => setLink(r.link) });
            }}
          >
            <DialogHeader>
              <DialogTitle>Invite a person</DialogTitle>
              <DialogDescription>They join with the role you choose and see only what it allows. You can change the role later.</DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <Field label="Email" required>
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label="Role" required>
                <Select value={role} onValueChange={setRole} options={options} placeholder="Choose a role" aria-label="Role" />
              </Field>
              {invite.error && <Alert tone="danger">{errorMessage(invite.error)}</Alert>}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!role || invite.isPending}>
                {invite.isPending ? "Inviting…" : "Create invitation"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RemoveDialog({ member, onClose }: { member: Team["members"][number] | null; onClose: () => void }) {
  const remove = useRemoveMember();
  return (
    <Dialog open={!!member} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove {member?.user.name}?</DialogTitle>
          <DialogDescription>
            They lose access to this agency at once, even if they are signed in. Their past work stays, and the change is in the audit log.
          </DialogDescription>
        </DialogHeader>
        {remove.error && (
          <DialogBody>
            <Alert tone="danger">{errorMessage(remove.error)}</Alert>
          </DialogBody>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Keep
          </Button>
          <Button
            variant="danger"
            disabled={remove.isPending}
            onClick={() =>
              member &&
              remove.mutate(member.id, {
                onSuccess: () => {
                  toast.success(`${member.user.name} removed`);
                  onClose();
                },
              })
            }
          >
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LiveTeam() {
  const me = useMe().data!;
  const can = useCan();
  const team = useTeam();
  const options = useRoleOptions();
  const changeRole = useChangeRole();
  const cancel = useCancelInvitation();
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<Team["members"][number] | null>(null);
  const canEdit = can("team", "edit");

  return (
    <>
      <PageHeader
        title="Team"
        description="Everyone in this agency and their role. What each role may do is set in Roles and permissions."
        actions={
          canEdit && (
            <Button onClick={() => setInviting(true)}>
              <MailPlus />
              Invite a person
            </Button>
          )
        }
      />

      <div className="space-y-6">
        <SectionCard title="People" description={team.data ? `${team.data.members.length} in this agency` : undefined} contentClassName="p-0">
          {team.isPending ? (
            <div className="p-4">
              <SkeletonRows rows={6} />
            </div>
          ) : team.error ? (
            <div className="p-4">
              <Alert tone="danger">{errorMessage(team.error)}</Alert>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Person</TH>
                    <TH>Role</TH>
                    <TH>Joined</TH>
                    {canEdit && <TH className="w-12" />}
                  </TR>
                </THead>
                <TBody>
                  {team.data.members.map((m) => {
                    const isMe = m.user.id === me.user.id;
                    return (
                      <TR key={m.id}>
                        <TD>
                          <div className="flex items-center gap-3">
                            <Avatar name={m.user.name} size="sm" />
                            <div className="min-w-0">
                              <div className="truncate font-medium">
                                {m.user.name} {isMe && <Badge tone="neutral">You</Badge>}
                              </div>
                              <div className="truncate text-muted-foreground">{m.title ?? m.user.email}</div>
                            </div>
                          </div>
                        </TD>
                        <TD className="min-w-48">
                          {canEdit && (me.role?.key === OWNER_ROLE || m.role.key !== OWNER_ROLE) ? (
                            <Select
                              value={m.role.key}
                              aria-label={`Role of ${m.user.name}`}
                              options={options.some((o) => o.value === m.role.key) ? options : [...options, { value: m.role.key, label: m.role.name }]}
                              onValueChange={(role) =>
                                changeRole.mutate(
                                  { membershipId: m.id, role },
                                  {
                                    onSuccess: () => toast.success(`${m.user.name} is now ${options.find((o) => o.value === role)?.label ?? role}`),
                                    onError: (e) => toast.error(errorMessage(e)),
                                  },
                                )
                              }
                            />
                          ) : (
                            <Badge tone={m.role.key === OWNER_ROLE ? "accent" : "neutral"}>{m.role.name}</Badge>
                          )}
                        </TD>
                        <TD className="whitespace-nowrap text-muted-foreground">{date(m.joinedAt)}</TD>
                        {canEdit && (
                          <TD>
                            <Button variant="ghost" size="icon-sm" aria-label={`Remove ${m.user.name}`} onClick={() => setRemoving(m)}>
                              <UserMinus />
                            </Button>
                          </TD>
                        )}
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Invitations waiting" description="Each link works for 7 days, for that email address only." contentClassName="p-0">
          {!team.data?.invitations.length ? (
            <EmptyState compact icon={Users} title="No invitations waiting" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Email</TH>
                    <TH>Role</TH>
                    <TH>Invited by</TH>
                    <TH>Expires</TH>
                    <TH className="w-40" />
                  </TR>
                </THead>
                <TBody>
                  {team.data.invitations.map((i) => (
                    <TR key={i.id}>
                      <TD className="font-medium">{i.email}</TD>
                      <TD>
                        <Badge tone="neutral">{i.role.name}</Badge>
                      </TD>
                      <TD>{i.invitedBy ?? "—"}</TD>
                      <TD className="whitespace-nowrap text-muted-foreground">{date(i.expiresAt)}</TD>
                      <TD>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => copy(i.link)}>
                            <Copy />
                            Copy link
                          </Button>
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Cancel the invitation to ${i.email}`}
                              onClick={() =>
                                cancel.mutate(i.id, {
                                  onSuccess: () => toast.success("Invitation cancelled"),
                                  onError: (e) => toast.error(errorMessage(e)),
                                })
                              }
                            >
                              <Trash2 />
                            </Button>
                          )}
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </SectionCard>
      </div>

      <InviteDialog open={inviting} onOpenChange={setInviting} />
      <RemoveDialog member={removing} onClose={() => setRemoving(null)} />
    </>
  );
}

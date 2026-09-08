import Link from "next/link";
import { requireBusinessAccess } from "@/lib/authz";
import { listBusinessRoles, listMembers } from "@/lib/business/members";
import { Card, CardBody, CardHeader, Field, Input, PageHeader, Select } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import { MembersTable } from "@/components/admin/config/members-table";
import { changeRoleAction, inviteAction, removeMemberAction, resendInviteAction, setStatusAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users & roles" };

export default async function UsersPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const ctx = await requireBusinessAccess(businessId, "users.manage");
  const [members, roles] = await Promise.all([listMembers(ctx.db, businessId), listBusinessRoles()]);
  return (
    <>
      <PageHeader title="Users & roles" description="Who can sign in to this business and what they can do." actions={<Link href={`/admin/${businessId}/users/roles`} className="text-sm underline">Roles reference</Link>} />
      <Card className="mb-6">
        <CardHeader title="Invite someone" description="They receive an email to set a password (new users) or immediate access (existing users)." />
        <CardBody>
          <ActionForm action={inviteAction.bind(null, businessId)} className="grid gap-3 sm:grid-cols-[1fr_1fr_200px_auto] items-end" resetOnSuccess>
            <Field label="Email"><Input name="email" type="email" required /></Field>
            <Field label="Name"><Input name="name" /></Field>
            <Field label="Role"><Select name="roleId" defaultValue={roles.find((r) => r.key === "business_staff")?.id ?? roles[0]?.id}>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select></Field>
            <SubmitButton>Send invite</SubmitButton>
          </ActionForm>
        </CardBody>
      </Card>
      <MembersTable businessId={businessId} currentUserId={ctx.user.id} roles={roles.map((r) => ({ id: r.id, key: r.key, name: r.name }))} members={members.map((m) => ({ id: m.id, userId: m.userId, name: m.user.name, email: m.user.email, roleId: m.roleId, roleName: m.role.name, status: m.status, lastLoginAt: m.user.lastLoginAt?.toISOString() ?? null, invitedAt: m.invitedAt?.toISOString() ?? null, isPlatform: m.user.platformRole !== "NONE" }))} changeRole={changeRoleAction} setStatus={setStatusAction} remove={removeMemberAction} resend={resendInviteAction} />
      {ctx.viaPlatform && <p className="mt-4 text-xs text-neutral-500">You are accessing this business with platform privileges; you are not listed as a member.</p>}
    </>
  );
}

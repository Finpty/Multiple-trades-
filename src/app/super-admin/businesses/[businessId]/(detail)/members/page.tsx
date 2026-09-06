import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { getBusinessForAdmin, listBusinessMembers, listBusinessRoles } from "@/lib/platform/businesses";
import { Badge, Card, CardBody, CardHeader, EmptyState, Field, Input, Select, TBody, Table, Td, Th, THead, formatDateTime, statusTone } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import { ActionButton } from "@/components/super-admin/core/action-button";
import { MemberRoleSelect } from "@/components/super-admin/core/member-role-select";
import { addMemberAction, changeMemberRoleAction, removeMemberAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function BusinessMembersPage({ params }: { params: Promise<{ businessId: string }> }) {
  await requirePlatformAdmin("ADMIN");
  const { businessId } = await params;
  if (!isUuid(businessId)) notFound();
  const business = await getBusinessForAdmin(businessId);
  if (!business) notFound();
  const [members, roles] = await Promise.all([listBusinessMembers(businessId), listBusinessRoles()]);
  const archived = !!business.deletedAt;

  return (
    <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
      <Card>
        <CardHeader title="Business members" description="People with direct access to this business. Organisation members inherit access through their organisation role." />
        {members.length === 0 ? (
          <CardBody>
            <EmptyState title="No members yet" description="Add the owner or staff by email. New people receive an invitation to set their password." />
          </CardBody>
        ) : (
          <Table className="rounded-none border-0">
            <THead>
              <tr>
                <Th>User</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Last login</Th>
                <Th></Th>
              </tr>
            </THead>
            <TBody>
              {members.map((m) => (
                <tr key={m.id}>
                  <Td>
                    <Link href={`/super-admin/users/${m.user.id}`} className="font-medium text-neutral-900 hover:underline">
                      {m.user.name}
                    </Link>
                    <div className="text-xs text-neutral-500">
                      {m.user.email}
                      {m.title ? ` · ${m.title}` : ""}
                    </div>
                  </Td>
                  <Td>
                    <MemberRoleSelect action={changeMemberRoleAction} fields={{ businessId, membershipId: m.id }} roleId={m.roleId} roles={roles} disabled={archived} />
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      <Badge tone={statusTone(m.status)}>{m.status}</Badge>
                      {m.user.status !== "ACTIVE" && <Badge tone={statusTone(m.user.status)}>user {m.user.status.toLowerCase()}</Badge>}
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap text-xs text-neutral-500">{m.user.lastLoginAt ? formatDateTime(m.user.lastLoginAt) : "Never"}</Td>
                  <Td className="text-right">
                    {!archived && (
                      <ActionButton action={removeMemberAction} fields={{ businessId, membershipId: m.id }} variant="ghost" confirm={`Remove ${m.user.email} from ${business.name}?`}>
                        Remove
                      </ActionButton>
                    )}
                  </Td>
                </tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Card className="self-start">
        <CardHeader title="Add member" description="Existing users are attached immediately; unknown emails create an invited user and send an invitation." />
        <CardBody>
          {archived ? (
            <p className="text-sm text-neutral-500">Restore the business to manage members.</p>
          ) : (
            <ActionForm action={addMemberAction} resetOnSuccess className="space-y-4">
              <input type="hidden" name="businessId" value={businessId} />
              <Field label="Email" required htmlFor="member-email">
                <Input id="member-email" name="email" type="email" required placeholder="person@example.com" />
              </Field>
              <Field label="Name" hint="Used only when the user does not exist yet." htmlFor="member-name">
                <Input id="member-name" name="name" maxLength={120} />
              </Field>
              <Field label="Role" required htmlFor="member-role">
                <Select id="member-role" name="roleId" required defaultValue={roles.find((r) => r.key === "business_owner")?.id ?? roles[0]?.id}>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Job title" htmlFor="member-title">
                <Input id="member-title" name="title" maxLength={80} placeholder="Optional" />
              </Field>
              <SubmitButton pendingText="Adding…">Add member</SubmitButton>
            </ActionForm>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

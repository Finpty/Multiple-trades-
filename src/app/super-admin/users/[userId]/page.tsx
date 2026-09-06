import Link from "next/link";
import { notFound } from "next/navigation";
import { hasPlatformRole, requirePlatformAdmin } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { PLATFORM_ROLES, getUserDetail } from "@/lib/platform/users";
import { Alert, Badge, Card, CardBody, CardHeader, Description, EmptyState, PageHeader, TBody, Table, Td, Th, THead, formatDateTime, statusTone } from "@/components/ui";
import { ActionButton } from "@/components/super-admin/core/action-button";
import { PlatformRoleForm, UserProfileForm } from "@/components/super-admin/core/user-forms";
import {
  activateUserAction,
  changePlatformRoleAction,
  resendInviteAction,
  revokeSessionAction,
  sendPasswordResetAction,
  signOutEverywhereAction,
  suspendUserAction,
  updateProfileAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function UserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { user: actor } = await requirePlatformAdmin("ADMIN");
  const { userId } = await params;
  if (!isUuid(userId)) notFound();
  const user = await getUserDetail(userId);
  if (!user) notFound();

  const isSelf = user.id === actor.id;
  const actorIsOwner = hasPlatformRole(actor, "OWNER");
  const fields = { userId: user.id };

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: "Users", href: "/super-admin/users" }, { label: user.name }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {user.name}
            <Badge tone={statusTone(user.status)}>{user.status}</Badge>
            <Badge tone={user.platformRole === "OWNER" ? "purple" : user.platformRole === "NONE" ? "neutral" : "blue"}>{user.platformRole}</Badge>
            {isSelf && <Badge tone="amber">This is you</Badge>}
          </span>
        }
        description={user.email}
        actions={
          <>
            {user.status === "INVITED" && (
              <ActionButton action={resendInviteAction} fields={fields} pendingText="Sending…">
                Resend invite
              </ActionButton>
            )}
            {user.status === "ACTIVE" && (
              <ActionButton action={sendPasswordResetAction} fields={fields} confirm={`Email a password reset link to ${user.email}?`}>
                Send password reset
              </ActionButton>
            )}
            <ActionButton action={signOutEverywhereAction} fields={fields} confirm={`Sign ${user.name} out of every device?${isSelf ? " This includes your current session." : ""}`}>
              Sign out everywhere
            </ActionButton>
            {user.status !== "SUSPENDED" && !isSelf && (
              <ActionButton action={suspendUserAction} fields={fields} variant="danger" confirm={`Suspend ${user.email}? They are signed out immediately and cannot sign in until reactivated.`}>
                Suspend
              </ActionButton>
            )}
            {user.status === "SUSPENDED" && (
              <ActionButton action={activateUserAction} fields={fields} variant="primary" confirm={`Reactivate ${user.email}?`}>
                Activate
              </ActionButton>
            )}
          </>
        }
      />

      {user.status === "INVITED" && (
        <Alert tone="info" className="mb-4" title="Invitation pending">
          {user.pendingInvite ? `An invitation link is valid until ${formatDateTime(user.pendingInvite.expiresAt)}.` : "The last invitation has expired. Resend it so the user can set a password."}
        </Alert>
      )}
      {user.status === "SUSPENDED" && (
        <Alert tone="danger" className="mb-4" title="Account suspended">
          This user cannot sign in. Business and organisation memberships are kept and resume when the account is activated.
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Profile" />
            <CardBody className="space-y-6">
              <Description
                items={[
                  { label: "Email", value: user.email },
                  { label: "Email verified", value: user.emailVerifiedAt ? formatDateTime(user.emailVerifiedAt) : <span className="text-neutral-400">Not verified</span> },
                  { label: "Last login", value: user.lastLoginAt ? formatDateTime(user.lastLoginAt) : <span className="text-neutral-400">Never</span> },
                  { label: "Password", value: user.hasPassword ? "Set" : <span className="text-neutral-400">Not set</span> },
                  { label: "MFA", value: user.mfaEnabled ? "Enabled" : "Off" },
                  { label: "Created", value: formatDateTime(user.createdAt) },
                ]}
              />
              <UserProfileForm action={updateProfileAction} user={{ id: user.id, name: user.name, phone: user.phone, timezone: user.timezone, locale: user.locale }} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Memberships" description="Where this user has access. Roles are managed from the business or organisation." />
            {user.orgMemberships.length === 0 && user.bizMemberships.length === 0 ? (
              <CardBody>
                <EmptyState title="No memberships" description="Add this user to a business from Super Admin → Businesses → Members." />
              </CardBody>
            ) : (
              <Table className="rounded-none border-0">
                <THead>
                  <tr>
                    <Th>Scope</Th>
                    <Th>Name</Th>
                    <Th>Role</Th>
                    <Th>Status</Th>
                  </tr>
                </THead>
                <TBody>
                  {user.orgMemberships.map((m) => (
                    <tr key={m.id}>
                      <Td className="text-xs uppercase tracking-wide text-neutral-500">Organisation</Td>
                      <Td>
                        <Link href={`/super-admin/businesses?organization=${m.organization.id}`} className="font-medium hover:underline">
                          {m.organization.name}
                        </Link>
                      </Td>
                      <Td>{m.role.name}</Td>
                      <Td>
                        <Badge tone={statusTone(m.status)}>{m.status}</Badge>
                      </Td>
                    </tr>
                  ))}
                  {user.bizMemberships.map((m) => (
                    <tr key={m.id}>
                      <Td className="text-xs uppercase tracking-wide text-neutral-500">Business</Td>
                      <Td>
                        <Link href={`/super-admin/businesses/${m.business.id}/members`} className="font-medium hover:underline">
                          {m.business.name}
                        </Link>
                        <div className="font-mono text-xs text-neutral-500">{m.business.slug}</div>
                      </Td>
                      <Td>{m.role.name}</Td>
                      <Td>
                        <Badge tone={statusTone(m.status)}>{m.status}</Badge>
                      </Td>
                    </tr>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>

          <Card>
            <CardHeader title="Active sessions" description="Signed-in devices. Revoking a session signs that device out on its next request." />
            {user.sessions.length === 0 ? (
              <CardBody>
                <EmptyState title="No active sessions" description="This user is not signed in anywhere." />
              </CardBody>
            ) : (
              <Table className="rounded-none border-0">
                <THead>
                  <tr>
                    <Th>Device</Th>
                    <Th>IP</Th>
                    <Th>Last active</Th>
                    <Th>Expires</Th>
                    <Th></Th>
                  </tr>
                </THead>
                <TBody>
                  {user.sessions.map((s) => (
                    <tr key={s.id}>
                      <Td className="text-xs">
                        <span className="block max-w-xs truncate" title={s.userAgent ?? undefined}>
                          {s.userAgent ?? <span className="text-neutral-400">Unknown</span>}
                        </span>
                      </Td>
                      <Td className="font-mono text-xs">{s.ip ?? "—"}</Td>
                      <Td className="whitespace-nowrap text-xs text-neutral-500">{formatDateTime(s.lastActiveAt)}</Td>
                      <Td className="whitespace-nowrap text-xs text-neutral-500">{formatDateTime(s.expiresAt)}</Td>
                      <Td className="text-right">
                        <ActionButton action={revokeSessionAction} fields={{ userId: user.id, sessionId: s.id }} variant="ghost" confirm="Revoke this session?">
                          Revoke
                        </ActionButton>
                      </Td>
                    </tr>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Platform role" description="Platform roles are separate from business access and are never inherited from memberships." />
            <CardBody>
              <PlatformRoleForm
                action={changePlatformRoleAction}
                userId={user.id}
                currentRole={user.platformRole}
                roles={PLATFORM_ROLES}
                canGrantOwner={actorIsOwner}
                disabled={isSelf || (user.platformRole === "OWNER" && !actorIsOwner)}
                disabledReason={isSelf ? "You cannot change your own platform role." : user.platformRole === "OWNER" && !actorIsOwner ? "Only a platform OWNER can change another OWNER's role." : undefined}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Audit" />
            <CardBody className="text-sm">
              <Link href={`/super-admin/audit-logs?actor=${encodeURIComponent(user.email)}`} className="text-neutral-700 underline-offset-2 hover:underline">
                Actions performed by this user →
              </Link>
              <p className="mt-3 text-xs text-neutral-400">
                User id <span className="font-mono">{user.id}</span>
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

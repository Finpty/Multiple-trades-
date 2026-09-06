import { requirePlatformAdmin, hasPlatformRole } from "@/lib/authz";
import { PLATFORM_ROLES } from "@/lib/platform/users";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { InviteUserForm } from "@/components/super-admin/core/user-forms";
import { inviteUserAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function InviteUserPage() {
  const { user } = await requirePlatformAdmin("ADMIN");
  return (
    <div className="max-w-xl">
      <PageHeader breadcrumbs={[{ label: "Users", href: "/super-admin/users" }, { label: "Invite" }]} title="Invite a user" description="The person receives an email with a link to set their password. Business access is granted separately from a business's Members tab." />
      <Card>
        <CardHeader title="New user" />
        <CardBody>
          <InviteUserForm action={inviteUserAction} roles={PLATFORM_ROLES} canGrantOwner={hasPlatformRole(user, "OWNER")} />
        </CardBody>
      </Card>
    </div>
  );
}

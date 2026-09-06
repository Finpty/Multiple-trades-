import { requirePlatformAdmin } from "@/lib/authz";
import { SUPER_ADMIN_NAV } from "@/lib/admin/nav";
import { AdminShell } from "@/components/admin/shell";
import { Badge } from "@/components/ui";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requirePlatformAdmin("ADMIN");
  return (
    <AdminShell
      brand="TRADE ONE · Super Admin"
      brandHref="/super-admin"
      items={SUPER_ADMIN_NAV}
      user={{ name: user.name, email: user.email }}
      topRight={
        <>
          <Badge tone="purple">{user.platformRole}</Badge>
          <Link href="/admin" className="text-sm text-neutral-600 hover:text-neutral-900">Business admin →</Link>
        </>
      }
    >
      {children}
    </AdminShell>
  );
}

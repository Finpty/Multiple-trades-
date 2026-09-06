import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { businessNav } from "@/lib/admin/nav";
import { isUuid } from "@/lib/ids";
import { AdminShell } from "@/components/admin/shell";
import { Badge, statusTone } from "@/components/ui";
import { publicSiteUrl } from "@/lib/tenant/resolve";
import type { Permission } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function BusinessAdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  if (!isUuid(businessId)) notFound();
  const ctx = await requireBusinessAccess(businessId);
  const [features, primaryDomain] = await Promise.all([
    ctx.db.businessFeature.findMany({ where: { businessId, isEnabled: true }, select: { featureKey: true } }),
    ctx.db.businessDomain.findFirst({ where: { businessId, isPrimary: true, verificationStatus: "VERIFIED" } }),
  ]);
  const enabled = new Set(features.map((f) => f.featureKey));
  const items = businessNav(businessId).filter((it) => (!it.permission || ctx.can(it.permission as Permission)) && (!it.feature || enabled.has(it.feature)));
  const siteUrl = publicSiteUrl(ctx.business, primaryDomain?.hostname ?? null);
  return (
    <AdminShell
      brand={ctx.business.name}
      brandHref={`/admin/${businessId}`}
      subtitle={<span className="flex items-center gap-2"><Badge tone={statusTone(ctx.business.status)}>{ctx.business.status}</Badge>{ctx.viaPlatform && <Badge tone="purple">Platform override</Badge>}</span>}
      items={items}
      user={{ name: ctx.user.name, email: ctx.user.email }}
      topRight={
        <>
          <a href={siteUrl} target="_blank" rel="noreferrer" className="text-sm text-neutral-600 hover:text-neutral-900">View site ↗</a>
          <Link href="/admin" className="text-sm text-neutral-600 hover:text-neutral-900">All businesses</Link>
        </>
      }
    >
      {children}
    </AdminShell>
  );
}

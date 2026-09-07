import { requireBusinessAccess } from "@/lib/authz";
import { dnsInstructions } from "@/lib/domains/service";
import { platformHosts } from "@/lib/env";
import { publicSiteUrl } from "@/lib/tenant/resolve";
import { getPlatformSetting } from "@/lib/platform/settings";
import { Alert, Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { DomainsManager } from "@/components/admin/config/domains-manager";
import { addDomainAction, removeDomainAction, setPrimaryDomainAction, setRedirectAction, verifyDomainAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Domains" };

export default async function DomainsPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const ctx = await requireBusinessAccess(businessId, "domains.manage");
  const [domains, provider, hint] = await Promise.all([ctx.db.businessDomain.findMany({ where: { businessId }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] }), getPlatformSetting<string>("domains.provider", "manual"), getPlatformSetting<string>("domains.dnsInstructions", "")]);
  const rows = await Promise.all(domains.map(async (d) => ({ ...d, instructions: d.verificationStatus === "VERIFIED" ? [] : await dnsInstructions(d) })));
  const primary = domains.find((d) => d.isPrimary && d.verificationStatus === "VERIFIED");
  const host = platformHosts()[0] ?? "localhost";
  return (
    <>
      <PageHeader title="Domains" description="Use your own domain for the website. Your platform address always keeps working." />
      <Card className="mb-6">
        <CardHeader title="Current addresses" />
        <CardBody className="space-y-1 text-sm">
          <div>Platform path: <a className="underline" href={publicSiteUrl(ctx.business, null)} target="_blank" rel="noreferrer">{publicSiteUrl(ctx.business, null)}</a></div>
          <div>Platform subdomain: <code>{ctx.business.slug}.{host}</code></div>
          <div>Primary custom domain: {primary ? <a className="underline" href={`https://${primary.hostname}`} target="_blank" rel="noreferrer">{primary.hostname}</a> : <span className="text-neutral-500">none verified yet</span>}</div>
        </CardBody>
      </Card>
      {hint && <Alert tone="neutral" className="mb-4">{hint}</Alert>}
      <DomainsManager businessId={businessId} domains={rows.map((d) => ({ id: d.id, hostname: d.hostname, kind: d.kind, isPrimary: d.isPrimary, verificationStatus: d.verificationStatus, verificationError: d.verificationError, verifiedAt: d.verifiedAt?.toISOString() ?? null, lastCheckedAt: d.lastCheckedAt?.toISOString() ?? null, sslStatus: d.sslStatus, sslProvider: d.sslProvider, redirectToDomainId: d.redirectToDomainId, redirectType: d.redirectType, instructions: d.instructions }))} provider={provider} add={addDomainAction.bind(null, businessId)} verify={verifyDomainAction} setPrimary={setPrimaryDomainAction} setRedirect={setRedirectAction} remove={removeDomainAction} />
    </>
  );
}

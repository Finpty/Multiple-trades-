import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { getBusinessFeatureSummary, getBusinessForAdmin } from "@/lib/platform/businesses";
import { Badge, ButtonLink, Card, CardBody, CardHeader, EmptyState, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function BusinessFeaturesPage({ params }: { params: Promise<{ businessId: string }> }) {
  await requirePlatformAdmin("ADMIN");
  const { businessId } = await params;
  if (!isUuid(businessId)) notFound();
  const business = await getBusinessForAdmin(businessId);
  if (!business) notFound();
  const summary = await getBusinessFeatureSummary(businessId);
  const categories = [...new Set(summary.features.map((f) => f.category))];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Stat label="Enabled features" value={summary.enabledCount} tone="green" />
        <Stat label="Available features" value={summary.totalDefined} />
        <Stat label="Disabled" value={Math.max(0, summary.totalDefined - summary.enabledCount)} />
      </div>
      <Card>
        <CardHeader title="Feature summary" description="Read-only. Features are switched on and off inside the business admin, and defined platform-wide under Feature Flags." actions={<ButtonLink href={`/admin/${businessId}/features`} variant="secondary" size="sm">Manage in business admin</ButtonLink>} />
        <CardBody>
          {summary.features.length === 0 ? (
            <EmptyState title="No feature definitions" description="Define features under Super Admin → Feature Flags to make them available to businesses." action={<ButtonLink href="/super-admin/feature-flags">Feature flags</ButtonLink>} />
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {categories.map((cat) => (
                <div key={cat}>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{cat}</div>
                  <ul className="space-y-1.5">
                    {summary.features
                      .filter((f) => f.category === cat)
                      .map((f) => (
                        <li key={f.key} className="flex items-center justify-between gap-3 rounded-md border border-neutral-100 px-3 py-2 text-sm">
                          <span>
                            {f.name}
                            <span className="ml-2 font-mono text-xs text-neutral-400">{f.key}</span>
                          </span>
                          <Badge tone={f.isEnabled ? "green" : "neutral"}>{f.isEnabled ? "On" : "Off"}</Badge>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

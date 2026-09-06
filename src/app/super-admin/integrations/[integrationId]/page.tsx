import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { getPlatformIntegration } from "@/lib/platform/integrations";
import { Badge, Card, CardBody, CardHeader, Description, PageHeader, formatDateTime } from "@/components/ui";
import { ActionButton } from "@/components/super-admin/core/action-button";
import { IntegrationForm } from "@/components/super-admin/core/integration-form";
import { deleteIntegrationAction, toggleIntegrationAction, updateIntegrationAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function IntegrationDetailPage({ params }: { params: Promise<{ integrationId: string }> }) {
  await requirePlatformAdmin("ADMIN");
  const { integrationId } = await params;
  if (!isUuid(integrationId)) notFound();
  const row = await getPlatformIntegration(integrationId);
  if (!row) notFound();
  const fields = { integrationId: row.id };

  return (
    <div className="max-w-3xl">
      <PageHeader
        breadcrumbs={[{ label: "Integrations", href: "/super-admin/integrations" }, { label: row.name }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {row.name}
            <Badge tone={row.isEnabled ? "green" : "neutral"}>{row.isEnabled ? "Enabled" : "Disabled"}</Badge>
          </span>
        }
        description={<span className="font-mono text-xs">{row.provider}</span>}
        actions={
          <>
            <ActionButton action={toggleIntegrationAction} fields={{ ...fields, enable: row.isEnabled ? "false" : "true" }} variant={row.isEnabled ? "secondary" : "primary"}>
              {row.isEnabled ? "Disable" : "Enable"}
            </ActionButton>
            <ActionButton action={deleteIntegrationAction} fields={fields} variant="danger" confirm={`Delete "${row.name}"? Its configuration and secrets are removed permanently. Disable it instead to keep them.`}>
              Delete
            </ActionButton>
          </>
        }
      />

      <Card className="mb-6">
        <CardHeader title="Summary" />
        <CardBody>
          <Description
            items={[
              { label: "Status", value: row.status },
              { label: "Secrets stored", value: row.secrets.length ? row.secrets.map((s) => `${s.key} (${s.masked})`).join(", ") : <span className="text-neutral-400">None</span> },
              { label: "Last sync", value: row.lastSyncAt ? formatDateTime(row.lastSyncAt) : null },
              { label: "Created", value: formatDateTime(row.createdAt) },
              { label: "Updated", value: formatDateTime(row.updatedAt) },
              { label: "Id", value: <span className="font-mono text-xs">{row.id}</span> },
            ]}
          />
        </CardBody>
      </Card>

      <IntegrationForm
        mode="edit"
        action={updateIntegrationAction}
        values={{
          id: row.id,
          provider: row.provider,
          name: row.name,
          config: JSON.stringify(row.config ?? {}, null, 2),
          isEnabled: row.isEnabled,
          status: row.status,
          secrets: row.secrets,
        }}
      />
    </div>
  );
}

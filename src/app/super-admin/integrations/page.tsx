import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/authz";
import { listPlatformIntegrations } from "@/lib/platform/integrations";
import { Badge, ButtonLink, EmptyState, PageHeader, TBody, Table, Td, Th, THead, formatDateTime } from "@/components/ui";
import { ActionButton } from "@/components/super-admin/core/action-button";
import { toggleIntegrationAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  await requirePlatformAdmin("ADMIN");
  const rows = await listPlatformIntegrations();

  return (
    <div>
      <PageHeader title="Platform integrations" description="Third-party services configured for the whole platform (payments, email, SMS, maps…). Businesses configure their own integrations from their admin." actions={<ButtonLink href="/super-admin/integrations/new">New integration</ButtonLink>} />

      {rows.length === 0 ? (
        <EmptyState title="No platform integrations" description="Add an integration to store provider configuration and encrypted API keys for services shared by every business." action={<ButtonLink href="/super-admin/integrations/new">New integration</ButtonLink>} />
      ) : (
        <Table>
          <THead>
            <tr>
              <Th>Name</Th>
              <Th>Provider</Th>
              <Th>Status</Th>
              <Th>Secrets</Th>
              <Th>Last sync</Th>
              <Th>Updated</Th>
              <Th></Th>
            </tr>
          </THead>
          <TBody>
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-neutral-50">
                <Td>
                  <Link href={`/super-admin/integrations/${r.id}`} className="font-medium text-neutral-900 hover:underline">
                    {r.name}
                  </Link>
                </Td>
                <Td className="font-mono text-xs">{r.provider}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    <Badge tone={r.isEnabled ? "green" : "neutral"}>{r.isEnabled ? "Enabled" : "Disabled"}</Badge>
                    {r.status && <Badge tone="blue">{r.status}</Badge>}
                  </div>
                </Td>
                <Td className="text-xs text-neutral-600">{r.secrets.length ? r.secrets.map((s) => s.key).join(", ") : <span className="text-neutral-400">none</span>}</Td>
                <Td className="whitespace-nowrap text-xs text-neutral-500">{r.lastSyncAt ? formatDateTime(r.lastSyncAt) : "—"}</Td>
                <Td className="whitespace-nowrap text-xs text-neutral-500">{formatDateTime(r.updatedAt)}</Td>
                <Td className="text-right">
                  <ActionButton action={toggleIntegrationAction} fields={{ integrationId: r.id, enable: r.isEnabled ? "false" : "true" }} variant="ghost">
                    {r.isEnabled ? "Disable" : "Enable"}
                  </ActionButton>
                </Td>
              </tr>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}

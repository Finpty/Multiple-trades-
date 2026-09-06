import { requirePlatformAdmin } from "@/lib/authz";
import { PageHeader } from "@/components/ui";
import { IntegrationForm } from "@/components/super-admin/core/integration-form";
import { createIntegrationAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewIntegrationPage() {
  await requirePlatformAdmin("ADMIN");
  return (
    <div className="max-w-3xl">
      <PageHeader breadcrumbs={[{ label: "Integrations", href: "/super-admin/integrations" }, { label: "New" }]} title="New platform integration" description="Store configuration and encrypted credentials for a service used by the platform." />
      <IntegrationForm mode="create" action={createIntegrationAction} values={{ provider: "", name: "", config: "{}", isEnabled: false, status: "", secrets: [] }} />
    </div>
  );
}

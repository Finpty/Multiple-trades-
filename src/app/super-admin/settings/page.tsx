import { requirePlatformAdmin } from "@/lib/authz";
import { maskSecret } from "@/lib/crypto";
import { getAllPlatformSettings } from "@/lib/platform/settings";
import { DOMAIN_PROVIDERS } from "@/lib/domains/service";
import { platformHosts } from "@/lib/env";
import { Alert, PageHeader } from "@/components/ui";
import { SettingsGroupForm } from "@/components/super-admin/core/settings-group-form";
import { saveDomainsGroupAction, saveMediaGroupAction, savePlatformGroupAction, saveRegistrationGroupAction, saveSecurityGroupAction } from "./actions";

export const dynamic = "force-dynamic";

const text = (v: unknown) => (typeof v === "string" ? v : v === null || v === undefined ? "" : String(v));
const list = (v: unknown) => (Array.isArray(v) ? v.map(String).join(", ") : text(v));
const flag = (v: unknown) => v === true || v === "true";

export default async function PlatformSettingsPage() {
  await requirePlatformAdmin("ADMIN");
  const s = await getAllPlatformSettings();
  const vercel = (s["domains.vercel"] as { token?: string; projectId?: string; teamId?: string } | undefined) ?? {};
  const hosts = platformHosts();

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Platform settings" description="Global defaults that apply to every business. Changes take effect immediately and are recorded in the audit log." />

      <SettingsGroupForm
        title="Platform"
        description="Identity and defaults used when new businesses are created."
        action={savePlatformGroupAction}
        fields={[
          { kind: "text", name: "platform.name", label: "Platform name", value: text(s["platform.name"]), required: true },
          { kind: "email", name: "platform.supportEmail", label: "Support email", value: text(s["platform.supportEmail"]), required: true, hint: "Shown to business owners when they need help." },
          { kind: "text", name: "platform.defaultCountry", label: "Default country", value: text(s["platform.defaultCountry"]), required: true, hint: "2-letter code, e.g. AU" },
          { kind: "text", name: "platform.defaultCurrency", label: "Default currency", value: text(s["platform.defaultCurrency"]), required: true, hint: "3-letter code, e.g. AUD" },
          { kind: "text", name: "platform.defaultTimezone", label: "Default timezone", value: text(s["platform.defaultTimezone"]), required: true, hint: "IANA name, e.g. Australia/Perth" },
        ]}
      />

      <SettingsGroupForm
        title="Security"
        description="Sign-in requirements and session lifetime."
        action={saveSecurityGroupAction}
        fields={[
          { kind: "switch", name: "security.requireEmailVerification", label: "Require email verification", checked: flag(s["security.requireEmailVerification"]), description: "Users must verify their email address before they can sign in." },
          { kind: "number", name: "security.sessionDays", label: "Session length (days)", value: text(s["security.sessionDays"]), required: true, min: 1, max: 365, step: 1, hint: "How long a sign-in stays valid without re-authentication." },
        ]}
      />

      <SettingsGroupForm
        title="Registration"
        description="Whether people can create their own account without an invitation."
        action={saveRegistrationGroupAction}
        columns={1}
        fields={[{ kind: "switch", name: "registration.enabled", label: "Public registration", checked: flag(s["registration.enabled"]), description: "When off, users only join through invitations sent from the admin." }]}
      />

      <SettingsGroupForm
        title="Media"
        description="Upload limits for every business media library."
        action={saveMediaGroupAction}
        fields={[
          { kind: "number", name: "media.maxUploadMb", label: "Maximum upload size (MB)", value: text(s["media.maxUploadMb"]), required: true, min: 1, max: 5000, step: 1 },
          { kind: "textarea", name: "media.allowedImageTypes", label: "Allowed image types", value: list(s["media.allowedImageTypes"]), hint: "Comma-separated MIME types.", rows: 2 },
          { kind: "textarea", name: "media.allowedVideoTypes", label: "Allowed video types", value: list(s["media.allowedVideoTypes"]), hint: "Comma-separated MIME types.", rows: 2 },
          { kind: "textarea", name: "media.allowedDocumentTypes", label: "Allowed document types", value: list(s["media.allowedDocumentTypes"]), hint: "Comma-separated MIME types.", rows: 2 },
        ]}
      />

      <div className="space-y-3">
        <SettingsGroupForm
          title="Domains"
          description="How custom domains are pointed at the platform and which provider automates SSL."
          action={saveDomainsGroupAction}
          fields={[
            { kind: "select", name: "domains.provider", label: "Hosting provider", value: text(s["domains.provider"]) || DOMAIN_PROVIDERS[0]?.id || "manual", options: DOMAIN_PROVIDERS.map((p) => ({ value: p.id, label: p.label })), hint: "Manual: you add the domain at the host yourself. Vercel: domains are added via the API when verified." },
            { kind: "text", name: "domains.platformSubdomainSuffix", label: "Platform subdomain suffix", value: text(s["domains.platformSubdomainSuffix"]), hint: `Businesses get <slug>.<suffix>. Platform hosts: ${hosts.join(", ")}`, placeholder: "e.g. sites.example.com" },
            { kind: "text", name: "domains.cnameTarget", label: "CNAME target", value: text(s["domains.cnameTarget"]), hint: "Hostname that subdomains should CNAME to.", placeholder: hosts[0] ?? "" },
            { kind: "text", name: "domains.aRecord", label: "A record (apex domains)", value: text(s["domains.aRecord"]), hint: "IP address for apex domains that cannot use a CNAME.", placeholder: "e.g. 76.76.21.21" },
            { kind: "textarea", name: "domains.dnsInstructions", label: "DNS instructions", value: text(s["domains.dnsInstructions"]), hint: "Shown to business owners when they add a domain.", rows: 3 },
            { kind: "secret", name: "vercel.token", label: "Vercel API token", masked: vercel.token ? maskSecret(vercel.token) : "" },
            { kind: "text", name: "vercel.projectId", label: "Vercel project id", value: text(vercel.projectId) },
            { kind: "text", name: "vercel.teamId", label: "Vercel team id", value: text(vercel.teamId), hint: "Optional; only for team-owned projects." },
          ]}
        />
        <Alert tone="neutral">AI settings (provider keys, the global AI switch and business key policy) live under AI Providers.</Alert>
      </div>
    </div>
  );
}

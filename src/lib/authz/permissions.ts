/**
 * Permission catalogue. Roles are rows in `roles` holding an array of these
 * keys; system roles are seeded and immutable, organisations may add custom
 * roles later. Authorization decisions ALWAYS happen server-side through
 * src/lib/authz/index.ts – the UI only hides what a user cannot do.
 */
export const PERMISSIONS = {
  // Business-level
  "business.view": "View business dashboard",
  "business.settings": "Edit business details & settings",
  "business.publish": "Publish / unpublish the business",
  "website.edit": "Edit pages, sections, navigation & theme",
  "website.publish": "Publish website changes",
  "services.manage": "Manage services & pricing display",
  "projects.manage": "Manage projects / portfolio",
  "media.manage": "Upload and manage media",
  "areas.manage": "Manage service areas",
  "crm.view": "View customers, leads & messages",
  "crm.manage": "Create/edit customers, leads & messages",
  "quotes.manage": "Create, send and manage quotes",
  "jobs.manage": "Manage jobs, workflows & tasks",
  "invoices.manage": "Manage invoices & payments",
  "pricing.manage": "Manage pricing items & rules",
  "forms.manage": "Manage forms & submissions",
  "automation.manage": "Manage automation rules",
  "features.manage": "Enable / disable business features",
  "domains.manage": "Manage business domains",
  "users.manage": "Invite and manage business users",
  "integrations.manage": "Manage integrations, webhooks & AI keys",
  "analytics.view": "View analytics",
  "audit.view": "View the business audit log",
  "billing.manage": "Manage subscription & billing",
  "export.manage": "Export / import business configuration",
  // Organisation-level
  "org.manage": "Manage organisation settings",
  "org.businesses.create": "Create businesses in the organisation",
  "org.members.manage": "Manage organisation members",
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_BUSINESS_PERMISSIONS = (Object.keys(PERMISSIONS) as Permission[]).filter((p) => !p.startsWith("org."));
export const ALL_ORG_PERMISSIONS = (Object.keys(PERMISSIONS) as Permission[]).filter((p) => p.startsWith("org."));

export interface SystemRoleDefinition {
  key: string;
  name: string;
  description: string;
  scope: "ORGANIZATION" | "BUSINESS";
  permissions: Permission[];
}

export const SYSTEM_ROLES: SystemRoleDefinition[] = [
  {
    key: "org_owner",
    name: "Organisation Owner",
    description: "Full control of the organisation and every business in it.",
    scope: "ORGANIZATION",
    permissions: [...ALL_ORG_PERMISSIONS, ...ALL_BUSINESS_PERMISSIONS],
  },
  {
    key: "org_admin",
    name: "Organisation Admin",
    description: "Manage businesses and members; no billing.",
    scope: "ORGANIZATION",
    permissions: [
      "org.businesses.create",
      "org.members.manage",
      ...ALL_BUSINESS_PERMISSIONS.filter((p) => p !== "billing.manage"),
    ],
  },
  {
    key: "org_member",
    name: "Organisation Member",
    description: "Can see the organisation; access to businesses is granted per business.",
    scope: "ORGANIZATION",
    permissions: [],
  },
  {
    key: "business_owner",
    name: "Business Owner",
    description: "Full control of one business.",
    scope: "BUSINESS",
    permissions: [...ALL_BUSINESS_PERMISSIONS],
  },
  {
    key: "business_admin",
    name: "Business Admin",
    description: "Everything except billing, users and export.",
    scope: "BUSINESS",
    permissions: ALL_BUSINESS_PERMISSIONS.filter((p) => !["billing.manage", "users.manage", "export.manage"].includes(p)),
  },
  {
    key: "business_editor",
    name: "Website Editor",
    description: "Edit and publish website content, services, projects and media.",
    scope: "BUSINESS",
    permissions: ["business.view", "website.edit", "website.publish", "services.manage", "projects.manage", "media.manage", "areas.manage", "forms.manage", "analytics.view"],
  },
  {
    key: "business_staff",
    name: "Staff",
    description: "Day-to-day CRM, quotes and jobs.",
    scope: "BUSINESS",
    permissions: ["business.view", "crm.view", "crm.manage", "quotes.manage", "jobs.manage", "media.manage"],
  },
  {
    key: "business_viewer",
    name: "Viewer",
    description: "Read-only access to the dashboard and CRM.",
    scope: "BUSINESS",
    permissions: ["business.view", "crm.view", "analytics.view"],
  },
];

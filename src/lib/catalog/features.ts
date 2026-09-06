export interface FeatureDefinitionSeed {
  key: string;
  name: string;
  description: string;
  category: string;
  defaultEnabled: boolean;
  requiresAi?: boolean;
  isPlatformOnly?: boolean;
  configSchema?: Record<string, unknown>;
}

/**
 * Platform feature catalogue. Each business toggles these independently from
 * its admin (no deployment). New features are rows; the seed only adds missing ones.
 */
export const FEATURE_DEFINITIONS: FeatureDefinitionSeed[] = [
  { key: "website", name: "Website", description: "Public website generated from pages and theme.", category: "website", defaultEnabled: true },
  { key: "projects", name: "Projects / Portfolio", description: "Public project gallery with before/after media.", category: "website", defaultEnabled: true },
  { key: "reviews", name: "Reviews", description: "Customer reviews on the website.", category: "website", defaultEnabled: true },
  { key: "service_areas", name: "Service Area Pages", description: "Generated location pages for enabled service areas.", category: "website", defaultEnabled: true },
  { key: "blog", name: "Blog", description: "Articles and news pages.", category: "website", defaultEnabled: false },
  { key: "quote_requests", name: "Quote Requests", description: "Quote request form and lead capture.", category: "leads", defaultEnabled: true },
  { key: "calculator", name: "Instant Estimate Calculator", description: "Website calculator powered by the pricing engine.", category: "leads", defaultEnabled: false },
  { key: "online_booking", name: "Online Booking", description: "Customers request bookings from the website.", category: "leads", defaultEnabled: false },
  { key: "live_chat", name: "Live Chat", description: "Chat widget integration.", category: "leads", defaultEnabled: false },
  { key: "crm", name: "CRM", description: "Customers, leads, messages and tasks.", category: "operations", defaultEnabled: true },
  { key: "quotes", name: "Quotes", description: "Create, send and accept quotes.", category: "operations", defaultEnabled: true },
  { key: "jobs", name: "Jobs & Workflow", description: "Track jobs through configurable workflow stages.", category: "operations", defaultEnabled: true },
  { key: "project_timeline", name: "Project Timeline", description: "Customer-facing progress timeline.", category: "operations", defaultEnabled: false },
  { key: "invoices", name: "Invoices", description: "Invoices and payment tracking.", category: "finance", defaultEnabled: false },
  { key: "payments", name: "Online Payments", description: "Accept card payments on invoices and deposits.", category: "finance", defaultEnabled: false },
  { key: "client_portal", name: "Client Portal", description: "Customers view quotes, invoices and project progress.", category: "customer", defaultEnabled: false },
  { key: "supplier_portal", name: "Supplier Portal", description: "Suppliers manage materials and pricing.", category: "customer", defaultEnabled: false },
  { key: "marketplace", name: "Marketplace", description: "List services on the platform marketplace.", category: "growth", defaultEnabled: false },
  { key: "studio_3d", name: "3D Studio", description: "3D viewer blocks for projects and services.", category: "growth", defaultEnabled: false },
  { key: "ai_estimator", name: "AI Estimator", description: "AI-assisted estimates from photos and descriptions.", category: "ai", defaultEnabled: false, requiresAi: true },
  { key: "ai_receptionist", name: "AI Receptionist", description: "AI answers enquiries and books site visits.", category: "ai", defaultEnabled: false, requiresAi: true },
  { key: "ai_content", name: "AI Content Assistant", description: "Draft service descriptions, pages and replies.", category: "ai", defaultEnabled: false, requiresAi: true },
  { key: "automations", name: "Automations", description: "WHEN/THEN rules for follow-ups and tasks.", category: "operations", defaultEnabled: true },
  { key: "analytics", name: "Analytics", description: "Website and lead analytics.", category: "growth", defaultEnabled: true },
];

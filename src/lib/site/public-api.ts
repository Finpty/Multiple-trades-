/**
 * Contract between tenant-site client components and the public API routes.
 * Both sides import from here so the shapes cannot drift.
 *
 *  POST /api/site/forms      SiteFormSubmitRequest  → SiteFormSubmitResponse
 *  POST /api/site/upload     multipart {businessId, formSlug, file} → { mediaId, name, size }
 *  POST /api/site/estimate   SiteEstimateRequest   → SiteEstimateResponse
 *  POST /api/site/analytics  SiteAnalyticsEvent     → 204
 *
 * businessId is not a secret (it is embedded in the rendered site); the API
 * re-validates that the form/service belongs to a PUBLISHED business and
 * rate-limits by IP. Honeypot field `website` must be empty.
 */
export const SITE_API = {
  forms: "/api/site/forms",
  upload: "/api/site/upload",
  estimate: "/api/site/estimate",
  analytics: "/api/site/analytics",
} as const;

export interface SiteFormSubmitRequest {
  businessId: string;
  formSlug: string;
  data: Record<string, unknown>;
  /** [{ fieldKey, mediaId }] returned by /api/site/upload */
  files?: Array<{ fieldKey: string; mediaId: string }>;
  pageUrl?: string;
  /** Honeypot — must be empty */
  website?: string;
}

export interface SiteFormSubmitResponse {
  ok: boolean;
  message?: string;
  redirectUrl?: string | null;
  errors?: Record<string, string>;
  submissionId?: string;
}

export interface SiteEstimateRequest {
  businessId: string;
  serviceId?: string | null;
  inputs: Record<string, unknown>;
}

export interface SiteEstimateResponse {
  ok: boolean;
  currency?: string;
  lineItems?: Array<{ description: string; quantity: number; unit?: string; unitCents: number; totalCents: number }>;
  subtotalCents?: number;
  taxCents?: number;
  totalCents?: number;
  taxInclusive?: boolean;
  disclaimer?: string;
  error?: string;
}

export interface SiteAnalyticsEvent {
  businessId: string;
  type: "page_view" | "cta_click" | "form_start" | "form_submit" | "quote_request" | "phone_click" | "estimate";
  path: string;
  referrer?: string | null;
  sessionId?: string | null;
  metadata?: Record<string, unknown>;
}

/** Form field types supported by the form builder and renderer. */
export const FORM_FIELD_TYPES = [
  { type: "text", label: "Text" },
  { type: "email", label: "Email" },
  { type: "phone", label: "Phone" },
  { type: "number", label: "Number" },
  { type: "address", label: "Address" },
  { type: "dropdown", label: "Dropdown" },
  { type: "checkbox", label: "Checkboxes" },
  { type: "radio", label: "Radio buttons" },
  { type: "date", label: "Date" },
  { type: "time", label: "Time" },
  { type: "file", label: "File upload" },
  { type: "photo", label: "Photo upload" },
  { type: "video", label: "Video upload" },
  { type: "measurement", label: "Measurement" },
  { type: "signature", label: "Signature" },
  { type: "textarea", label: "Custom question (long text)" },
  { type: "service", label: "Service picker" },
  { type: "hidden", label: "Hidden value" },
] as const;

export type FormFieldType = (typeof FORM_FIELD_TYPES)[number]["type"];

export interface FormFieldDefinition {
  id: string;
  key: string;
  type: FormFieldType;
  label: string;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: Array<{ value: string; label: string }>;
  width?: "full" | "half";
  /** measurement unit, number min/max, accept for files, maxFiles */
  unit?: string;
  min?: number;
  max?: number;
  maxFiles?: number;
  defaultValue?: string;
}

export interface FormSettings {
  submitLabel?: string;
  successMessage?: string;
  redirectUrl?: string;
  notifyEmails?: string[];
  autoReplySubject?: string;
  autoReplyBody?: string;
}

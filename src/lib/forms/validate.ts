import type { FormFieldDefinition } from "@/lib/site/public-api";

const MAX_TEXT = 5000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ValidatedSubmission {
  values: Record<string, unknown>;
  errors: Record<string, string>;
  ok: boolean;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v === undefined || v === null ? "" : String(v).trim();
}

/**
 * Validates raw submitted data against a form definition. Unknown keys are
 * dropped; every value is coerced to a safe shape. Files are matched by
 * fieldKey from the upload step.
 */
export function validateSubmission(fields: FormFieldDefinition[], data: Record<string, unknown>, files: Array<{ fieldKey: string; mediaId: string }> = []): ValidatedSubmission {
  const values: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const raw = data[f.key];
    const label = f.label || f.key;
    const isFile = f.type === "file" || f.type === "photo" || f.type === "video";
    if (isFile) {
      const mine = files.filter((x) => x.fieldKey === f.key).map((x) => x.mediaId);
      if (f.required && mine.length === 0) errors[f.key] = `${label} is required.`;
      else if (f.maxFiles && mine.length > f.maxFiles) errors[f.key] = `${label}: at most ${f.maxFiles} files.`;
      else values[f.key] = mine;
      continue;
    }
    const empty = raw === undefined || raw === null || raw === "" || (Array.isArray(raw) && raw.length === 0);
    if (empty) {
      if (f.required && f.type !== "hidden") errors[f.key] = `${label} is required.`;
      else if (f.type === "hidden" && f.defaultValue !== undefined) values[f.key] = f.defaultValue;
      continue;
    }
    switch (f.type) {
      case "email": {
        const s = str(raw).toLowerCase();
        if (!EMAIL_RE.test(s) || s.length > 254) errors[f.key] = `${label} must be a valid email address.`;
        else values[f.key] = s;
        break;
      }
      case "phone": {
        const s = str(raw);
        if (s.replace(/\D/g, "").length < 6 || s.length > 40) errors[f.key] = `${label} must be a valid phone number.`;
        else values[f.key] = s;
        break;
      }
      case "number":
      case "measurement": {
        const n = typeof raw === "number" ? raw : Number(str(raw));
        if (!Number.isFinite(n)) errors[f.key] = `${label} must be a number.`;
        else if (f.min !== undefined && n < f.min) errors[f.key] = `${label} must be at least ${f.min}.`;
        else if (f.max !== undefined && n > f.max) errors[f.key] = `${label} must be at most ${f.max}.`;
        else values[f.key] = n;
        break;
      }
      case "dropdown":
      case "radio": {
        const s = str(raw);
        if (f.options?.length && !f.options.some((o) => o.value === s)) errors[f.key] = `${label} has an invalid option.`;
        else values[f.key] = s.slice(0, 500);
        break;
      }
      case "checkbox": {
        if (!f.options?.length) {
          values[f.key] = raw === true || raw === "true" || raw === "on" || raw === "1";
          break;
        }
        const list = (Array.isArray(raw) ? raw : [raw]).map(str);
        const allowed = new Set(f.options.map((o) => o.value));
        values[f.key] = list.filter((v) => allowed.has(v));
        break;
      }
      case "date": {
        const s = str(raw);
        if (Number.isNaN(Date.parse(s))) errors[f.key] = `${label} must be a valid date.`;
        else values[f.key] = s.slice(0, 10);
        break;
      }
      case "time": {
        const s = str(raw);
        if (!/^\d{1,2}:\d{2}$/.test(s)) errors[f.key] = `${label} must be a time (HH:MM).`;
        else values[f.key] = s;
        break;
      }
      case "signature": {
        const s = str(raw);
        if (!s.startsWith("data:image/") || s.length > 400_000) errors[f.key] = `${label} is invalid.`;
        else values[f.key] = s;
        break;
      }
      case "address": {
        if (raw && typeof raw === "object" && !Array.isArray(raw)) {
          const o = raw as Record<string, unknown>;
          values[f.key] = Object.fromEntries(Object.entries(o).slice(0, 8).map(([k, v]) => [k.slice(0, 30), str(v).slice(0, 200)]));
        } else values[f.key] = str(raw).slice(0, 500);
        break;
      }
      case "service":
        values[f.key] = str(raw).slice(0, 120);
        break;
      default: {
        const s = str(raw);
        if (s.length > MAX_TEXT) errors[f.key] = `${label} is too long.`;
        else values[f.key] = s;
      }
    }
  }
  return { values, errors, ok: Object.keys(errors).length === 0 };
}

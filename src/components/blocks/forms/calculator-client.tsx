"use client";

import { useMemo, useState } from "react";
import { SITE_API, type SiteEstimateRequest, type SiteEstimateResponse } from "@/lib/site/public-api";
import type { FormServiceOption } from "./form-renderer";

/** Serialisable subset of FieldDefinitionView (ESTIMATE custom fields). */
export interface CalculatorField {
  key: string;
  label: string;
  type: string;
  options: Array<{ value: string; label: string }>;
  isRequired: boolean;
  helpText: string | null;
  defaultValue: unknown;
  validation: { unit?: string; min?: number; max?: number };
}

export interface CalculatorClientProps {
  businessId: string;
  fields: CalculatorField[];
  services: FormServiceOption[];
  defaultServiceId: string | null;
  disclaimer: string;
  currency: string;
  locale: string;
  /** Site-relative (already siteHref'd) path of the quote page. */
  quoteHref: string;
  buttonClassName?: string;
  serviceLabel: string;
  quoteLabel: string;
}

type Values = Record<string, unknown>;

function money(cents: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

function initial(fields: CalculatorField[]): Values {
  const out: Values = {};
  for (const f of fields) {
    if (f.type === "BOOLEAN") out[f.key] = f.defaultValue === true || f.defaultValue === "true";
    else if (f.type === "MULTISELECT") out[f.key] = Array.isArray(f.defaultValue) ? f.defaultValue : [];
    else out[f.key] = f.defaultValue === null || f.defaultValue === undefined ? "" : String(f.defaultValue);
  }
  return out;
}

function Field({ f, value, onChange, id }: { f: CalculatorField; value: unknown; onChange: (v: unknown) => void; id: string }) {
  const unit = f.validation.unit;
  switch (f.type) {
    case "NUMBER":
    case "MEASUREMENT":
      return (
        <div className="flex gap-2">
          <input id={id} type="number" inputMode="decimal" step="any" min={f.validation.min} max={f.validation.max} className="site-input" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} required={f.isRequired} />
          {unit && <span className="inline-flex items-center px-3 text-sm font-medium" style={{ background: "var(--color-surface)", border: "var(--border-width) solid var(--color-border)", borderRadius: "var(--radius)" }}>{unit}</span>}
        </div>
      );
    case "SELECT":
      return (
        <select id={id} className="site-input" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} required={f.isRequired}>
          <option value="">Select…</option>
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      );
    case "MULTISELECT": {
      const sel = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="flex flex-col gap-2">
          {f.options.map((o) => (
            <label key={o.value} className="site-choice">
              <input type="checkbox" checked={sel.includes(o.value)} onChange={(e) => onChange(e.target.checked ? [...sel, o.value] : sel.filter((v) => v !== o.value))} />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      );
    }
    case "BOOLEAN":
      return (
        <label className="site-choice">
          <input id={id} type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
          <span>Yes</span>
        </label>
      );
    case "DATE":
      return <input id={id} type="date" className="site-input" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} required={f.isRequired} />;
    case "TEXTAREA":
    case "RICHTEXT":
      return <textarea id={id} className="site-input" rows={3} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} required={f.isRequired} />;
    default:
      return <input id={id} type="text" className="site-input" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} required={f.isRequired} />;
  }
}

/**
 * Instant estimate: posts the visitor's inputs to the public estimate API
 * (pricing engine) and shows line items + totals, then links to the quote
 * form with the same inputs in the query string.
 */
export function CalculatorClient({ businessId, fields, services, defaultServiceId, disclaimer, currency, locale, quoteHref, buttonClassName = "", serviceLabel, quoteLabel }: CalculatorClientProps) {
  const [serviceId, setServiceId] = useState<string>(defaultServiceId ?? services[0]?.id ?? "");
  const [values, setValues] = useState<Values>(() => initial(fields));
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<SiteEstimateResponse | null>(null);
  const [error, setError] = useState<string>("");

  const service = useMemo(() => services.find((s) => s.id === serviceId) ?? null, [services, serviceId]);

  const quoteLink = useMemo(() => {
    const qs = new URLSearchParams();
    if (service) qs.set("service", service.slug);
    for (const [k, v] of Object.entries(values)) {
      if (v === "" || v === null || v === undefined || v === false) continue;
      qs.set(k, Array.isArray(v) ? v.join(",") : String(v));
    }
    if (result?.totalCents !== undefined) qs.set("estimate", String(result.totalCents));
    const q = qs.toString();
    return q ? `${quoteHref}?${q}` : quoteHref;
  }, [service, values, result, quoteHref]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "loading") return;
    const missing = fields.find((f) => f.isRequired && (values[f.key] === "" || values[f.key] === undefined || (Array.isArray(values[f.key]) && (values[f.key] as unknown[]).length === 0)));
    if (missing) {
      setError(`Please fill in “${missing.label}”.`);
      setStatus("error");
      document.getElementById(`calc-${missing.key}`)?.focus();
      return;
    }
    setStatus("loading");
    setError("");
    try {
      const inputs: Record<string, unknown> = {};
      for (const f of fields) {
        const v = values[f.key];
        inputs[f.key] = f.type === "NUMBER" || f.type === "MEASUREMENT" ? (v === "" ? null : Number(v)) : v;
      }
      const payload: SiteEstimateRequest = { businessId, serviceId: serviceId || null, inputs };
      const res = await fetch(SITE_API.estimate, { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(payload) });
      let json: SiteEstimateResponse | null = null;
      try {
        json = (await res.json()) as SiteEstimateResponse;
      } catch {
        json = null;
      }
      if (!res.ok || !json?.ok) {
        setStatus("error");
        setError(json?.error ?? "We could not calculate an estimate right now. Please request a quote instead.");
        return;
      }
      setResult(json);
      setStatus("done");
      try {
        const body = JSON.stringify({ businessId, type: "estimate", path: window.location.pathname, metadata: { serviceId: serviceId || null, totalCents: json.totalCents ?? null } });
        navigator.sendBeacon?.(SITE_API.analytics, new Blob([body], { type: "application/json" }));
      } catch {
        /* ignore */
      }
    } catch {
      setStatus("error");
      setError("We could not reach the server. Please check your connection and try again.");
    }
  }

  const cur = result?.currency ?? currency;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <form onSubmit={onSubmit} className="p-6 sm:p-8" style={{ background: "var(--color-background)", color: "var(--color-text)", border: "var(--border-width) solid var(--color-border)", borderRadius: "calc(var(--radius) * 1.25)" }} noValidate>
        <div className="grid gap-4">
          {services.length > 0 && (
            <div className="site-field">
              <label htmlFor="calc-service" className="site-field-label">{serviceLabel}</label>
              <select id="calc-service" className="site-input" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>{s.parentId ? `— ${s.name}` : s.name}</option>
                ))}
              </select>
            </div>
          )}
          {fields.map((f) => (
            <div key={f.key} className="site-field">
              <label htmlFor={`calc-${f.key}`} className="site-field-label">
                {f.label}
                {f.isRequired && <span aria-hidden="true" style={{ color: "var(--color-accent)" }}> *</span>}
              </label>
              <Field f={f} value={values[f.key]} onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))} id={`calc-${f.key}`} />
              {f.helpText && <p className="site-field-help">{f.helpText}</p>}
            </div>
          ))}
          {fields.length === 0 && <p className="text-sm opacity-60">The estimate uses the selected service's standard pricing.</p>}
        </div>
        {status === "error" && error && (
          <div className="site-alert site-alert--error mt-4" role="alert">
            {error}
          </div>
        )}
        <div className="mt-5">
          <button type="submit" className={["site-btn site-btn--primary site-btn--lg", buttonClassName].join(" ")} disabled={status === "loading"}>
            {status === "loading" ? "Calculating…" : "Calculate estimate"}
          </button>
        </div>
      </form>

      <div className="p-6 sm:p-8" style={{ background: "var(--color-surface)", color: "var(--color-text)", border: "var(--border-width) solid var(--color-border)", borderRadius: "calc(var(--radius) * 1.25)" }} aria-live="polite">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-60">Your estimate</p>
        {result && status === "done" ? (
          <>
            {result.lineItems && result.lineItems.length > 0 && (
              <ul className="mt-4 divide-y text-sm" style={{ borderColor: "var(--color-border)" }}>
                {result.lineItems.map((li, i) => (
                  <li key={i} className="flex items-start justify-between gap-4 py-2.5">
                    <div>
                      <p className="font-medium">{li.description}</p>
                      <p className="text-xs opacity-65">
                        {li.quantity} {li.unit ?? ""} × {money(li.unitCents, cur, locale)}
                      </p>
                    </div>
                    <span className="tabular-nums">{money(li.totalCents, cur, locale)}</span>
                  </li>
                ))}
              </ul>
            )}
            <dl className="mt-4 space-y-1.5 text-sm" style={{ borderTop: "var(--border-width) solid var(--color-border)", paddingTop: "0.75rem" }}>
              {result.subtotalCents !== undefined && (
                <div className="flex justify-between">
                  <dt className="opacity-70">Subtotal</dt>
                  <dd className="tabular-nums">{money(result.subtotalCents, cur, locale)}</dd>
                </div>
              )}
              {result.taxCents !== undefined && result.taxCents > 0 && (
                <div className="flex justify-between">
                  <dt className="opacity-70">Tax{result.taxInclusive ? " (included)" : ""}</dt>
                  <dd className="tabular-nums">{money(result.taxCents, cur, locale)}</dd>
                </div>
              )}
              {result.totalCents !== undefined && (
                <div className="flex items-baseline justify-between pt-2">
                  <dt className="font-semibold">Estimated total</dt>
                  <dd className="text-2xl tabular-nums" style={{ fontFamily: "var(--font-heading)", fontWeight: "var(--font-heading-weight)" as React.CSSProperties["fontWeight"], color: "var(--color-primary)" }}>
                    {money(result.totalCents, cur, locale)}
                  </dd>
                </div>
              )}
            </dl>
            <p className="mt-4 text-xs leading-relaxed opacity-65">{result.disclaimer ?? disclaimer}</p>
          </>
        ) : (
          <p className="mt-4 text-sm opacity-70">Fill in the details and calculate to see an instant guide price.</p>
        )}
        <div className="mt-6">
          <a href={quoteLink} className={["site-btn site-btn--secondary site-btn--md w-full justify-center", buttonClassName].join(" ")}>
            {quoteLabel}
          </a>
        </div>
        {!result && <p className="mt-3 text-xs opacity-60">{disclaimer}</p>}
      </div>
    </div>
  );
}

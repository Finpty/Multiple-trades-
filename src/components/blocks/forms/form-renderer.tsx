"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SITE_API, type FormFieldDefinition, type FormSettings, type SiteFormSubmitRequest, type SiteFormSubmitResponse } from "@/lib/site/public-api";

export interface FormServiceOption {
  id: string;
  name: string;
  slug: string;
  parentId?: string | null;
}

export interface FormRendererProps {
  businessId: string;
  formSlug: string;
  fields: FormFieldDefinition[];
  settings: FormSettings;
  /** Services for "service" fields (and the quote form's service list). */
  services?: FormServiceOption[];
  /** When true, ?service=<slug> in the page URL pre-selects the first service field. */
  preselectFromQuery?: boolean;
  /** Extra values merged into the submission (e.g. calculator inputs). */
  hiddenValues?: Record<string, unknown>;
  submitLabel?: string;
  buttonClassName?: string;
  compact?: boolean;
}

type Values = Record<string, unknown>;
type Errors = Record<string, string>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+\d][\d\s().-]{5,}$/;

function isBlank(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.values(v as Record<string, unknown>).every(isBlank);
  return false;
}

function initialValues(fields: FormFieldDefinition[]): Values {
  const out: Values = {};
  for (const f of fields) {
    if (f.type === "checkbox") out[f.key] = f.defaultValue ? f.defaultValue.split(",").map((s) => s.trim()).filter(Boolean) : [];
    else if (f.type === "address") out[f.key] = { line1: f.defaultValue ?? "", city: "", state: "", postcode: "" };
    else if (f.type === "measurement") out[f.key] = { value: f.defaultValue ?? "", unit: f.unit ?? (f.options?.[0]?.value ?? "") };
    else if (f.type === "file" || f.type === "photo" || f.type === "video") out[f.key] = [];
    else out[f.key] = f.defaultValue ?? "";
  }
  return out;
}

function validate(fields: FormFieldDefinition[], values: Values): Errors {
  const errors: Errors = {};
  for (const f of fields) {
    if (f.type === "hidden") continue;
    const v = values[f.key];
    if (f.required && isBlank(v)) {
      errors[f.key] = "This field is required.";
      continue;
    }
    if (isBlank(v)) continue;
    if (f.type === "email" && typeof v === "string" && !EMAIL_RE.test(v.trim())) errors[f.key] = "Enter a valid email address.";
    if (f.type === "phone" && typeof v === "string" && !PHONE_RE.test(v.trim())) errors[f.key] = "Enter a valid phone number.";
    if (f.type === "number" || f.type === "measurement") {
      const raw = f.type === "measurement" ? (v as { value?: unknown }).value : v;
      const n = Number(raw);
      if (!Number.isFinite(n)) errors[f.key] = "Enter a number.";
      else if (f.min !== undefined && n < f.min) errors[f.key] = `Must be at least ${f.min}.`;
      else if (f.max !== undefined && n > f.max) errors[f.key] = `Must be at most ${f.max}.`;
    }
    if ((f.type === "file" || f.type === "photo" || f.type === "video") && Array.isArray(v) && f.maxFiles && v.length > f.maxFiles) errors[f.key] = `Choose up to ${f.maxFiles} file${f.maxFiles === 1 ? "" : "s"}.`;
  }
  return errors;
}

function track(businessId: string, type: "form_start" | "form_submit" | "quote_request", metadata: Record<string, unknown>) {
  try {
    const body = JSON.stringify({ businessId, type, path: window.location.pathname, referrer: document.referrer || null, metadata });
    if (navigator.sendBeacon) navigator.sendBeacon(SITE_API.analytics, new Blob([body], { type: "application/json" }));
    else void fetch(SITE_API.analytics, { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true });
  } catch {
    /* analytics must never break a form */
  }
}

/* ---------- field widgets ---------- */

function SignaturePad({ value, onChange, id }: { value: string; onChange: (dataUrl: string) => void; id: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = ref.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };
  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    last.current = point(e);
    ref.current?.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !ref.current || !last.current) return;
    const ctx = ref.current.getContext("2d");
    if (!ctx) return;
    const p = point(e);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = getComputedStyle(ref.current).color || "#111";
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    if (ref.current) onChange(ref.current.toDataURL("image/png"));
  };
  const clear = () => {
    const c = ref.current;
    if (!c) return;
    c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    onChange("");
  };
  useEffect(() => {
    if (!value && ref.current) ref.current.getContext("2d")?.clearRect(0, 0, ref.current.width, ref.current.height);
  }, [value]);
  return (
    <div>
      <canvas id={id} ref={ref} width={600} height={200} className="site-signature" style={{ color: "var(--color-text)" }} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end} onPointerCancel={end} aria-label="Signature pad — draw your signature" role="img" />
      <div className="mt-1.5 flex items-center justify-between text-xs opacity-70">
        <span>Draw your signature above</span>
        <button type="button" onClick={clear} className="underline underline-offset-2">Clear</button>
      </div>
    </div>
  );
}

function FileInput({ field, files, onChange, id }: { field: FormFieldDefinition; files: File[]; onChange: (files: File[]) => void; id: string }) {
  const [active, setActive] = useState(false);
  const accept = field.type === "photo" ? "image/*" : field.type === "video" ? "video/*" : undefined;
  const add = (list: FileList | null) => {
    if (!list) return;
    const next = [...files, ...Array.from(list)];
    onChange(field.maxFiles ? next.slice(0, field.maxFiles) : next);
  };
  return (
    <div>
      <label
        htmlFor={id}
        className={["site-dropzone block", active ? "site-dropzone--active" : ""].join(" ")}
        onDragOver={(e) => {
          e.preventDefault();
          setActive(true);
        }}
        onDragLeave={() => setActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setActive(false);
          add(e.dataTransfer.files);
        }}
      >
        <input id={id} type="file" className="sr-only" accept={accept} multiple={(field.maxFiles ?? 5) !== 1} capture={field.type === "photo" ? "environment" : undefined} onChange={(e) => add(e.target.files)} />
        <span className="font-medium">{field.type === "photo" ? "Add photos" : field.type === "video" ? "Add a video" : "Add files"}</span>
        <span className="block opacity-70">Drag and drop, or tap to choose{field.maxFiles ? ` (up to ${field.maxFiles})` : ""}</span>
      </label>
      {files.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 rounded px-2 py-1" style={{ background: "var(--color-surface)" }}>
              <span className="truncate">{f.name}</span>
              <button type="button" className="shrink-0 text-xs underline underline-offset-2" onClick={() => onChange(files.filter((_, j) => j !== i))}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FieldControl({ field, value, error, onChange, id, services }: { field: FormFieldDefinition; value: unknown; error?: string; onChange: (v: unknown) => void; id: string; services: FormServiceOption[] }) {
  const common = { id, name: field.key, "aria-invalid": error ? true : undefined, "aria-describedby": error ? `${id}-error` : field.helpText ? `${id}-help` : undefined, required: field.required };
  switch (field.type) {
    case "textarea":
      return <textarea {...common} className="site-input" placeholder={field.placeholder} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} rows={4} />;
    case "number":
      return <input {...common} type="number" inputMode="decimal" className="site-input" placeholder={field.placeholder} min={field.min} max={field.max} step="any" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
    case "email":
      return <input {...common} type="email" autoComplete="email" className="site-input" placeholder={field.placeholder} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
    case "phone":
      return <input {...common} type="tel" autoComplete="tel" className="site-input" placeholder={field.placeholder} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
    case "date":
      return <input {...common} type="date" className="site-input" min={field.min !== undefined ? String(field.min) : undefined} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
    case "time":
      return <input {...common} type="time" className="site-input" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
    case "dropdown":
      return (
        <select {...common} className="site-input" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
          <option value="">{field.placeholder ?? "Select…"}</option>
          {(field.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      );
    case "service":
      return (
        <select {...common} className="site-input" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
          <option value="">{field.placeholder ?? "Select a service…"}</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>{s.parentId ? `— ${s.name}` : s.name}</option>
          ))}
        </select>
      );
    case "radio":
      return (
        <div className="flex flex-col gap-2" role="radiogroup" aria-labelledby={`${id}-label`}>
          {(field.options ?? []).map((o) => (
            <label key={o.value} className="site-choice">
              <input type="radio" name={field.key} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} required={field.required} />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      );
    case "checkbox": {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      const options = field.options && field.options.length > 0 ? field.options : [{ value: "yes", label: field.placeholder ?? "Yes" }];
      return (
        <div className="flex flex-col gap-2" role="group" aria-labelledby={`${id}-label`}>
          {options.map((o) => (
            <label key={o.value} className="site-choice">
              <input type="checkbox" name={field.key} value={o.value} checked={selected.includes(o.value)} onChange={(e) => onChange(e.target.checked ? [...selected, o.value] : selected.filter((v) => v !== o.value))} />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      );
    }
    case "address": {
      const a = (value && typeof value === "object" ? value : {}) as Record<string, string>;
      const set = (k: string, v: string) => onChange({ ...a, [k]: v });
      return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
          <input id={id} name={`${field.key}.line1`} type="text" autoComplete="street-address" className="site-input col-span-2 sm:col-span-6" placeholder={field.placeholder ?? "Street address"} value={a.line1 ?? ""} onChange={(e) => set("line1", e.target.value)} required={field.required} aria-invalid={error ? true : undefined} />
          <input name={`${field.key}.city`} type="text" autoComplete="address-level2" className="site-input col-span-2 sm:col-span-3" placeholder="Suburb / city" value={a.city ?? ""} onChange={(e) => set("city", e.target.value)} aria-label="Suburb or city" />
          <input name={`${field.key}.state`} type="text" autoComplete="address-level1" className="site-input sm:col-span-1" placeholder="State" value={a.state ?? ""} onChange={(e) => set("state", e.target.value)} aria-label="State" />
          <input name={`${field.key}.postcode`} type="text" inputMode="numeric" autoComplete="postal-code" className="site-input sm:col-span-2" placeholder="Postcode" value={a.postcode ?? ""} onChange={(e) => set("postcode", e.target.value)} aria-label="Postcode" />
        </div>
      );
    }
    case "measurement": {
      const m = (value && typeof value === "object" ? value : { value: "", unit: field.unit ?? "" }) as { value: string; unit: string };
      const units = field.options && field.options.length > 0 ? field.options : field.unit ? [{ value: field.unit, label: field.unit }] : [];
      return (
        <div className="flex gap-2">
          <input {...common} type="number" inputMode="decimal" step="any" min={field.min} max={field.max} className="site-input" placeholder={field.placeholder} value={m.value ?? ""} onChange={(e) => onChange({ ...m, value: e.target.value })} />
          {units.length > 1 ? (
            <select className="site-input w-32" value={m.unit} onChange={(e) => onChange({ ...m, unit: e.target.value })} aria-label="Unit">
              {units.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          ) : (
            units[0] && <span className="inline-flex items-center rounded px-3 text-sm font-medium" style={{ background: "var(--color-surface)", border: "var(--border-width) solid var(--color-border)", borderRadius: "var(--radius)" }}>{units[0].label}</span>
          )}
        </div>
      );
    }
    case "file":
    case "photo":
    case "video":
      return <FileInput field={field} files={Array.isArray(value) ? (value as File[]) : []} onChange={onChange} id={id} />;
    case "signature":
      return <SignaturePad id={id} value={String(value ?? "")} onChange={onChange} />;
    case "hidden":
      return <input type="hidden" name={field.key} value={String(value ?? "")} />;
    default:
      return <input {...common} type="text" autoComplete={field.key === "name" || field.key === "fullName" ? "name" : undefined} className="site-input" placeholder={field.placeholder} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
  }
}

/* ---------- renderer ---------- */

/**
 * Renders any Form row's fields and submits JSON to the public site API.
 * Files are uploaded first (multipart to SITE_API.upload) and referenced by
 * mediaId; a visually hidden honeypot named "website" catches bots.
 */
export function FormRenderer({ businessId, formSlug, fields, settings, services = [], preselectFromQuery = false, hiddenValues, submitLabel, buttonClassName = "", compact = false }: FormRendererProps) {
  const [values, setValues] = useState<Values>(() => initialValues(fields));
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("");
  const [honeypot, setHoneypot] = useState("");
  const started = useRef(false);
  const idBase = useMemo(() => `f-${formSlug.replace(/[^a-z0-9]+/gi, "-")}`, [formSlug]);

  // ?service=<slug> pre-selects the first service field (quote pages link here from service cards / calculator).
  useEffect(() => {
    if (!preselectFromQuery) return;
    const slug = new URLSearchParams(window.location.search).get("service");
    if (!slug) return;
    const match = services.find((s) => s.slug === slug || s.id === slug);
    const target = fields.find((f) => f.type === "service");
    if (match && target) setValues((v) => (v[target.key] ? v : { ...v, [target.key]: match.id }));
  }, [preselectFromQuery, services, fields]);

  const update = useCallback(
    (key: string, v: unknown) => {
      setValues((prev) => ({ ...prev, [key]: v }));
      setErrors((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
      if (!started.current) {
        started.current = true;
        track(businessId, "form_start", { formSlug });
      }
    },
    [businessId, formSlug],
  );

  async function uploadFiles(): Promise<Array<{ fieldKey: string; mediaId: string }>> {
    const out: Array<{ fieldKey: string; mediaId: string }> = [];
    for (const f of fields) {
      if (f.type !== "file" && f.type !== "photo" && f.type !== "video") continue;
      const list = values[f.key];
      if (!Array.isArray(list)) continue;
      for (const file of list as File[]) {
        const body = new FormData();
        body.set("businessId", businessId);
        body.set("formSlug", formSlug);
        body.set("fieldKey", f.key);
        body.set("file", file);
        const res = await fetch(SITE_API.upload, { method: "POST", body });
        if (!res.ok) throw new Error(`Could not upload ${file.name}. Please try again or remove the file.`);
        const json = (await res.json()) as { mediaId?: string };
        if (!json.mediaId) throw new Error(`Could not upload ${file.name}.`);
        out.push({ fieldKey: f.key, mediaId: json.mediaId });
      }
    }
    return out;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "submitting") return;
    const nextErrors = validate(fields, values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      const first = Object.keys(nextErrors)[0];
      document.getElementById(`${idBase}-${first}`)?.focus();
      return;
    }
    setStatus("submitting");
    setMessage("");
    try {
      const files = await uploadFiles();
      const data: Record<string, unknown> = { ...(hiddenValues ?? {}) };
      for (const f of fields) {
        if (f.type === "file" || f.type === "photo" || f.type === "video") {
          data[f.key] = files.filter((x) => x.fieldKey === f.key).map((x) => x.mediaId);
          continue;
        }
        if (f.type === "service") {
          const svc = services.find((s) => s.id === values[f.key]);
          data[f.key] = values[f.key];
          if (svc) data[`${f.key}_name`] = svc.name;
          continue;
        }
        data[f.key] = values[f.key];
      }
      const payload: SiteFormSubmitRequest = { businessId, formSlug, data, files, pageUrl: window.location.href, website: honeypot };
      const res = await fetch(SITE_API.forms, { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(payload) });
      let json: SiteFormSubmitResponse | null = null;
      try {
        json = (await res.json()) as SiteFormSubmitResponse;
      } catch {
        json = null;
      }
      if (!res.ok || !json?.ok) {
        if (json?.errors && Object.keys(json.errors).length > 0) setErrors(json.errors);
        setStatus("error");
        setMessage(json?.message ?? (res.status === 404 ? "This form is not available right now. Please try again later." : "Something went wrong sending your message. Please try again."));
        return;
      }
      track(businessId, "form_submit", { formSlug, submissionId: json.submissionId ?? null });
      const redirect = json.redirectUrl ?? settings.redirectUrl;
      if (redirect) {
        window.location.assign(redirect);
        return;
      }
      setStatus("success");
      setMessage(json.message ?? settings.successMessage ?? "Thanks — we have received your message and will be in touch shortly.");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error && err.message ? err.message : "We could not reach the server. Please check your connection and try again.");
    }
  }

  if (status === "success") {
    return (
      <div className="site-alert site-alert--success" role="status" aria-live="polite">
        <p className="font-semibold">Message sent</p>
        <p className="mt-1">{message}</p>
      </div>
    );
  }

  const visible = fields.filter((f) => f.type !== "hidden");
  const hidden = fields.filter((f) => f.type === "hidden");

  return (
    <form className="site-form" onSubmit={onSubmit} noValidate data-form-slug={formSlug}>
      <div className={["grid grid-cols-1 sm:grid-cols-2", compact ? "gap-3" : "gap-4"].join(" ")}>
        {visible.map((f) => {
          const id = `${idBase}-${f.key}`;
          const err = errors[f.key];
          const isGroup = f.type === "radio" || f.type === "checkbox";
          return (
            <div key={f.id} className={["site-field", f.width === "half" ? "sm:col-span-1" : "sm:col-span-2"].join(" ")}>
              {isGroup ? (
                <span id={`${id}-label`} className="site-field-label">
                  {f.label}
                  {f.required && <span aria-hidden="true" style={{ color: "var(--color-accent)" }}> *</span>}
                </span>
              ) : (
                <label htmlFor={id} className="site-field-label">
                  {f.label}
                  {f.required && <span aria-hidden="true" style={{ color: "var(--color-accent)" }}> *</span>}
                </label>
              )}
              <FieldControl field={f} value={values[f.key]} error={err} onChange={(v) => update(f.key, v)} id={id} services={services} />
              {f.helpText && !err && <p id={`${id}-help`} className="site-field-help">{f.helpText}</p>}
              {err && <p id={`${id}-error`} className="site-field-error" role="alert">{err}</p>}
            </div>
          );
        })}
      </div>
      {hidden.map((f) => (
        <input key={f.id} type="hidden" name={f.key} value={String(values[f.key] ?? "")} />
      ))}
      <div className="site-honeypot" aria-hidden="true">
        <label htmlFor={`${idBase}-website`}>Website</label>
        <input id={`${idBase}-website`} type="text" name="website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
      </div>
      {status === "error" && message && (
        <div className="site-alert site-alert--error mt-4" role="alert">
          {message}
        </div>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button type="submit" className={["site-btn site-btn--primary site-btn--lg", buttonClassName].join(" ")} disabled={status === "submitting"}>
          {status === "submitting" ? "Sending…" : submitLabel ?? settings.submitLabel ?? "Send"}
        </button>
        <p className="text-xs opacity-60">We never share your details.</p>
      </div>
    </form>
  );
}

"use client";

import * as React from "react";
import type { FormFieldDefinition, FormSettings } from "@/lib/site/public-api";
import { cn, inputClass } from "@/components/ui";

/** Client-side rendering of a form definition. Never submits — used by the builder's live preview. */
export function FormPreview({ fields, settings, services, highlightId, onSelect }: { fields: FormFieldDefinition[]; settings: FormSettings; services: Array<{ id: string; name: string }>; highlightId?: string | null; onSelect?: (id: string) => void }) {
  return (
    <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={(e) => e.preventDefault()} noValidate>
      {fields.length === 0 && <p className="text-sm text-neutral-500 sm:col-span-2">Add fields from the palette to see the form here.</p>}
      {fields.map((f) => (
        <div
          key={f.id}
          onClick={() => onSelect?.(f.id)}
          className={cn("rounded-md p-1 transition", f.width === "half" ? "sm:col-span-1" : "sm:col-span-2", f.type === "hidden" && "hidden", onSelect && "cursor-pointer", highlightId === f.id && "ring-2 ring-sky-400")}
        >
          {f.type !== "checkbox" && f.type !== "radio" && (
            <label className="mb-1 block text-sm font-medium text-neutral-800">
              {f.label}
              {f.required && <span className="text-red-600"> *</span>}
            </label>
          )}
          <PreviewInput field={f} services={services} />
          {f.helpText && <p className="mt-1 text-xs text-neutral-500">{f.helpText}</p>}
        </div>
      ))}
      <div className="sm:col-span-2">
        <button type="submit" className="inline-flex h-10 items-center rounded-md bg-neutral-900 px-5 text-sm font-medium text-white">
          {settings.submitLabel || "Send"}
        </button>
      </div>
    </form>
  );
}

function PreviewInput({ field: f, services }: { field: FormFieldDefinition; services: Array<{ id: string; name: string }> }) {
  const common = { className: inputClass, placeholder: f.placeholder, readOnly: false } as const;
  switch (f.type) {
    case "textarea":
      return <textarea rows={4} {...common} />;
    case "number":
    case "measurement":
      return (
        <div className="flex items-center gap-2">
          <input type="number" min={f.min} max={f.max} {...common} />
          {f.unit && <span className="text-sm text-neutral-500">{f.unit}</span>}
        </div>
      );
    case "email":
      return <input type="email" {...common} />;
    case "phone":
      return <input type="tel" {...common} />;
    case "date":
      return <input type="date" {...common} />;
    case "time":
      return <input type="time" {...common} />;
    case "address":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <input className={cn(inputClass, "sm:col-span-2")} placeholder="Street address" />
          <input className={inputClass} placeholder="Suburb" />
          <input className={inputClass} placeholder="Postcode" />
        </div>
      );
    case "dropdown":
      return (
        <select className={inputClass} defaultValue="">
          <option value="">{f.placeholder || "Select…"}</option>
          {(f.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label || o.value}
            </option>
          ))}
        </select>
      );
    case "checkbox":
    case "radio":
      return (
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-neutral-800">
            {f.label}
            {f.required && <span className="text-red-600"> *</span>}
          </legend>
          <div className="space-y-1">
            {(f.options ?? []).map((o) => (
              <label key={o.value} className="flex items-center gap-2 text-sm text-neutral-700">
                <input type={f.type} name={`preview_${f.key}`} /> {o.label || o.value}
              </label>
            ))}
          </div>
        </fieldset>
      );
    case "service":
      return (
        <select className={inputClass} defaultValue="">
          <option value="">{f.placeholder || "Choose a service…"}</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      );
    case "file":
    case "photo":
    case "video":
      return (
        <div className="rounded-md border border-dashed border-neutral-300 p-4 text-center text-sm text-neutral-500">
          {f.type === "photo" ? "Drop photos here or tap to upload" : f.type === "video" ? "Upload a video" : "Upload files"}
          {f.maxFiles ? ` (up to ${f.maxFiles})` : ""}
        </div>
      );
    case "signature":
      return <div className="h-24 rounded-md border border-neutral-300 bg-white text-center text-xs leading-[6rem] text-neutral-400">Sign here</div>;
    case "hidden":
      return null;
    default:
      return <input type="text" {...common} />;
  }
}

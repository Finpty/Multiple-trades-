"use client";

import * as React from "react";
import type { ThemeTokens } from "@/lib/theme/tokens";
import { fontStylesheetUrl, tokensToCssVariables } from "@/lib/theme/css";
import type { WizardState } from "./types";

/**
 * Sample header + hero + service cards + button rendered purely from the
 * theme tokens (as CSS variables) and the wizard's current content, so the
 * admin sees the effect of every brand/style change immediately.
 */
export function LivePreview({ tokens, state, industryName, compact }: { tokens: ThemeTokens; state: Pick<WizardState, "details" | "services" | "serviceAreas">; industryName: string | null; compact?: boolean }) {
  const vars = tokensToCssVariables(tokens) as React.CSSProperties;
  const fontHref = fontStylesheetUrl(tokens);
  const name = state.details.name || "Your business";
  const tagline = state.details.tagline || `${industryName ?? "Trade"} done properly${state.details.serviceAreaText ? ` across ${state.details.serviceAreaText}` : ""}`;
  const services = state.services.filter((s) => s.depth === 0 && s.isEnabled && s.name.trim()).slice(0, 4);
  const areas = state.serviceAreas.slice(0, 6);
  const buttonRadius = tokens.buttonStyle === "pill" ? "999px" : "var(--radius)";
  const btnBase: React.CSSProperties = { borderRadius: buttonRadius, fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 12, padding: "8px 14px", display: "inline-block", transition: `all var(--motion-duration)` };
  const primaryBtn: React.CSSProperties =
    tokens.buttonStyle === "outline"
      ? { ...btnBase, border: "2px solid var(--color-primary)", color: "var(--color-primary)", background: "transparent" }
      : tokens.buttonStyle === "ghost"
        ? { ...btnBase, color: "var(--color-primary)", background: "transparent" }
        : { ...btnBase, background: "var(--color-primary)", color: "var(--color-background)" };
  const accentBtn: React.CSSProperties = { ...btnBase, background: "var(--color-accent)", color: tokens.mode === "dark" ? "#0a0a0a" : "#ffffff" };
  const imageFilter = { natural: "none", warm: "sepia(0.25) saturate(1.2)", cinematic: "contrast(1.15) saturate(0.85)", muted: "saturate(0.6)", duotone: "grayscale(1) contrast(1.1)" }[tokens.imageStyle];

  return (
    <div className="space-y-2">
      {fontHref && <link rel="stylesheet" href={fontHref} />}
      <div className="flex items-center justify-between px-1 text-xs text-neutral-500">
        <span className="font-medium uppercase tracking-wide">Live preview</span>
        <span>{tokens.fonts.heading} / {tokens.fonts.body}</span>
      </div>
      <div className="overflow-hidden rounded-xl border border-neutral-200 shadow-sm" style={{ ...vars, background: "var(--color-background)", color: "var(--color-text)", fontFamily: "var(--font-body)", fontWeight: "var(--font-body-weight)" as never }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "var(--border-width) solid var(--color-border)" }}>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded text-[11px] font-bold" style={{ background: "var(--color-primary)", color: "var(--color-background)", borderRadius: "var(--radius)" }}>
              {name.slice(0, 1).toUpperCase()}
            </div>
            <span className="text-sm font-semibold" style={{ fontFamily: "var(--font-heading)", fontWeight: "var(--font-heading-weight)" as never }}>
              {name}
            </span>
          </div>
          <div className="hidden items-center gap-3 text-[11px] sm:flex" style={{ color: "var(--color-muted)" }}>
            <span>Services</span>
            <span>Projects</span>
            <span>Contact</span>
            <span style={{ ...primaryBtn, padding: "5px 10px", fontSize: 11 }}>Get a quote</span>
          </div>
        </div>
        {/* Hero */}
        <div className="px-4" style={{ paddingTop: compact ? 20 : 28, paddingBottom: compact ? 20 : 28 }}>
          <div className="text-[10px] font-medium uppercase tracking-[0.15em]" style={{ color: "var(--color-accent)" }}>
            {industryName ?? "Your industry"}
          </div>
          <h3 className="mt-1 text-xl leading-tight" style={{ fontFamily: "var(--font-heading)", fontWeight: "var(--font-heading-weight)" as never, color: "var(--color-text)" }}>
            {tagline}
          </h3>
          <p className="mt-2 line-clamp-2 text-xs" style={{ color: "var(--color-muted)" }}>
            {state.details.description || `${name} delivers quality work with clear quotes and reliable timelines.`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span style={primaryBtn}>Request a quote</span>
            <span style={accentBtn}>{state.details.phone ? `Call ${state.details.phone}` : "Call us"}</span>
          </div>
          <div className="mt-3 h-20 w-full" style={{ background: `linear-gradient(135deg, var(--color-secondary), var(--color-primary))`, borderRadius: "var(--radius)", filter: imageFilter, opacity: 0.9 }} />
        </div>
        {/* Services */}
        <div className="px-4 py-4" style={{ background: "var(--color-surface)" }}>
          <div className="mb-2 text-sm" style={{ fontFamily: "var(--font-heading)", fontWeight: "var(--font-heading-weight)" as never }}>
            Our services
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(services.length ? services : [{ uid: "a", name: "Service one", shortDescription: "Add services in step 5." }, { uid: "b", name: "Service two", shortDescription: "" }]).map((s) => (
              <div key={s.uid} className="p-2.5" style={{ background: "var(--color-background)", border: "var(--border-width) solid var(--color-border)", borderRadius: "var(--radius)" }}>
                <div className="text-xs font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
                  {s.name}
                </div>
                <div className="mt-0.5 line-clamp-2 text-[10px]" style={{ color: "var(--color-muted)" }}>
                  {s.shortDescription || "Short description"}
                </div>
                <div className="mt-1.5 text-[10px] font-medium" style={{ color: "var(--color-primary)" }}>
                  Learn more →
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Areas + footer */}
        <div className="px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {(areas.length ? areas : [{ uid: "x", name: state.details.serviceAreaText || "Your area" }]).map((a) => (
              <span key={a.uid} className="text-[10px]" style={{ border: "1px solid var(--color-border)", borderRadius: "999px", padding: "2px 8px", color: "var(--color-muted)" }}>
                {a.name}
              </span>
            ))}
          </div>
        </div>
        <div className="px-4 py-2 text-[10px]" style={{ background: "var(--color-primary)", color: "var(--color-background)" }}>
          © {new Date().getFullYear()} {name}
        </div>
      </div>
      <div className="flex flex-wrap gap-1 px-1">
        {Object.entries(tokens.colors).map(([k, v]) => (
          <span key={k} title={`${k}: ${v}`} className="h-4 w-4 rounded-full border border-neutral-200" style={{ background: v }} />
        ))}
      </div>
    </div>
  );
}

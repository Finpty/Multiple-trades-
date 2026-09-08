"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Alert, Badge, Button, Card, CardBody, CardHeader, Field, Input, Select, Textarea, cn, formatDateTime } from "@/components/ui";
import { MediaPicker } from "@/components/admin/media-picker";
import type { ActionResult } from "@/lib/actions";
import type { ThemeTokens } from "@/lib/theme/tokens";
import { fontStylesheetUrl, tokensToStyleString } from "@/lib/theme/css";
import { COLOR_KEYS, FONT_WEIGHTS, GOOGLE_FONTS, THEME_ENUMS, THEME_ENUM_LABELS } from "@/lib/theme/options";
import { EDITOR_SOURCE, isEditorMessage, type EditorToSiteMessage } from "@/lib/editor/protocol";
import type { DesignFamilyView, ThemeRevisionView, ThemeView } from "@/lib/website/theme";

type Device = "desktop" | "tablet" | "mobile";
const DEVICE_WIDTH: Record<Device, string> = { desktop: "100%", tablet: "820px", mobile: "390px" };
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

interface Actions {
  save: (businessId: string, input: { tokens: unknown; designFamilyId?: string | null }) => Promise<ActionResult>;
  publish: (businessId: string) => Promise<ActionResult>;
  restore: (businessId: string, version: number) => Promise<ActionResult>;
}

function FontSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const isCustom = !GOOGLE_FONTS.includes(value);
  return (
    <div className="flex gap-2">
      <Select value={isCustom ? "__custom" : value} onChange={(e) => onChange(e.target.value === "__custom" ? "" : e.target.value)} className="flex-1">
        {GOOGLE_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
        <option value="__custom">Custom (Google Fonts name)…</option>
      </Select>
      {isCustom && <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Font family name" className="flex-1" />}
    </div>
  );
}

function Swatch({ tokens }: { tokens: ThemeTokens }) {
  return (
    <div className="flex overflow-hidden rounded border" aria-hidden>
      {(["primary", "secondary", "accent", "background", "surface"] as const).map((k) => <span key={k} className="h-5 flex-1" style={{ background: tokens.colors[k] }} />)}
    </div>
  );
}

/**
 * Brand & theme builder. Left: design family presets and every token.
 * Right: the draft site in an iframe that receives token changes over
 * postMessage instantly (no save needed). Save draft persists; Publish
 * snapshots the draft into a THEME revision and makes it live.
 */
export function ThemeBuilder({ businessId, theme, revisions, previewUrl, canPublish, actions }: { businessId: string; theme: ThemeView; revisions: ThemeRevisionView[]; previewUrl: string; canPublish: boolean; actions: Actions }) {
  const router = useRouter();
  const [tokens, setTokens] = React.useState<ThemeTokens>(theme.draft);
  const [familyId, setFamilyId] = React.useState<string | null>(theme.designFamilyId);
  const [saved, setSaved] = React.useState<string>(JSON.stringify(theme.draft));
  const [device, setDevice] = React.useState<Device>("desktop");
  const [msg, setMsg] = React.useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [pending, start] = React.useTransition();
  const [tab, setTab] = React.useState<"family" | "colors" | "type" | "style" | "logos" | "css" | "history">("family");
  const frame = React.useRef<HTMLIFrameElement>(null);
  const ready = React.useRef(false);
  const dirty = JSON.stringify(tokens) !== saved || familyId !== theme.designFamilyId;

  const push = React.useCallback((t: ThemeTokens) => {
    const win = frame.current?.contentWindow;
    if (!win) return;
    const message: EditorToSiteMessage = { source: EDITOR_SOURCE, type: "setTheme", theme: { cssVars: tokensToStyleString(t), mode: t.mode, animation: t.animation, fontsUrl: fontStylesheetUrl(t), customCss: t.customCss ?? "" } };
    win.postMessage(message, "*");
  }, []);

  React.useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!isEditorMessage(e.data) || e.source !== frame.current?.contentWindow) return;
      if ((e.data as { type: string }).type === "ready") { ready.current = true; push(tokens); }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [push, tokens]);

  React.useEffect(() => {
    if (!ready.current) return;
    const t = setTimeout(() => push(tokens), 80);
    return () => clearTimeout(t);
  }, [tokens, push]);

  React.useEffect(() => {
    if (!dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  const set = <K extends keyof ThemeTokens>(key: K, value: ThemeTokens[K]) => setTokens((t) => ({ ...t, [key]: value }));
  const setColor = (key: keyof ThemeTokens["colors"], value: string) => setTokens((t) => ({ ...t, colors: { ...t.colors, [key]: value } }));
  const setFont = (key: keyof ThemeTokens["fonts"], value: string | number) => setTokens((t) => ({ ...t, fonts: { ...t.fonts, [key]: value } }));

  const applyFamily = (f: DesignFamilyView) => {
    setFamilyId(f.id);
    setTokens((t) => ({ ...f.tokens, logoMediaId: t.logoMediaId, secondaryLogoMediaId: t.secondaryLogoMediaId, iconMediaId: t.iconMediaId, faviconMediaId: t.faviconMediaId, customCss: t.customCss }));
  };

  const save = () => start(async () => {
    const r = await actions.save(businessId, { tokens, designFamilyId: familyId });
    if (r.ok) { setSaved(JSON.stringify(tokens)); setMsg({ tone: "success", text: r.message ?? "Saved" }); router.refresh(); }
    else setMsg({ tone: "danger", text: r.error });
  });
  const publish = () => start(async () => {
    if (dirty) { const s = await actions.save(businessId, { tokens, designFamilyId: familyId }); if (!s.ok) { setMsg({ tone: "danger", text: s.error }); return; } setSaved(JSON.stringify(tokens)); }
    const r = await actions.publish(businessId);
    setMsg(r.ok ? { tone: "success", text: r.message ?? "Published" } : { tone: "danger", text: r.error });
    router.refresh();
  });
  const restore = (rev: ThemeRevisionView) => {
    if (!window.confirm(`Restore theme version ${rev.version} into the draft? The current draft is saved as a new version first.`)) return;
    start(async () => {
      const r = await actions.restore(businessId, rev.version);
      if (r.ok) { setTokens(rev.tokens); setSaved(JSON.stringify(rev.tokens)); setMsg({ tone: "success", text: r.message ?? "Restored" }); router.refresh(); }
      else setMsg({ tone: "danger", text: r.error });
    });
  };

  const tabs: Array<[typeof tab, string]> = [["family", "Design family"], ["colors", "Colours"], ["type", "Typography"], ["style", "Style"], ["logos", "Logos"], ["css", "Custom CSS"], ["history", "History"]];

  return (
    <div className="grid gap-4 xl:grid-cols-[440px_minmax(0,1fr)]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={save} disabled={pending || !dirty} variant="secondary">{pending ? "Working…" : "Save draft"}</Button>
          {canPublish && <Button onClick={publish} disabled={pending}>Publish theme</Button>}
          <span className="text-xs text-neutral-500">{dirty ? "Unsaved changes" : theme.hasUnpublishedChanges ? "Draft differs from the live site" : "Live and draft match"}</span>
        </div>
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <div className="flex flex-wrap gap-1 border-b">
          {tabs.map(([k, l]) => <button key={k} type="button" onClick={() => setTab(k)} className={cn("border-b-2 px-2.5 py-1.5 text-sm", tab === k ? "border-neutral-900 font-medium" : "border-transparent text-neutral-500 hover:text-neutral-900")}>{l}</button>)}
        </div>

        {tab === "family" && (
          <div className="grid gap-2 sm:grid-cols-2">
            {theme.families.map((f) => (
              <button key={f.id} type="button" onClick={() => applyFamily(f)} className={cn("rounded-lg border p-3 text-left transition hover:border-neutral-400", familyId === f.id ? "border-neutral-900 ring-1 ring-neutral-900" : "border-neutral-200")}>
                <div className="mb-2 flex items-center justify-between"><span className="text-sm font-medium">{f.name}</span>{familyId === f.id && <Badge tone="green">current</Badge>}</div>
                <Swatch tokens={f.tokens} />
                <p className="mt-2 text-xs text-neutral-500">{f.description}</p>
                <p className="mt-1 text-[11px] text-neutral-400">{f.tokens.fonts.heading} / {f.tokens.fonts.body}</p>
              </button>
            ))}
            {theme.families.length === 0 && <p className="text-sm text-neutral-500">No design families are active. A platform admin can add them under Design System.</p>}
          </div>
        )}

        {tab === "colors" && (
          <Card><CardBody className="space-y-3">
            {COLOR_KEYS.map((c) => {
              const value = tokens.colors[c.key];
              return (
                <div key={c.key} className="flex items-center gap-3">
                  <input type="color" value={HEX.test(value) && value.length === 7 ? value : "#000000"} onChange={(e) => setColor(c.key, e.target.value)} className="h-9 w-11 cursor-pointer rounded border border-neutral-300 bg-white p-0.5" aria-label={`${c.label} colour`} />
                  <div className="flex-1"><div className="text-sm font-medium">{c.label}</div><div className="text-xs text-neutral-500">{c.hint}</div></div>
                  <Input value={value} onChange={(e) => setColor(c.key, e.target.value)} className="w-28 font-mono text-xs" aria-label={`${c.label} hex`} />
                </div>
              );
            })}
            <Swatch tokens={tokens} />
          </CardBody></Card>
        )}

        {tab === "type" && (
          <Card><CardBody className="space-y-4">
            <Field label="Heading font"><FontSelect value={tokens.fonts.heading} onChange={(v) => setFont("heading", v)} /></Field>
            <Field label="Body font"><FontSelect value={tokens.fonts.body} onChange={(v) => setFont("body", v)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Heading weight"><Select value={String(tokens.fonts.headingWeight)} onChange={(e) => setFont("headingWeight", Number(e.target.value))}>{FONT_WEIGHTS.map((w) => <option key={w} value={w}>{w}</option>)}</Select></Field>
              <Field label="Body weight"><Select value={String(tokens.fonts.bodyWeight)} onChange={(e) => setFont("bodyWeight", Number(e.target.value))}>{FONT_WEIGHTS.map((w) => <option key={w} value={w}>{w}</option>)}</Select></Field>
            </div>
            <p className="rounded-md border p-3" style={{ fontFamily: `"${tokens.fonts.body}", system-ui, sans-serif` }}><span className="block text-xl" style={{ fontFamily: `"${tokens.fonts.heading}", system-ui, sans-serif`, fontWeight: tokens.fonts.headingWeight }}>Quality work, clearly priced.</span><span className="text-sm text-neutral-600" style={{ fontWeight: tokens.fonts.bodyWeight }}>Body copy sample using the selected fonts. Fonts load from Google Fonts on the live site.</span></p>
          </CardBody></Card>
        )}

        {tab === "style" && (
          <Card><CardBody className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(THEME_ENUMS) as Array<keyof typeof THEME_ENUMS>).map((key) => (
              <Field key={key} label={THEME_ENUM_LABELS[key]}>
                <Select value={String(tokens[key])} onChange={(e) => set(key, e.target.value as never)}>
                  {THEME_ENUMS[key].map((v) => <option key={v} value={v}>{v}</option>)}
                </Select>
              </Field>
            ))}
          </CardBody></Card>
        )}

        {tab === "logos" && (
          <Card><CardBody className="space-y-4">
            <Field label="Logo" hint="Shown in the header. Transparent PNG or SVG works best."><MediaPicker businessId={businessId} value={tokens.logoMediaId ?? null} onChange={(m) => set("logoMediaId", m?.id ?? null)} folderKey="brand" /></Field>
            <Field label="Logo on dark backgrounds" hint="Optional light version for dark headers and footers."><MediaPicker businessId={businessId} value={tokens.secondaryLogoMediaId ?? null} onChange={(m) => set("secondaryLogoMediaId", m?.id ?? null)} folderKey="brand" /></Field>
            <Field label="Icon / mark" hint="Square mark used in compact spaces."><MediaPicker businessId={businessId} value={tokens.iconMediaId ?? null} onChange={(m) => set("iconMediaId", m?.id ?? null)} folderKey="brand" /></Field>
            <Field label="Favicon" hint="Square image, at least 64×64."><MediaPicker businessId={businessId} value={tokens.faviconMediaId ?? null} onChange={(m) => set("faviconMediaId", m?.id ?? null)} folderKey="brand" /></Field>
          </CardBody></Card>
        )}

        {tab === "css" && (
          <Card><CardHeader title="Custom CSS" description="Advanced. Applies to the public site only; use the CSS variables (--color-primary, --radius, …) where possible." /><CardBody>
            <Textarea rows={12} value={tokens.customCss ?? ""} onChange={(e) => set("customCss", e.target.value)} className="font-mono text-xs" spellCheck={false} placeholder={".site-root .site-container { max-width: 80rem; }"} />
          </CardBody></Card>
        )}

        {tab === "history" && (
          <Card><CardHeader title="Published versions" description="Every publish creates a version. Restore any version into the draft." /><CardBody>
            {revisions.length === 0 && <p className="text-sm text-neutral-500">Nothing published yet.</p>}
            <ul className="divide-y">
              {revisions.map((r) => (
                <li key={r.version} className="flex items-center gap-3 py-2">
                  <div className="w-36 shrink-0"><Swatch tokens={r.tokens} /></div>
                  <div className="min-w-0 flex-1"><div className="text-sm font-medium">v{r.version} <span className="font-normal text-neutral-500">{r.note ?? ""}</span></div><div className="text-xs text-neutral-500">{formatDateTime(r.createdAt)}{r.author ? ` · ${r.author}` : ""}</div></div>
                  <Button size="sm" variant="secondary" disabled={pending} onClick={() => setTokens(r.tokens)} title="Preview this version without changing the draft">Preview</Button>
                  <Button size="sm" variant="secondary" disabled={pending} onClick={() => restore(r)}>Restore</Button>
                </li>
              ))}
            </ul>
          </CardBody></Card>
        )}
      </div>

      <div className="min-w-0">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex gap-1">{(["desktop", "tablet", "mobile"] as Device[]).map((d) => <Button key={d} size="sm" variant={device === d ? "primary" : "secondary"} onClick={() => setDevice(d)}>{d}</Button>)}</div>
          <div className="flex items-center gap-2 text-xs text-neutral-500"><span>Previewing the draft home page</span><Button size="sm" variant="ghost" onClick={() => { ready.current = false; frame.current?.contentWindow?.location.reload(); }}>Reload</Button></div>
        </div>
        <div className="flex justify-center rounded-lg border bg-neutral-100 p-3">
          <iframe ref={frame} src={previewUrl} title="Theme preview" className="h-[78vh] rounded-md bg-white shadow-sm transition-[width]" style={{ width: DEVICE_WIDTH[device], maxWidth: "100%" }} />
        </div>
      </div>
    </div>
  );
}

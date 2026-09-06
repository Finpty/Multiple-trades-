import type { SiteContext } from "@/lib/tenant/resolve";

/** Section width from the section settings (the wrapper does not constrain width; blocks do). */
export type SectionWidth = "narrow" | "normal" | "wide" | "full";

export function sectionWidth(settings: Record<string, unknown> | undefined, fallback: SectionWidth = "normal"): SectionWidth {
  const w = settings?.width;
  return w === "narrow" || w === "normal" || w === "wide" || w === "full" ? w : fallback;
}

/** Published-only filters unless the request is an authorised preview. */
export function contentStatusFilter(ctx: SiteContext): { status?: "PUBLISHED" } {
  return ctx.preview ? {} : { status: "PUBLISHED" };
}

/** Human date for review/timeline/project dates. */
export function formatDate(value: Date | string | null | undefined, locale = "en-AU", opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "short" }): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return typeof value === "string" ? value : "";
  return new Intl.DateTimeFormat(locale, opts).format(d);
}

/** Initials for avatar placeholders. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Opening hours normalisation. Accepts several owner-entered shapes. */
export interface OpeningHoursRow {
  label: string;
  value: string;
}

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_ALIASES: Record<string, number> = { mon: 0, monday: 0, tue: 1, tues: 1, tuesday: 1, wed: 2, wednesday: 2, thu: 3, thur: 3, thurs: 3, thursday: 3, fri: 4, friday: 4, sat: 5, saturday: 5, sun: 6, sunday: 6 };

function dayLabel(input: unknown): string {
  if (typeof input === "number" && input >= 0 && input < 7) return DAY_NAMES[input];
  if (typeof input === "string") {
    const idx = DAY_ALIASES[input.trim().toLowerCase()];
    if (idx !== undefined) return DAY_NAMES[idx];
    return input;
  }
  return "";
}

/**
 * Normalises BusinessLocation.openingHours into label/value rows.
 * Supported: [{ day|days|label, open, close, closed? }], [{ day, hours }],
 * { monday: "8am–5pm", ... }, or a plain string.
 */
export function normalizeOpeningHours(raw: unknown): OpeningHoursRow[] {
  if (!raw) return [];
  if (typeof raw === "string") return raw.trim() ? [{ label: "Hours", value: raw.trim() }] : [];
  if (Array.isArray(raw)) {
    const rows: OpeningHoursRow[] = [];
    for (const item of raw) {
      if (typeof item === "string") {
        if (item.trim()) rows.push({ label: "", value: item.trim() });
        continue;
      }
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const label = dayLabel(o.days ?? o.day ?? o.label ?? o.name);
      if (o.closed === true || o.isClosed === true || o.open === "closed") {
        rows.push({ label, value: "Closed" });
        continue;
      }
      const explicit = typeof o.hours === "string" ? o.hours : typeof o.value === "string" ? o.value : typeof o.text === "string" ? o.text : null;
      const open = typeof o.open === "string" ? o.open : typeof o.from === "string" ? o.from : typeof o.opens === "string" ? o.opens : null;
      const close = typeof o.close === "string" ? o.close : typeof o.to === "string" ? o.to : typeof o.closes === "string" ? o.closes : null;
      const value = explicit ?? (open && close ? `${open} – ${close}` : open ?? close ?? "");
      if (label || value) rows.push({ label, value });
    }
    return rows;
  }
  if (typeof raw === "object") {
    return Object.entries(raw as Record<string, unknown>)
      .map(([k, v]) => ({ label: dayLabel(k), value: typeof v === "string" ? v : v && typeof v === "object" ? normalizeOpeningHours([{ ...(v as object), day: k }])[0]?.value ?? "" : "" }))
      .filter((r) => r.value)
      .sort((a, b) => DAY_NAMES.indexOf(a.label) - DAY_NAMES.indexOf(b.label));
  }
  return [];
}

/** Address lines for a location row. */
export function formatAddress(loc: { addressLine1?: string | null; addressLine2?: string | null; city?: string | null; state?: string | null; postcode?: string | null; country?: string | null } | null | undefined): string[] {
  if (!loc) return [];
  const lines: string[] = [];
  if (loc.addressLine1) lines.push(loc.addressLine1);
  if (loc.addressLine2) lines.push(loc.addressLine2);
  const cityLine = [loc.city, loc.state, loc.postcode].filter(Boolean).join(" ");
  if (cityLine) lines.push(cityLine);
  return lines;
}

/** Parses a YouTube / Vimeo URL into a privacy-enhanced embed URL; null for anything else. */
export function videoEmbedUrl(input: string | null | undefined): { src: string; provider: "youtube" | "vimeo" } | null {
  if (!input) return null;
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
  if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "youtu.be") {
    let id: string | null = null;
    if (host === "youtu.be") id = url.pathname.slice(1).split("/")[0];
    else if (url.pathname === "/watch") id = url.searchParams.get("v");
    else {
      const m = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{6,})/);
      if (m) id = m[1];
    }
    if (!id || !/^[A-Za-z0-9_-]{6,}$/.test(id)) return null;
    const params = new URLSearchParams({ rel: "0", modestbranding: "1" });
    const start = url.searchParams.get("t") ?? url.searchParams.get("start");
    if (start && /^\d+/.test(start)) params.set("start", String(parseInt(start, 10)));
    return { src: `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`, provider: "youtube" };
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = url.pathname.match(/(\d{5,})/);
    if (!m) return null;
    const hash = url.pathname.match(/\/(\d{5,})\/([a-f0-9]{6,})/)?.[2] ?? url.searchParams.get("h");
    return { src: `https://player.vimeo.com/video/${m[1]}?dnt=1${hash ? `&h=${hash}` : ""}`, provider: "vimeo" };
  }
  return null;
}

/** True when a URL points at a known embeddable 3D viewer (Sketchfab, Matterport, Kuula, p3d…). */
export function embeddable3dUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^www\./, "");
  if (host === "sketchfab.com") {
    const m = url.pathname.match(/models\/([a-f0-9]{16,})/) ?? url.pathname.match(/3d-models\/[^/]*-([a-f0-9]{16,})/);
    return m ? `https://sketchfab.com/models/${m[1]}/embed?autostart=0&ui_infos=0` : null;
  }
  if (host === "my.matterport.com" || host === "matterport.com") {
    const id = url.searchParams.get("m");
    return id ? `https://my.matterport.com/show/?m=${encodeURIComponent(id)}&play=0` : null;
  }
  if (host === "kuula.co") return url.href;
  if (host === "p3d.in") return url.href.replace(/\/?$/, "").replace(/(p3d\.in\/)(?!e\/)/, "$1e/");
  if (host.endsWith("modelviewer.dev") || host.endsWith("3dviewer.net")) return url.href;
  return null;
}

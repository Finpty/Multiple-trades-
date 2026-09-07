/**
 * Business-timezone helpers for <input type="datetime-local"> / <input type="date">
 * round-trips. Values typed by the owner are interpreted in the business's
 * timezone and stored as UTC; stored UTC is formatted back in that timezone.
 */

function tzOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const local = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") === 24 ? 0 : get("hour"), get("minute"), get("second"));
  return local - date.getTime();
}

function safeZone(timeZone: string | null | undefined): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timeZone ?? undefined });
    return timeZone ?? "UTC";
  } catch {
    return "UTC";
  }
}

/** "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm" in the business timezone → UTC Date (null when empty/invalid). */
export function zonedToUtc(value: unknown, timeZone: string): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(value.trim());
  if (!m) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const [, y, mo, d, h = "00", mi = "00", s = "00"] = m;
  const asUtc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  const zone = safeZone(timeZone);
  const offset = tzOffsetMs(new Date(asUtc), zone);
  return new Date(asUtc - offset);
}

/** UTC Date → "YYYY-MM-DDTHH:mm" (or "YYYY-MM-DD") in the business timezone, for input defaults. */
export function utcToInput(date: Date | string | null | undefined, timeZone: string, withTime = true): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: safeZone(timeZone), hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour");
  const day = `${get("year")}-${get("month")}-${get("day")}`;
  return withTime ? `${day}T${hour}:${get("minute")}` : day;
}

/** Date-only columns (@db.Date) come back as UTC midnight; format them without shifting. */
export function dateOnlyToInput(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export function dateOnlyFromInput(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return null;
  const d = new Date(`${value.trim()}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtDateTime(date: Date | string | null | undefined, timeZone: string, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" }): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-AU", { ...opts, timeZone: safeZone(timeZone) }).format(d);
}

export function fmtDate(date: Date | string | null | undefined, timeZone: string): string {
  return fmtDateTime(date, timeZone, { dateStyle: "medium" });
}

export function fmtTime(date: Date | string | null | undefined, timeZone: string): string {
  return fmtDateTime(date, timeZone, { timeStyle: "short" });
}

/** Date-only columns: format in UTC so the calendar date is preserved. */
export function fmtDateOnly(date: Date | string | null | undefined): string {
  return fmtDateTime(date, "UTC", { dateStyle: "medium" });
}

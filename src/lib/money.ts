export function formatCents(cents: number | null | undefined, currency = "AUD", locale = "en-AU"): string {
  if (cents === null || cents === undefined) return "";
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}

export function toCents(amount: number | string | null | undefined): number {
  if (amount === null || amount === undefined || amount === "") return 0;
  const n = typeof amount === "string" ? Number.parseFloat(amount) : amount;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function roundCents(value: number): number {
  return Math.round(value);
}

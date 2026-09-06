export function JsonView({ value, className }: { value: unknown; className?: string }) {
  if (value === null || value === undefined) return <span className="text-xs text-neutral-400">—</span>;
  let text: string;
  try {
    text = JSON.stringify(value, null, 2);
  } catch {
    text = String(value);
  }
  return <pre className={`max-h-80 overflow-auto rounded-md bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-800 ${className ?? ""}`}>{text}</pre>;
}

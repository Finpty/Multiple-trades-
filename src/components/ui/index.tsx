import * as React from "react";
import Link from "next/link";
import clsx from "clsx";

/* ────────────────────────────────────────────────────────────────────────────
 * Shared admin UI kit. Plain React + Tailwind, server-component safe.
 * ──────────────────────────────────────────────────────────────────────────── */

export function cn(...inputs: Array<string | false | null | undefined>) {
  return clsx(inputs);
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "link";
type ButtonSize = "sm" | "md" | "lg";

const buttonBase = "inline-flex items-center justify-center gap-2 rounded-md font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/40 disabled:cursor-not-allowed disabled:opacity-50";
const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-neutral-900 text-white hover:bg-neutral-800",
  secondary: "border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50",
  ghost: "text-neutral-700 hover:bg-neutral-100",
  danger: "bg-red-600 text-white hover:bg-red-700",
  link: "text-neutral-900 underline-offset-4 hover:underline",
};
const buttonSizes: Record<ButtonSize, string> = { sm: "h-8 px-3 text-xs", md: "h-9 px-4 text-sm", lg: "h-11 px-5 text-base" };

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra?: string) {
  return cn(buttonBase, buttonVariants[variant], buttonSizes[size], extra);
}

export function Button({ variant = "primary", size = "md", className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({ variant = "primary", size = "md", className, href, ...props }: React.ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link href={href} className={buttonClass(variant, size, className)} {...props} />;
}

export const inputClass = "block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900 disabled:bg-neutral-100";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputClass, "min-h-[96px]", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(inputClass, "pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({ className, label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: React.ReactNode }) {
  return (
    <label className={cn("inline-flex items-center gap-2 text-sm text-neutral-800", className)}>
      <input type="checkbox" className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900" {...props} />
      {label}
    </label>
  );
}

export function Switch({ checked, name, label, description, disabled }: { checked: boolean; name: string; label: React.ReactNode; description?: React.ReactNode; disabled?: boolean }) {
  return (
    <label className={cn("flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-neutral-200 bg-white p-4", disabled && "opacity-60")}>
      <span>
        <span className="block text-sm font-medium text-neutral-900">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-neutral-500">{description}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input type="checkbox" name={name} defaultChecked={checked} disabled={disabled} className="peer sr-only" />
        <span className="h-6 w-11 rounded-full bg-neutral-300 transition peer-checked:bg-emerald-500" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export function Field({ label, htmlFor, hint, error, required, children, className }: { label: React.ReactNode; htmlFor?: string; hint?: React.ReactNode; error?: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-neutral-800">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-neutral-500">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-xl border border-neutral-200 bg-white shadow-sm", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ title, description, actions, className }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4", className)}>
      <div>
        <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-neutral-500">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}

type BadgeTone = "neutral" | "green" | "amber" | "red" | "blue" | "purple";
const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-neutral-100 text-neutral-700",
  green: "bg-emerald-100 text-emerald-800",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-800",
  blue: "bg-sky-100 text-sky-800",
  purple: "bg-violet-100 text-violet-800",
};

export function Badge({ tone = "neutral", className, children }: { tone?: BadgeTone; className?: string; children: React.ReactNode }) {
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", badgeTones[tone], className)}>{children}</span>;
}

export function statusTone(status: string): BadgeTone {
  const s = status.toUpperCase();
  if (["PUBLISHED", "ACTIVE", "VERIFIED", "ACCEPTED", "PAID", "SUCCEEDED", "WON", "COMPLETED", "CONFIRMED", "SUCCESS", "PROCESSED"].includes(s)) return "green";
  if (["DRAFT", "PENDING", "SENT", "VIEWED", "TRIALING", "NEW", "REQUESTED", "SCHEDULED", "OPEN", "INVITED"].includes(s)) return "amber";
  if (["SUSPENDED", "FAILED", "DECLINED", "LOST", "CANCELED", "VOID", "OVERDUE", "ERROR", "DELETED", "PAST_DUE"].includes(s)) return "red";
  if (["ARCHIVED", "EXPIRED", "SKIPPED", "PAUSED"].includes(s)) return "neutral";
  return "blue";
}

export function PageHeader({ title, description, actions, breadcrumbs }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; breadcrumbs?: Array<{ label: string; href?: string }> }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="mb-1 flex flex-wrap items-center gap-1 text-xs text-neutral-500">
            {breadcrumbs.map((b, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span>/</span>}
                {b.href ? (
                  <Link href={b.href} className="hover:text-neutral-900">{b.label}</Link>
                ) : (
                  <span>{b.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-neutral-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, description, action, icon }: { title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-12 text-center">
      {icon && <div className="mb-3 text-neutral-400">{icon}</div>}
      <h3 className="text-base font-medium text-neutral-900">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-neutral-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Table({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("overflow-x-auto rounded-xl border border-neutral-200 bg-white", className)}>
      <table className="min-w-full divide-y divide-neutral-200 text-sm">{children}</table>
    </div>
  );
}
export function THead({ children }: { children: React.ReactNode }) {
  return <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">{children}</thead>;
}
export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-neutral-100">{children}</tbody>;
}
export function Th({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <th className={cn("px-4 py-3", className)}>{children}</th>;
}
export function Td({ className, children, colSpan }: { className?: string; children?: React.ReactNode; colSpan?: number }) {
  return <td className={cn("px-4 py-3 align-middle text-neutral-800", className)} colSpan={colSpan}>{children}</td>;
}

export function Stat({ label, value, hint, tone }: { label: React.ReactNode; value: React.ReactNode; hint?: React.ReactNode; tone?: BadgeTone }) {
  return (
    <Card className="p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={cn("mt-2 text-3xl font-semibold tracking-tight", tone === "green" && "text-emerald-700", tone === "red" && "text-red-700")}>{value}</div>
      {hint && <div className="mt-1 text-xs text-neutral-500">{hint}</div>}
    </Card>
  );
}

export function Alert({ tone = "neutral", title, children, className }: { tone?: "neutral" | "info" | "success" | "warning" | "danger"; title?: React.ReactNode; children?: React.ReactNode; className?: string }) {
  const tones = {
    neutral: "border-neutral-200 bg-neutral-50 text-neutral-800",
    info: "border-sky-200 bg-sky-50 text-sky-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-red-200 bg-red-50 text-red-900",
  } as const;
  return (
    <div role={tone === "danger" ? "alert" : undefined} className={cn("rounded-lg border px-4 py-3 text-sm", tones[tone], className)}>
      {title && <div className="font-medium">{title}</div>}
      {children && <div className={cn(title ? "mt-1" : undefined)}>{children}</div>}
    </div>
  );
}

export function Tabs({ items, current }: { items: Array<{ label: string; href: string; key: string }>; current: string }) {
  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-neutral-200">
      {items.map((t) => (
        <Link key={t.key} href={t.href} className={cn("whitespace-nowrap border-b-2 px-3 py-2 text-sm", t.key === current ? "border-neutral-900 font-medium text-neutral-900" : "border-transparent text-neutral-500 hover:text-neutral-900")}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export function Description({ items }: { items: Array<{ label: React.ReactNode; value: React.ReactNode }> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map((it, i) => (
        <div key={i}>
          <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">{it.label}</dt>
          <dd className="mt-0.5 text-sm text-neutral-900">{it.value ?? <span className="text-neutral-400">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

export function formatDate(d: Date | string | null | undefined, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" }): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-AU", opts).format(typeof d === "string" ? new Date(d) : d);
}

export function formatDateTime(d: Date | string | null | undefined): string {
  return formatDate(d, { dateStyle: "medium", timeStyle: "short" });
}

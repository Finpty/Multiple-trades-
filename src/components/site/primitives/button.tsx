import Link from "next/link";
import type { ThemeTokens } from "@/lib/theme/tokens";

export type ButtonVariant = "primary" | "secondary" | "link";

/**
 * Site button. Colours come from theme variables; the shape comes from the
 * theme's buttonStyle token (solid / outline / pill / ghost) via CSS classes
 * defined in globals.css (site blocks section).
 */
export function SiteButton({
  href,
  children,
  variant = "primary",
  buttonStyle = "solid",
  size = "md",
  className = "",
  editField,
  onDark = false,
  type,
  disabled,
  ...rest
}: {
  href?: string;
  children: React.ReactNode;
  variant?: ButtonVariant;
  buttonStyle?: ThemeTokens["buttonStyle"];
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Marks the label as editable text (prop path). */
  editField?: string;
  /** Use on primary/dark section backgrounds. */
  onDark?: boolean;
  type?: "button" | "submit";
  disabled?: boolean;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className" | "children" | "type">) {
  const classes = ["site-btn", `site-btn--${variant}`, `site-btn--style-${buttonStyle}`, `site-btn--${size}`, onDark ? "site-btn--on-dark" : "", className].filter(Boolean).join(" ");
  const label = editField ? <span data-edit-field={editField}>{children}</span> : children;
  if (!href) {
    return (
      <button type={type ?? "button"} className={classes} disabled={disabled} {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
        {label}
      </button>
    );
  }
  const internal = href.startsWith("/") && !href.startsWith("//");
  if (internal) {
    return (
      <Link href={href} className={classes} {...rest}>
        {label}
      </Link>
    );
  }
  const external = /^https?:\/\//i.test(href);
  return (
    <a href={href} className={classes} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} {...rest}>
      {label}
    </a>
  );
}

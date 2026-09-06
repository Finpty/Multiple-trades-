import Link from "next/link";

/**
 * Surface card. Sets its own background and text colour so it reads correctly
 * on any section background (default, surface, primary or dark).
 */
export function SiteCard({ children, className = "", href, padded = true, interactive = false, highlighted = false, style, ...rest }: { children: React.ReactNode; className?: string; href?: string; padded?: boolean; interactive?: boolean; highlighted?: boolean; style?: React.CSSProperties } & Omit<React.HTMLAttributes<HTMLDivElement>, "className" | "children" | "style">) {
  const classes = ["site-card flex flex-col overflow-hidden", padded ? "p-6" : "", interactive || href ? "site-card--interactive" : "", highlighted ? "site-card--highlight" : "", className].filter(Boolean).join(" ");
  const styles: React.CSSProperties = {
    background: "var(--color-background)",
    color: "var(--color-text)",
    borderRadius: "var(--radius)",
    border: "var(--border-width) solid var(--color-border)",
    ...style,
  };
  if (href) {
    return (
      <Link href={href} className={classes} style={styles}>
        {children}
      </Link>
    );
  }
  return (
    <div className={classes} style={styles} {...rest}>
      {children}
    </div>
  );
}

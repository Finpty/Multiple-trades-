"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ChevronDown, Menu, Phone, X } from "lucide-react";

/** Element id of the overlay mount point rendered by the site layout. */
export const OVERLAY_ROOT_ID = "site-overlay-root";

export interface MobileNavItem {
  id: string;
  label: string;
  href: string;
  children: Array<{ id: string; label: string; href: string }>;
}

/**
 * Slide-in mobile navigation. Renders the hamburger button in the header
 * and a panel with an accordion for nested items. Pure client state, no
 * data fetching — everything arrives as serialisable props.
 */
export function MobileNav({ items, cta, phone, brand, logoUrl }: { items: MobileNavItem[]; cta: { label: string; href: string } | null; phone: { label: string; href: string } | null; brand: string; logoUrl: string | null }) {
  const [open, setOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  // The sticky header uses backdrop-filter, which would make it the containing
  // block for the fixed panel; portal into the overlay root inside .site-root
  // so the panel covers the viewport and still inherits the theme variables.
  const [overlayRoot, setOverlayRoot] = React.useState<HTMLElement | null>(null);
  React.useEffect(() => {
    setOverlayRoot(document.getElementById(OVERLAY_ROOT_ID) ?? document.body);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("a,button")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius)] border md:hidden" style={{ borderColor: "var(--color-border)" }} aria-label="Open menu" aria-expanded={open} aria-controls="site-mobile-nav">
        <Menu className="h-5 w-5" aria-hidden />
      </button>

      {overlayRoot && createPortal(
      <div className={`fixed inset-0 z-50 md:hidden ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
        <div className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`} onClick={() => setOpen(false)} />
        <div
          id="site-mobile-nav"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className={`absolute inset-y-0 right-0 flex w-[min(22rem,88vw)] flex-col shadow-2xl transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
          style={{ background: "var(--color-background)", color: "var(--color-text)" }}
        >
          <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "var(--color-border)" }}>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={brand} className="h-8 w-auto max-w-[150px] object-contain" />
            ) : (
              <span className="text-base font-semibold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary)" }}>{brand}</span>
            )}
            <button type="button" onClick={() => setOpen(false)} className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius)] border" style={{ borderColor: "var(--color-border)" }} aria-label="Close menu">
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Mobile">
            <ul className="space-y-0.5">
              {items.map((it) => {
                const isOpen = expanded === it.id;
                return (
                  <li key={it.id}>
                    <div className="flex items-center">
                      <Link href={it.href} onClick={() => setOpen(false)} className="flex-1 rounded-[var(--radius)] px-3 py-2.5 text-base font-medium hover:bg-[var(--color-surface)]">
                        {it.label}
                      </Link>
                      {it.children.length > 0 && (
                        <button type="button" onClick={() => setExpanded(isOpen ? null : it.id)} className="mr-1 inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius)] hover:bg-[var(--color-surface)]" aria-label={`${isOpen ? "Collapse" : "Expand"} ${it.label}`} aria-expanded={isOpen}>
                          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden />
                        </button>
                      )}
                    </div>
                    {it.children.length > 0 && (
                      <ul className={`ml-3 overflow-hidden border-l pl-2 transition-all ${isOpen ? "max-h-[60vh] py-1" : "max-h-0"}`} style={{ borderColor: "var(--color-border)" }}>
                        {it.children.map((c) => (
                          <li key={c.id}>
                            <Link href={c.href} onClick={() => setOpen(false)} className="block rounded-[var(--radius)] px-3 py-2 text-sm opacity-90 hover:bg-[var(--color-surface)]">
                              {c.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          {(cta || phone) && (
            <div className="space-y-2 border-t px-5 py-4" style={{ borderColor: "var(--color-border)" }}>
              {phone && (
                <a href={phone.href} data-track="phone_click" className="flex items-center justify-center gap-2 rounded-[var(--radius)] border px-4 py-2.5 text-sm font-medium" style={{ borderColor: "var(--color-border)" }}>
                  <Phone className="h-4 w-4" aria-hidden />
                  {phone.label}
                </a>
              )}
              {cta && (
                <Link href={cta.href} data-track="cta_click" onClick={() => setOpen(false)} className="block rounded-[var(--radius)] px-4 py-2.5 text-center text-sm font-semibold text-white" style={{ background: "var(--color-accent)" }}>
                  {cta.label}
                </Link>
              )}
            </div>
          )}
        </div>
      </div>,
      overlayRoot)}
    </>
  );
}

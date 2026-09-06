"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/admin/nav";
import { Icon } from "./icon";
import { cn } from "@/components/ui";

export function AdminShell({
  brand,
  brandHref,
  items,
  user,
  topRight,
  children,
  subtitle,
}: {
  brand: React.ReactNode;
  brandHref: string;
  items: NavItem[];
  user: { name: string; email: string };
  topRight?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const groups = React.useMemo(() => {
    const map = new Map<string, NavItem[]>();
    for (const it of items) {
      const g = it.group ?? "";
      map.set(g, [...(map.get(g) ?? []), it]);
    }
    return [...map.entries()];
  }, [items]);

  const isActive = (href: string) => {
    if (pathname === href) return true;
    // Longest-prefix match so /website/pages doesn't also light up /website.
    const candidates = items.filter((i) => pathname.startsWith(i.href + "/") || pathname === i.href).sort((a, b) => b.href.length - a.href.length);
    return candidates[0]?.href === href;
  };

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <aside className={cn("fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-neutral-200 bg-white transition-transform lg:static lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex h-14 items-center gap-2 border-b border-neutral-200 px-4">
          <Link href={brandHref} className="truncate text-sm font-semibold tracking-tight">
            {brand}
          </Link>
        </div>
        {subtitle && <div className="border-b border-neutral-200 px-4 py-2 text-xs text-neutral-500">{subtitle}</div>}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {groups.map(([group, list]) => (
            <div key={group} className="mb-3">
              {group && <div className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{group}</div>}
              {list.map((it) => (
                <Link
                  key={it.key}
                  href={it.href}
                  onClick={() => setOpen(false)}
                  className={cn("flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm", isActive(it.href) ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-100")}
                >
                  <Icon name={it.icon} className="h-4 w-4 shrink-0" />
                  <span className="truncate">{it.label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="border-t border-neutral-200 p-3 text-xs">
          <div className="truncate font-medium text-neutral-900">{user.name}</div>
          <div className="truncate text-neutral-500">{user.email}</div>
          <a href="/logout" className="mt-2 inline-block text-neutral-600 underline-offset-2 hover:underline">Sign out</a>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setOpen(false)} />}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 lg:px-6">
          <button className="rounded-md p-2 hover:bg-neutral-100 lg:hidden" onClick={() => setOpen((o) => !o)} aria-label="Toggle navigation">
            <Icon name="Menu" className="h-5 w-5" />
          </button>
          <div className="flex flex-1 items-center justify-end gap-3">{topRight}</div>
        </header>
        <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

"use client";

import { usePathname } from "next/navigation";
import { Tabs } from "@/components/ui";

const TABS = [
  { key: "details", label: "Details", path: "" },
  { key: "members", label: "Members", path: "/members" },
  { key: "organisation", label: "Organisation", path: "/organisation" },
  { key: "domains", label: "Domains", path: "/domains" },
  { key: "features", label: "Features", path: "/features" },
  { key: "subscriptions", label: "Subscriptions", path: "/subscriptions" },
  { key: "activity", label: "Activity", path: "/activity" },
];

export function BusinessTabs({ businessId }: { businessId: string }) {
  const pathname = usePathname();
  const base = `/super-admin/businesses/${businessId}`;
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : "";
  const current = TABS.filter((t) => t.path && rest.startsWith(t.path)).sort((a, b) => b.path.length - a.path.length)[0]?.key ?? "details";
  return <Tabs items={TABS.map((t) => ({ key: t.key, label: t.label, href: `${base}${t.path}` }))} current={current} />;
}

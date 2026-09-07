import { Tabs } from "@/components/ui";

export function SettingsTabs({ businessId, current }: { businessId: string; current: string }) {
  const b = `/admin/${businessId}/settings`;
  return <Tabs current={current} items={[{ key: "details", label: "Details", href: b }, { key: "locations", label: "Locations", href: `${b}/locations` }, { key: "terminology", label: "Terminology", href: `${b}/terminology` }, { key: "notifications", label: "Notifications & payments", href: `${b}/notifications` }, { key: "export", label: "Export", href: `${b}/export` }, { key: "danger", label: "Danger zone", href: `${b}/danger` }]} />;
}

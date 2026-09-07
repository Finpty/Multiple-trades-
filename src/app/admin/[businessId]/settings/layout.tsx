import { PageHeader } from "@/components/ui";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader title="Settings" description="Business details, locations, terminology, notifications and lifecycle." />
      {children}
    </>
  );
}

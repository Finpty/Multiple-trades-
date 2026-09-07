import { requireBusinessAccess } from "@/lib/authz";
import { SettingsTabs } from "@/components/admin/config/settings-tabs";
import { DetailsForm } from "@/components/admin/config/settings-forms";
import { saveDetailsAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsDetailsPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const ctx = await requireBusinessAccess(businessId, "business.settings");
  const b = ctx.business;
  const initial = { name: b.name, slug: b.slug, legalName: b.legalName, tradingName: b.tradingName, businessNumber: b.businessNumber, taxNumber: b.taxNumber, phone: b.phone, email: b.email, website: b.website, tagline: b.tagline, description: b.description, foundedYear: b.foundedYear, country: b.country, state: b.state, timezone: b.timezone, currency: b.currency, locale: b.locale, taxName: b.taxName, taxRate: Number(b.taxRate), taxInclusive: b.taxInclusive, serviceAreaText: b.serviceAreaText };
  return (
    <>
      <SettingsTabs businessId={businessId} current="details" />
      <DetailsForm action={saveDetailsAction.bind(null, businessId)} initial={initial} />
    </>
  );
}

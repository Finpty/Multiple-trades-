import { requireBusinessAccess } from "@/lib/authz";
import { SettingsTabs } from "@/components/admin/config/settings-tabs";
import { LocationsManager } from "@/components/admin/config/locations-manager";
import { deleteLocationAction, saveLocationAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Locations" };

export default async function LocationsPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const ctx = await requireBusinessAccess(businessId, "business.settings");
  const rows = await ctx.db.businessLocation.findMany({ where: { businessId }, orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] });
  return (
    <>
      <SettingsTabs businessId={businessId} current="locations" />
      <LocationsManager
        locations={rows.map((r) => ({ ...r, lat: r.lat === null ? null : Number(r.lat), lng: r.lng === null ? null : Number(r.lng), openingHours: r.openingHours as unknown[], createdAt: undefined, updatedAt: undefined, deletedAt: undefined }))}
        save={saveLocationAction.bind(null, businessId)}
        remove={deleteLocationAction.bind(null, businessId)}
      />
    </>
  );
}

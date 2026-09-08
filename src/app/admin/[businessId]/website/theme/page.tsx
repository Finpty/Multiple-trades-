import { requireBusinessAccess } from "@/lib/authz";
import { getThemeView, listThemeRevisions } from "@/lib/website/theme";
import { publicSiteUrl } from "@/lib/tenant/resolve";
import { PageHeader } from "@/components/ui";
import { ThemeBuilder } from "@/components/editor/theme/theme-builder";
import { publishThemeAction, restoreThemeRevisionAction, saveThemeAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Brand & theme" };

export default async function ThemePage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const ctx = await requireBusinessAccess(businessId, "website.edit");
  const [theme, revisions] = await Promise.all([getThemeView(ctx.db, businessId), listThemeRevisions(ctx.db, businessId)]);
  const b = `/admin/${businessId}/website`;
  return (
    <>
      <PageHeader title="Brand & theme" description="Pick a design family, then tune colours, type and details. The preview updates as you change things; publish when you are happy." breadcrumbs={[{ label: "Website", href: b }, { label: "Brand & theme" }]} />
      <ThemeBuilder
        businessId={businessId}
        theme={theme}
        revisions={revisions}
        previewUrl={`${publicSiteUrl(ctx.business, null)}?__preview=draft&__editor=theme`}
        canPublish={ctx.can("website.publish")}
        actions={{ save: saveThemeAction, publish: publishThemeAction, restore: restoreThemeRevisionAction }}
      />
    </>
  );
}

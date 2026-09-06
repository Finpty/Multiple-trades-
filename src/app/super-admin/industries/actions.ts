"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/authz";
import { fail, formToObject, ok, runAction, type ActionResult } from "@/lib/actions";
import { bool, num, optStr, str } from "@/lib/actions";
import { IndustryGeneralSchema, createIndustry, deleteIndustry, duplicateIndustry, setIndustryActive, updateIndustryGeneral, updateIndustrySection, type IndustrySection } from "@/lib/platform/industries";

function generalInput(formData: FormData) {
  const o = formToObject(formData);
  return IndustryGeneralSchema.parse({ name: str(o.name), slug: optStr(o.slug), description: str(o.description), icon: str(o.icon) || "wrench", isActive: bool(o.isActive), sortOrder: num(o.sortOrder) ?? 0 });
}

export async function createIndustryAction(_prev: ActionResult<{ id: string }> | undefined, formData: FormData): Promise<ActionResult<{ id: string }>> {
  let id: string | null = null;
  const result = await runAction(async () => {
    const { user } = await requirePlatformAdmin("ADMIN", { throwOnly: true });
    const row = await createIndustry(generalInput(formData), user.id);
    id = row.id;
    return ok({ id: row.id });
  });
  if (result.ok && id) {
    revalidatePath("/super-admin/industries");
    redirect(`/super-admin/industries/${id}`);
  }
  return result;
}

export async function updateGeneralAction(industryId: string, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { user } = await requirePlatformAdmin("ADMIN", { throwOnly: true });
    await updateIndustryGeneral(industryId, generalInput(formData), user.id);
    revalidatePath(`/super-admin/industries/${industryId}`);
    revalidatePath("/super-admin/industries");
    return ok(undefined, "Saved");
  });
}

export async function updateSectionAction(industryId: string, section: IndustrySection, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { user } = await requirePlatformAdmin("ADMIN", { throwOnly: true });
    const o = formToObject(formData);
    if (o.data === undefined) return fail("Nothing to save.");
    await updateIndustrySection(industryId, section, o.data, user.id);
    revalidatePath(`/super-admin/industries/${industryId}`);
    return ok(undefined, "Saved");
  });
}

export async function duplicateIndustryAction(industryId: string): Promise<void> {
  const { user } = await requirePlatformAdmin("ADMIN", { throwOnly: true });
  const row = await duplicateIndustry(industryId, user.id);
  revalidatePath("/super-admin/industries");
  redirect(`/super-admin/industries/${row.id}`);
}

export async function toggleActiveAction(industryId: string, isActive: boolean): Promise<void> {
  const { user } = await requirePlatformAdmin("ADMIN", { throwOnly: true });
  await setIndustryActive(industryId, isActive, user.id);
  revalidatePath("/super-admin/industries");
  revalidatePath(`/super-admin/industries/${industryId}`);
}

export async function deleteIndustryAction(industryId: string): Promise<ActionResult> {
  return runAction(async () => {
    const { user } = await requirePlatformAdmin("ADMIN", { throwOnly: true });
    const r = await deleteIndustry(industryId, user.id);
    if (!r.ok) return fail(r.reason);
    revalidatePath("/super-admin/industries");
    redirect("/super-admin/industries");
  });
}

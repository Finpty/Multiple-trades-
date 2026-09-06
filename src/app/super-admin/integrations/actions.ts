"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/authz";
import { bool, formToObject, ok, runAction, str, type ActionResult } from "@/lib/actions";
import { isUuid } from "@/lib/ids";
import {
  IntegrationInputSchema,
  createPlatformIntegration,
  deletePlatformIntegration,
  parseSecretPairs,
  setPlatformIntegrationEnabled,
  updatePlatformIntegration,
} from "@/lib/platform/integrations";

function revalidate(id?: string) {
  revalidatePath("/super-admin/integrations");
  if (id) revalidatePath(`/super-admin/integrations/${id}`);
}

function parseInput(formData: FormData) {
  const raw = formToObject(formData);
  const input = IntegrationInputSchema.parse({ ...raw, isEnabled: bool(raw.isEnabled) });
  const secrets = parseSecretPairs(raw.secretKey, raw.secretValue);
  return { input, secrets };
}

function integrationIdFrom(formData: FormData): string {
  const id = str(formData.get("integrationId"));
  if (!isUuid(id)) throw new Error("Invalid integration id.");
  return id;
}

export async function createIntegrationAction(_prev: ActionResult<{ id: string }> | undefined, formData: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const { user } = await requirePlatformAdmin("ADMIN", { throwOnly: true });
    const { input, secrets } = parseInput(formData);
    const row = await createPlatformIntegration(input, secrets, user.id);
    revalidate(row.id);
    return ok({ id: row.id }, "Integration created.");
  });
}

export async function updateIntegrationAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { user } = await requirePlatformAdmin("ADMIN", { throwOnly: true });
    const id = integrationIdFrom(formData);
    const { input, secrets } = parseInput(formData);
    await updatePlatformIntegration(id, input, secrets, user.id);
    revalidate(id);
    return ok(undefined, "Integration saved.");
  });
}

export async function toggleIntegrationAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { user } = await requirePlatformAdmin("ADMIN", { throwOnly: true });
    const id = integrationIdFrom(formData);
    const enable = str(formData.get("enable")) === "true";
    await setPlatformIntegrationEnabled(id, enable, user.id);
    revalidate(id);
    return ok(undefined, enable ? "Integration enabled." : "Integration disabled.");
  });
}

export async function deleteIntegrationAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { user } = await requirePlatformAdmin("ADMIN", { throwOnly: true });
    const id = integrationIdFrom(formData);
    await deletePlatformIntegration(id, user.id);
    revalidate(id);
    return ok(undefined, "Integration deleted.");
  });
}

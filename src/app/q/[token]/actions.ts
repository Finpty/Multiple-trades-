"use server";

import { z } from "zod";
import { ok, runAction, str, type ActionResult } from "@/lib/actions";
import { RateLimitError, enforceRateLimit } from "@/lib/auth/rate-limit";
import { headers } from "next/headers";
import { acceptQuote, declineQuote, loadPublicQuote } from "@/lib/operations/quotes";

const TokenSchema = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/);

async function limit(action: string) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  try {
    await enforceRateLimit(`public-quote:${action}`, ip, { limit: 20, windowSeconds: 60 * 60 });
  } catch (e) {
    if (e instanceof RateLimitError) throw new Error("Too many attempts. Please try again later.");
    throw e;
  }
}

/** Customer accepts the quote from the public page. The token is the credential. */
export async function acceptPublicQuoteAction(token: string, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    await limit("accept");
    const quote = await loadPublicQuote(TokenSchema.parse(token));
    if (!quote) throw new Error("This quote is no longer available.");
    const name = str(formData.get("name")).trim();
    if (name.length < 2) throw new z.ZodError([{ code: "custom", path: ["name"], message: "Please type your full name to sign." }]);
    if (formData.get("agree") !== "on") throw new z.ZodError([{ code: "custom", path: ["agree"], message: "Please confirm you accept the quote and terms." }]);
    const h = await headers();
    await acceptQuote(quote.businessId, quote.id, { actorUserId: null, acceptedByName: name, source: "public", signature: { typedName: name, ip: h.get("x-forwarded-for") ?? null, userAgent: h.get("user-agent") ?? null } });
    return ok(undefined, "Quote accepted");
  });
}

export async function declinePublicQuoteAction(token: string, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    await limit("decline");
    const quote = await loadPublicQuote(TokenSchema.parse(token));
    if (!quote) throw new Error("This quote is no longer available.");
    await declineQuote(quote.businessId, quote.id, { actorUserId: null, reason: str(formData.get("reason")).slice(0, 1000), source: "public" });
    return ok(undefined, "Quote declined");
  });
}

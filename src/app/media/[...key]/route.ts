import { NextResponse, type NextRequest } from "next/server";
import { Readable } from "node:stream";
import { platformDb } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { verifyLocalSignature } from "@/lib/storage/local";
import { getCurrentSession } from "@/lib/auth/session";
import { getBusinessAccess } from "@/lib/authz";

export const dynamic = "force-dynamic";

/**
 * Serves stored objects. PUBLIC objects are served to anyone (long cache).
 * PRIVATE objects require either a valid signed URL or an authorised session
 * for the owning business. Keys are always prefixed by the business id.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const { key: parts } = await params;
  const key = parts.map(decodeURIComponent).join("/");
  if (key.includes("..")) return new NextResponse("Bad request", { status: 400 });

  const media = await platformDb.media.findFirst({ where: { storageKey: key }, select: { visibility: true, mimeType: true, businessId: true, storageDriver: true } });
  if (!media) return new NextResponse("Not found", { status: 404 });

  if (media.visibility === "PRIVATE") {
    const sp = request.nextUrl.searchParams;
    const signed = verifyLocalSignature(key, sp.get("expires"), sp.get("sig"));
    if (!signed) {
      const { user } = await getCurrentSession();
      const access = user ? await getBusinessAccess(user.id, media.businessId) : null;
      if (!access) return new NextResponse("Not found", { status: 404 });
    }
  }

  const storage = await getStorage(media.storageDriver);
  const object = await storage.get(key);
  if (!object) return new NextResponse("Not found", { status: 404 });
  const headers = new Headers({
    "content-type": object.contentType ?? media.mimeType,
    "cache-control": media.visibility === "PUBLIC" ? "public, max-age=31536000, immutable" : "private, no-store",
  });
  if (object.contentLength) headers.set("content-length", String(object.contentLength));
  return new NextResponse(Readable.toWeb(object.body) as ReadableStream, { headers });
}

import { NextResponse, type NextRequest } from "next/server";
import { runCron } from "@/lib/cron/run";
import { getPlatformSetting } from "@/lib/platform/settings";
import { timingSafeEqual } from "@/lib/crypto";
import { clientIp } from "@/lib/site/public-guard";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET|POST /api/cron — run scheduled maintenance. Schedule it every 5 minutes
 * (system cron, Vercel cron, GitHub Actions…). Authentication: header
 * `x-cron-secret` matching env CRON_SECRET or platform setting cron.secret.
 * When neither is configured only localhost may trigger it.
 */
async function handle(request: NextRequest) {
  const provided = request.headers.get("x-cron-secret") ?? request.nextUrl.searchParams.get("secret") ?? "";
  const configured = process.env.CRON_SECRET || (await getPlatformSetting<string>("cron.secret", ""));
  const ip = clientIp(request);
  const local = ip === "127.0.0.1" || ip === "::1" || ip === "0.0.0.0" || ip.startsWith("::ffff:127.");
  const authorised = configured ? provided.length > 0 && timingSafeEqual(provided, configured) : local;
  if (!authorised) return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  const report = await runCron();
  return NextResponse.json({ ok: report.results.every((r) => r.ok), ...report });
}

export const GET = handle;
export const POST = handle;

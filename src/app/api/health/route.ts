import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness + database connectivity. Never touches any AI provider. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "up", time: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ ok: false, db: "down", error: error instanceof Error ? error.message : String(error) }, { status: 503 });
  }
}

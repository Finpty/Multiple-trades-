import { NextResponse } from "next/server";
import { logout } from "@/lib/auth/service";

export async function GET(request: Request) {
  await logout();
  return NextResponse.redirect(new URL("/login", request.url));
}

export async function POST(request: Request) {
  await logout();
  return NextResponse.redirect(new URL("/login", request.url));
}

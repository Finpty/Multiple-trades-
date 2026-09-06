import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/authz";

export default async function PlatformHome() {
  const user = await getCurrentUser();
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">TRADE ONE</h1>
      <p className="text-neutral-600">One platform, many trade businesses. Every business site, admin and workflow on this host is generated from stored configuration.</p>
      <div className="flex flex-wrap gap-3">
        {user ? (
          <>
            <Link href="/admin" className="rounded-md bg-neutral-900 px-4 py-2 text-white">Business admin</Link>
            {isPlatformAdmin(user) && <Link href="/super-admin" className="rounded-md border px-4 py-2">Super admin</Link>}
            <Link href="/logout" className="rounded-md border px-4 py-2">Sign out</Link>
          </>
        ) : (
          <Link href="/login" className="rounded-md bg-neutral-900 px-4 py-2 text-white">Sign in</Link>
        )}
      </div>
    </main>
  );
}

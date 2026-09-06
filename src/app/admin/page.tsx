import Link from "next/link";
import { requireUser, listAccessibleBusinesses, isPlatformAdmin } from "@/lib/authz";
import { Badge, Card, EmptyState, statusTone } from "@/components/ui";

export const metadata = { title: "Your businesses" };

export default async function AdminIndex() {
  const user = await requireUser("/admin");
  const businesses = await listAccessibleBusinesses(user);
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your businesses</h1>
          <p className="text-sm text-neutral-500">Signed in as {user.email}</p>
        </div>
        <div className="flex gap-3 text-sm">
          {isPlatformAdmin(user) && <Link href="/super-admin" className="text-neutral-700 underline-offset-2 hover:underline">Super admin</Link>}
          <a href="/logout" className="text-neutral-700 underline-offset-2 hover:underline">Sign out</a>
        </div>
      </div>
      {businesses.length === 0 ? (
        <EmptyState title="No businesses yet" description="Ask your organisation owner for access, or create a business from the Super Admin." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {businesses.map((b) => (
            <Link key={b.id} href={`/admin/${b.id}`}>
              <Card className="p-5 transition hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{b.name}</div>
                    <div className="text-sm text-neutral-500">{b.industry?.name ?? "—"} · /{b.slug}</div>
                  </div>
                  <Badge tone={statusTone(b.status)}>{b.status}</Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

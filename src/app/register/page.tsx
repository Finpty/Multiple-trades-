import { redirect } from "next/navigation";
import { getPlatformSetting } from "@/lib/platform/settings";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthForm } from "../auth/auth-form";
import { registerAction } from "../auth/actions";

export const metadata = { title: "Create account" };
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/admin");
  const enabled = await getPlatformSetting<boolean>("registration.enabled", false);
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-xl border bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-2xl font-semibold">Create an account</h1>
        {enabled ? (
          <>
            <p className="mb-6 text-sm text-neutral-500">You will be able to join businesses you are invited to.</p>
            <AuthForm action={registerAction} fields={[{ name: "name", label: "Name", autoComplete: "name" }, { name: "email", label: "Email", type: "email", autoComplete: "email" }, { name: "password", label: "Password", type: "password", autoComplete: "new-password", minLength: 10 }]} submitLabel="Create account" pendingLabel="Creating…" footer={<a href="/login" className="underline">Already have an account? Sign in</a>} />
          </>
        ) : (
          <p className="text-sm text-neutral-500">Self-registration is closed. Ask your business owner or the platform team for an invitation.</p>
        )}
      </div>
    </main>
  );
}

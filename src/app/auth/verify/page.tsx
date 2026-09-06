import { verifyEmailToken } from "@/lib/auth/service";

export const metadata = { title: "Verify email" };
export const dynamic = "force-dynamic";

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const ok = token ? await verifyEmailToken(token) : false;
  return (
    <>
      <h1 className="mb-2 text-2xl font-semibold">{ok ? "Email verified" : "Link invalid or expired"}</h1>
      <p className="mb-6 text-sm text-neutral-500">{ok ? "Thanks — your email address is confirmed." : "Request a new verification email from your account settings."}</p>
      <a href="/login" className="block w-full rounded-md bg-neutral-900 px-4 py-2 text-center text-white">Continue to sign in</a>
    </>
  );
}

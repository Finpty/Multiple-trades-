import { prisma } from "@/lib/db";
import { sha256Hex } from "@/lib/crypto";
import { AuthForm } from "../auth-form";
import { acceptInviteAction } from "../actions";

export const metadata = { title: "Accept invitation" };
export const dynamic = "force-dynamic";

export default async function AcceptInvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token) return <p className="text-sm text-red-600">This invitation link is missing its token.</p>;
  // Peek (without consuming) so the form can adapt to existing users.
  const record = await prisma.authToken.findUnique({ where: { tokenHash: sha256Hex(token) }, include: { user: { select: { passwordHash: true, name: true } } } });
  const valid = record && record.type === "INVITE" && !record.usedAt && record.expiresAt > new Date();
  if (!valid) return <p className="text-sm text-red-600">This invitation is invalid or has expired. Ask the person who invited you to send a new one.</p>;
  const existingUser = record.user ?? (await prisma.user.findUnique({ where: { email: record.email }, select: { passwordHash: true, name: true } }));
  const needsPassword = !existingUser?.passwordHash;
  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold">You&apos;re invited</h1>
      <p className="mb-6 text-sm text-neutral-500">{needsPassword ? `Create your account for ${record.email}.` : `Accept the invitation for ${record.email}.`}</p>
      <AuthForm
        action={acceptInviteAction}
        hidden={{ token }}
        fields={needsPassword ? [{ name: "name", label: "Your name", autoComplete: "name" }, { name: "password", label: "Choose a password", type: "password", autoComplete: "new-password", minLength: 10 }] : []}
        submitLabel={needsPassword ? "Create account" : "Accept invitation"}
        pendingLabel="Working…"
      />
    </>
  );
}

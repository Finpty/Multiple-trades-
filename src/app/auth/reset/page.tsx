import { AuthForm } from "../auth-form";
import { resetAction } from "../actions";

export const metadata = { title: "Choose a new password" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token) return <p className="text-sm text-red-600">This reset link is missing its token. Request a new one from the sign-in page.</p>;
  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold">Choose a new password</h1>
      <p className="mb-6 text-sm text-neutral-500">At least 10 characters. You will be signed out everywhere.</p>
      <AuthForm
        action={resetAction}
        hidden={{ token }}
        fields={[
          { name: "password", label: "New password", type: "password", autoComplete: "new-password", minLength: 10 },
          { name: "confirm", label: "Confirm password", type: "password", autoComplete: "new-password", minLength: 10 },
        ]}
        submitLabel="Set new password"
        pendingLabel="Saving…"
      />
    </>
  );
}

import { AuthForm } from "../auth-form";
import { forgotAction } from "../actions";

export const metadata = { title: "Reset your password" };

export default function ForgotPage() {
  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold">Forgot your password?</h1>
      <p className="mb-6 text-sm text-neutral-500">Enter your email and we will send you a reset link.</p>
      <AuthForm action={forgotAction} fields={[{ name: "email", label: "Email", type: "email", autoComplete: "email" }]} submitLabel="Send reset link" pendingLabel="Sending…" footer={<a href="/login" className="underline">Back to sign in</a>} />
    </>
  );
}

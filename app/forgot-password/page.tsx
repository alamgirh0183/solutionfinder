import AuthCard from "@/components/auth-card";
import AuthInput from "@/components/auth-input";
import { sendPasswordReset } from "@/app/auth/actions";
import Link from "next/link";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <AuthCard
      title="Reset your password"
      description="We’ll email you a secure link to choose a new password."
      error={error}
      message={message}
    >
      <form action={sendPasswordReset} className="space-y-5">
        <AuthInput label="Email address" name="email" type="email" autoComplete="email" />
        <button className="min-h-12 w-full rounded-xl bg-gray-900 px-5 font-semibold text-white transition hover:bg-blue-700">
          Send reset link
        </button>
      </form>
      <Link href="/login" className="mt-5 inline-block text-sm text-blue-700 hover:text-blue-800">
        Back to sign in
      </Link>
    </AuthCard>
  );
}

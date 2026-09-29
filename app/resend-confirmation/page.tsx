import Link from "next/link";
import AuthCard from "@/components/auth-card";
import AuthInput from "@/components/auth-input";
import { resendSignupConfirmation } from "@/app/auth/actions";

export default async function ResendConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <AuthCard
      title="Resend confirmation email"
      description="Enter the address you used to sign up. We’ll send a new confirmation link if the account still needs verification."
      error={error}
      message={message}
    >
      <form action={resendSignupConfirmation} className="space-y-5">
        <AuthInput label="Email address" name="email" type="email" autoComplete="email" />
        <button className="min-h-12 w-full rounded-xl bg-gray-900 px-5 font-semibold text-white transition hover:bg-blue-700">
          Resend confirmation email
        </button>
      </form>
      <Link
        href="/login"
        className="mt-5 inline-block text-sm text-blue-700 hover:text-blue-800"
      >
        Back to sign in
      </Link>
    </AuthCard>
  );
}

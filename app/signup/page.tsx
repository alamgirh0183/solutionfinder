import AuthCard from "@/components/auth-card";
import AuthInput from "@/components/auth-input";
import { signUp } from "@/app/auth/actions";
import Link from "next/link";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <AuthCard
      title="Create your account"
      description="Sign up with your email and a password to get started."
      error={error}
      message={message}
    >
      <form action={signUp} className="space-y-5">
        <AuthInput label="Email address" name="email" type="email" autoComplete="email" />
        <AuthInput
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
        />
        <p className="-mt-2 text-xs text-gray-500">Use at least 8 characters.</p>
        <button className="min-h-12 w-full rounded-xl bg-gray-900 px-5 font-semibold text-white transition hover:bg-blue-700">
          Create account
        </button>
      </form>
      <p className="mt-5 text-sm text-gray-600">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-blue-700 hover:text-blue-800">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}

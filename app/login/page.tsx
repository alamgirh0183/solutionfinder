import AuthCard from "@/components/auth-card";
import AuthInput from "@/components/auth-input";
import { signIn } from "@/app/auth/actions";
import Link from "next/link";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; next?: string }>;
}) {
  const { error, message, next } = await searchParams;

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to your SolutionFinder account."
      error={error}
      message={message}
    >
      <form action={signIn} className="space-y-5">
        {next && <input type="hidden" name="next" value={next} />}
        <AuthInput label="Email address" name="email" type="email" autoComplete="email" />
        <AuthInput
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
        />
        <button className="min-h-12 w-full rounded-xl bg-gray-900 px-5 font-semibold text-white transition hover:bg-blue-700">
          Sign in
        </button>
      </form>
      <div className="mt-5 flex flex-col gap-3 text-sm text-gray-600">
        <Link href="/resend-confirmation" className="hover:text-blue-700">
          Didn’t receive the confirmation email?
        </Link>
        <Link href="/forgot-password" className="hover:text-blue-700">
          Forgot your password?
        </Link>
        <p>
          New to SolutionFinder?{" "}
          <Link href="/signup" className="font-semibold text-blue-700 hover:text-blue-800">
            Create an account
          </Link>
        </p>
      </div>
    </AuthCard>
  );
}

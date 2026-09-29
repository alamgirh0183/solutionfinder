import AuthCard from "@/components/auth-card";
import AuthInput from "@/components/auth-input";
import { updatePassword } from "@/app/auth/actions";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!hasSupabaseConfig()) {
    redirect("/login?error=Supabase%20is%20not%20configured.");
  }

  const supabase = await createClient();
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user) {
    redirect("/login?error=Your%20password%20reset%20session%20has%20expired.");
  }

  const { error } = await searchParams;

  return (
    <AuthCard
      title="Choose a new password"
      description="Enter a new password for your SolutionFinder account."
      error={error}
    >
      <form action={updatePassword} className="space-y-5">
        <AuthInput
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
        />
        <p className="-mt-2 text-xs text-gray-500">Use at least 8 characters.</p>
        <button className="min-h-12 w-full rounded-xl bg-gray-900 px-5 font-semibold text-white transition hover:bg-blue-700">
          Update password
        </button>
      </form>
    </AuthCard>
  );
}

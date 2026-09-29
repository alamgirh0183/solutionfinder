import { requireDashboardUser } from "@/lib/dashboard";
import { signOut } from "@/app/auth/actions";

export const dynamic = "force-dynamic";

export default async function DashboardAccountPage() {
  const { user } = await requireDashboardUser();

  return (
    <section>
      <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">Your workspace</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Account</h1>
      <p className="mt-2 text-sm text-gray-600">Your sign-in and profile details.</p>
      <dl className="mt-8 divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
        <div className="grid gap-1 p-5 sm:grid-cols-[12rem_1fr]">
          <dt className="text-sm font-medium text-gray-500">Email address</dt>
          <dd className="break-all text-sm text-gray-900">{user.email}</dd>
        </div>
        <div className="grid gap-1 p-5 sm:grid-cols-[12rem_1fr]">
          <dt className="text-sm font-medium text-gray-500">Email status</dt>
          <dd className="text-sm text-gray-900">{user.email_confirmed_at ? "Verified" : "Awaiting verification"}</dd>
        </div>
        <div className="grid gap-1 p-5 sm:grid-cols-[12rem_1fr]">
          <dt className="text-sm font-medium text-gray-500">Member since</dt>
          <dd className="text-sm text-gray-900">{new Date(user.created_at).toLocaleDateString()}</dd>
        </div>
      </dl>
      <form action={signOut} className="mt-6">
        <button className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-100">
          Sign out
        </button>
      </form>
    </section>
  );
}

import DashboardSearch from "@/components/dashboard-search";
import Link from "next/link";
import { loadPlanUsage, requireDashboardUser } from "@/lib/dashboard";
import { isWorkspaceMigrationMissing } from "@/lib/supabase/workspace-errors";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { supabase } = await requireDashboardUser();
  const [{ usage, error }, { data: recentSearches, error: historyError }] =
    await Promise.all([
      loadPlanUsage(supabase),
      supabase
        .from("search_history")
        .select("id,problem,status,created_at")
        .order("created_at", { ascending: false })
        .limit(3),
    ]);

  if (historyError && !isWorkspaceMigrationMissing(historyError)) {
    console.error("Unable to load recent dashboard searches:", historyError.message);
  }

  return (
    <div>
      <DashboardSearch initialUsage={usage} />
      {error && (
        <p role="status" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {error}
        </p>
      )}
      {recentSearches && recentSearches.length > 0 && (
        <section className="mt-12">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Recent searches</h2>
              <p className="mt-1 text-sm text-gray-500">Only visible to you.</p>
            </div>
            <Link href="/dashboard/history" className="text-sm font-semibold text-blue-700 hover:text-blue-900">
              View history →
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
            {recentSearches.map((search) => (
              <li key={search.id} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="line-clamp-2 text-sm font-medium text-gray-800">{search.problem}</p>
                <span className="shrink-0 text-xs text-gray-400">
                  {new Date(search.created_at).toLocaleDateString()} · {search.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

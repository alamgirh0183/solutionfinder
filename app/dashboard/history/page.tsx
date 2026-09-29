import Link from "next/link";
import { getSolutions } from "@/lib/solutions";
import { requireDashboardUser } from "@/lib/dashboard";
import SolutionCard from "@/components/solution-card";
import { isWorkspaceMigrationMissing } from "@/lib/supabase/workspace-errors";

export const dynamic = "force-dynamic";

export default async function SearchHistoryPage() {
  const { supabase } = await requireDashboardUser();
  const { data: searches, error } = await supabase
    .from("search_history")
    .select("id,problem,status,response_data,error_message,created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error && !isWorkspaceMigrationMissing(error)) {
    console.error("Unable to load private search history:", error.message);
  }

  return (
    <section>
      <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
        Your workspace
      </p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Search history</h1>
          <p className="mt-2 text-sm text-gray-600">
            Your searches and recommendations are private to your account.
          </p>
        </div>
        <Link href="/dashboard" className="rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700">
          + New search
        </Link>
      </div>

      {error ? (
        <p role="alert" className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          Search history is unavailable. Apply the SolutionFinder workspace migration and reload.
        </p>
      ) : searches?.length ? (
        <div className="mt-8 space-y-6">
          {searches.map((search) => {
            const solutions = getSolutions(search.response_data);
            return (
              <article id={search.id} key={search.id} className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="break-words font-semibold text-gray-900">{search.problem}</h2>
                    <p className="mt-1 text-xs text-gray-400">
                      {new Date(search.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                    search.status === "completed"
                      ? "bg-green-50 text-green-700"
                      : search.status === "failed"
                        ? "bg-red-50 text-red-700"
                        : "bg-amber-50 text-amber-800"
                  }`}>
                    {search.status}
                  </span>
                </div>
                {search.status === "failed" && (
                  <p className="mt-3 text-sm text-gray-500">
                    {search.error_message || "This search did not complete."}
                  </p>
                )}
                {solutions.length > 0 && (
                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    {solutions.map((solution, index) => (
                      <SolutionCard
                        key={`${search.id}-${index}`}
                        solution={solution}
                        searchId={search.id}
                        index={index}
                      />
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-8 rounded-3xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-xl text-blue-700">↻</div>
          <h2 className="mt-4 font-semibold">Your search history starts here</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
            Searches you run from your workspace will appear here. You can revisit the results and save useful solutions.
          </p>
          <Link href="/dashboard" className="mt-5 inline-flex rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">
            Start your first search
          </Link>
        </div>
      )}
    </section>
  );
}

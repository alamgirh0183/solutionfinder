import SavedSolutionCard from "@/components/saved-solution-card";
import Link from "next/link";
import { requireDashboardUser } from "@/lib/dashboard";
import { isWorkspaceMigrationMissing } from "@/lib/supabase/workspace-errors";

export const dynamic = "force-dynamic";

export default async function SavedSolutionsPage() {
  const { supabase } = await requireDashboardUser();
  const { data: saved, error } = await supabase
    .from("saved_solutions")
    .select("id,problem,solution_name,description,solution_url,created_at,source_search_id")
    .order("created_at", { ascending: false });

  const migrationMissing = error ? isWorkspaceMigrationMissing(error) : false;
  if (error && !migrationMissing) {
    console.error("Unable to load private saved solutions:", error.message);
  }

  return (
    <section>
      <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">Your workspace</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Saved solutions</h1>
      <p className="mt-2 text-sm text-gray-600">Keep useful recommendations close at hand.</p>
      {error ? (
        <p
          role={migrationMissing ? "status" : "alert"}
          className={`mt-8 rounded-2xl border p-5 text-sm ${
            migrationMissing
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {migrationMissing
            ? "Saved solutions will be available after the SolutionFinder workspace migration is applied in Supabase."
            : "Saved solutions are unavailable. Please try again later."}
        </p>
      ) : saved?.length ? (
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {saved.map((item) => <SavedSolutionCard key={item.id} saved={item} />)}
        </div>
      ) : (
        <div className="mt-8 rounded-3xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-xl text-purple-700">☆</div>
          <h2 className="mt-4 font-semibold">No saved solutions yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
            Run a search and choose “Save” on any recommendation you’d like to keep.
          </p>
          <Link href="/dashboard" className="mt-5 inline-flex rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">
            Find solutions
          </Link>
        </div>
      )}
    </section>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import PricingSection from "@/components/pricing-section";
import { getResultProblem, getSolutions, type Solution } from "@/lib/solutions";
import { planPlaceholders, type Plan } from "@/lib/plans";
import {
  getSearchCopy,
  type SearchLanguage,
} from "@/lib/search-language";
import { recordRecentProblem } from "@/lib/recent-searches";
import {
  isSearchCategory,
  searchCategories,
  type SearchCategory,
} from "@/lib/search-options";
import RecentProblems from "@/components/recent-problems";
import ResultActions from "@/components/result-actions";
import SolutionFeedback from "@/components/solution-feedback";
import WaitlistForm from "@/components/waitlist-form";

export default function HomeSearch({
  isAuthenticated,
  plans = planPlaceholders,
  plansConfigured = false,
}: {
  isAuthenticated: boolean;
  plans?: Plan[];
  plansConfigured?: boolean;
}) {
  const [problem, setProblem] = useState("");
  const [results, setResults] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [language, setLanguage] = useState<SearchLanguage>("en");
  const [category, setCategory] = useState<SearchCategory | "">("");
  const copy = getSearchCopy(language);

  const handleSearch = async () => {
    if (!problem.trim() || loading) return;

    setLoading(true);
    setResults(null);
    setSearchError("");

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem,
          language,
          ...(category ? { category } : {}),
        }),
      });

      if (!response.ok) {
        setSearchError(
          response.status === 429
            ? copy.publicLimitReached
            : response.status === 503
              ? copy.publicProtectionUnavailable
              : copy.searchError
        );
        return;
      }
      const data: unknown = await response.json();

      setResults(data);
      if (!recordRecentProblem(problem)) {
        console.warn("This search could not be added to browser-only recent searches.");
      }
    } catch (error) {
      console.error(
        "SolutionFinder public search failed:",
        error instanceof Error ? error.message : "Unknown webhook error."
      );
      setSearchError(copy.searchError);
    } finally {
      setLoading(false);
    }
  };

  const solutions: Solution[] = getSolutions(results);
  const resultProblem = getResultProblem(results);

  return (
    <main lang={language} className="min-h-screen overflow-hidden bg-white text-gray-900">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-180px] h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-blue-100/50 blur-3xl" />
        <div className="absolute right-[-150px] top-[300px] h-[350px] w-[350px] rounded-full bg-purple-100/40 blur-3xl" />
      </div>

      {/* Navbar */}
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 text-sm font-bold text-white shadow-lg shadow-blue-500/20">
            S
          </div>

          <span className="text-xl font-bold tracking-tight">
            SolutionFinder
          </span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/"
            className="hidden rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 sm:inline-flex"
          >
            Home
          </Link>
          <Link
            href="/pricing"
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
          >
            Pricing
          </Link>
          {isAuthenticated ? (
            <Link
              href="/dashboard"
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pb-20 pt-20 text-center md:pt-28">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
          <span className="h-2 w-2 rounded-full bg-blue-600" />
          AI-powered solution discovery
        </div>

        <h1 className="mx-auto max-w-4xl text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
          Tell us your problem.
          <span className="block bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
            We&apos;ll find the solution.
          </span>
        </h1>

        <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-gray-600 md:text-xl">
          Describe what you need, and SolutionFinder will discover relevant
          websites, apps, tools, and services that can help.
        </p>

        {isAuthenticated ? (
          <div className="mx-auto mt-12 max-w-2xl rounded-3xl border border-blue-100 bg-white p-8 shadow-xl shadow-blue-100/50">
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
              Your private workspace
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">
              Continue finding solutions
            </h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              Your account searches, saved solutions, and usage are available
              privately in your dashboard.
            </p>
            <Link
              href="/dashboard"
              className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-gray-900 px-5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Open workspace →
            </Link>
          </div>
        ) : (
          <>
        {/* Search box */}
        <div className="mx-auto mt-12 max-w-3xl">
          <div
            role="group"
            aria-label={copy.language}
            className="mb-4 flex items-center justify-center gap-2"
          >
            <span className="mr-1 text-sm font-medium text-gray-500">
              {copy.language}:
            </span>
            {(["en", "bn"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={language === option}
                onClick={() => setLanguage(option)}
                className={`min-h-10 rounded-full border px-4 py-2 text-sm font-medium transition ${
                  language === option
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:bg-blue-50"
                }`}
              >
                {option === "en" ? copy.english : copy.bengali}
              </button>
            ))}
          </div>
          <div className="mb-4 flex flex-col items-start gap-2 text-left sm:flex-row sm:items-center">
            <label htmlFor="public-search-category" className="text-sm font-medium text-gray-600">
              {copy.category}
            </label>
            <select
              id="public-search-category"
              value={category}
              onChange={(event) => {
                const selected = event.target.value;
                setCategory(isSearchCategory(selected) ? selected : "");
              }}
              className="min-h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-blue-300 sm:w-auto"
            >
              <option value="">{copy.categoryAny}</option>
              {searchCategories.map((option) => (
                <option key={option} value={option}>
                  {copy.categories[option]}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-3xl border border-gray-200 bg-white p-2 shadow-2xl shadow-gray-200/60 transition focus-within:border-blue-300 focus-within:shadow-blue-100/60">
            <div className="flex flex-col gap-2 md:flex-row">
              <input
                type="text"
                value={problem}
                onChange={(e) => {
                  setProblem(e.target.value);
                  setSearchError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSearch();
                  }
                }}
                placeholder={copy.problemPlaceholder}
                aria-label={copy.problemLabel}
                className="min-h-[58px] flex-1 rounded-2xl bg-gray-50 px-5 text-base outline-none placeholder:text-gray-400 focus:bg-white"
              />

              <button
                type="button"
                onClick={handleSearch}
                disabled={loading || !problem.trim()}
                aria-busy={loading}
                className="min-h-[58px] rounded-2xl bg-gray-900 px-8 font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? copy.searchingButton : copy.search}
              </button>
            </div>
          </div>

          <p className="mt-4 text-sm text-gray-400">
            {copy.helper}
          </p>
          {searchError && (
            <div
              role="alert"
              className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm text-red-700"
            >
              <span>{searchError}</span>
              <button
                type="button"
                onClick={handleSearch}
                disabled={loading || !problem.trim()}
                className="rounded-lg border border-red-200 bg-white px-3 py-1.5 font-semibold text-red-800 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {copy.retry}
              </button>
            </div>
          )}
        </div>
        <RecentProblems
          language={language}
          onSelect={(recentProblem) => {
            setProblem(recentProblem);
            setSearchError("");
          }}
        />

        {/* Suggestions */}
        <div className="mt-8">
          <p className="mb-3 text-center text-sm font-medium text-gray-500">
            {copy.examplesTitle}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
          {copy.examples.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setProblem(item);
                setSearchError("");
              }}
              className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
            >
              {item}
            </button>
          ))}
          </div>
        </div>

        {loading && (
          <div
            role="status"
            aria-live="polite"
            className="mx-auto mt-8 flex items-center justify-center gap-3 text-sm font-medium text-blue-700"
          >
            <span
              aria-hidden="true"
              className="h-5 w-5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-700"
            />
            {copy.searching}
          </div>
        )}

        {/* Results */}
        {results !== null && (
          <div className="mx-auto mt-16 max-w-5xl text-left">
            <div className="mb-8">
              <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">
                {copy.solutionsFound}
              </p>

              <h2 className="mt-2 text-3xl font-bold tracking-tight">
                {copy.resultFor}
              </h2>

              {typeof resultProblem === "string" && resultProblem && (
                <p className="mt-2 text-gray-500">
                  {copy.foundOptions}{" "}
                  <span className="font-medium text-gray-700">
                    {resultProblem}
                  </span>
                </p>
              )}
            </div>

            {solutions.length > 0 ? (
              <>
                <ResultActions
                  problem={resultProblem || problem}
                  solutions={solutions}
                  language={language}
                />
                <div className="grid gap-5 md:grid-cols-2">
                  {solutions.map((solution, index) => (
                  <div
                    key={`${solution.name}-${index}`}
                    className="group rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-lg font-bold text-blue-600">
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        {solution.name && (
                          <h3 className="text-xl font-bold text-gray-900">
                            {solution.name}
                          </h3>
                        )}
                        {solution.description && (
                          <p className="mt-3 text-sm leading-6 text-gray-600">
                            {solution.description}
                          </p>
                        )}
                        <div className="mt-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                            {copy.aiSummary}
                          </p>
                          <p className="mt-1 text-sm leading-6 text-gray-600">
                            {solution.summary || copy.summaryUnavailable}
                          </p>
                        </div>
                        {solution.url && (
                          <a
                            href={solution.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-5 inline-flex items-center rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-600"
                          >
                            {copy.visitWebsite}
                            <span className="ml-2">↗</span>
                          </a>
                        )}
                        <SolutionFeedback
                          solution={solution}
                          language={language}
                        />
                      </div>
                    </div>
                  </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="rounded-2xl border border-gray-200 bg-white p-6 text-gray-600">
                {copy.noResults}
              </p>
            )}
          </div>
        )}
          </>
        )}

        <WaitlistForm language={language} />

        {/* Feature cards */}
        <div className="mt-24 grid gap-5 text-left md:grid-cols-3">
          <div className="rounded-3xl border border-gray-100 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-xl">
              ✦
            </div>

            <h3 className="text-lg font-bold">Describe Your Problem</h3>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              Simply explain what you need using your own words.
            </p>
          </div>

          <div className="rounded-3xl border border-gray-100 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 text-xl">
              ✨
            </div>

            <h3 className="text-lg font-bold">AI Finds Solutions</h3>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              AI searches for relevant tools, websites, and services.
            </p>
          </div>

          <div className="rounded-3xl border border-gray-100 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-xl">
              ✓
            </div>

            <h3 className="text-lg font-bold">Get Useful Recommendations</h3>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              Get practical options that can help solve your problem.
            </p>
          </div>
        </div>
      </section>

      <PricingSection plans={plans} configured={plansConfigured} />

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 text-center text-sm text-gray-400">
        © 2026 SolutionFinder. Find the right tool for your problem.
      </footer>
    </main>
  );
}
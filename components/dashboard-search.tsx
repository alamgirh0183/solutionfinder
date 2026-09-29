"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { FormEvent } from "react";
import { runDashboardSearch, type DashboardSearchResult } from "@/app/dashboard/actions";
import type { DashboardUsage } from "@/lib/dashboard";
import SolutionCard from "@/components/solution-card";
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

export default function DashboardSearch({
  initialUsage,
}: {
  initialUsage: DashboardUsage | null;
}) {
  const [problem, setProblem] = useState("");
  const [result, setResult] = useState<Extract<DashboardSearchResult, { ok: true }> | null>(
    null
  );
  const [error, setError] = useState("");
  const [limitReached, setLimitReached] = useState(false);
  const [pending, startTransition] = useTransition();
  const [language, setLanguage] = useState<SearchLanguage>("en");
  const [category, setCategory] = useState<SearchCategory | "">("");
  const copy = getSearchCopy(language);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLimitReached(false);
    setResult(null);
    startTransition(async () => {
      const response = await runDashboardSearch(
        problem,
        language,
        category || undefined
      );
      if (response.ok) {
        setResult(response);
        if (!recordRecentProblem(problem)) {
          console.warn("This search could not be added to browser-only recent searches.");
        }
      } else {
        setLimitReached(response.reason === "limit");
        setError(
          response.reason === "limit"
            ? copy.limitReached
            : response.reason === "configuration"
              ? copy.configurationError
              : response.message
        );
      }
    });
  }

  const usage = result?.usage ?? initialUsage;
  const limit = usage?.search_limit;
  const remaining = result?.usage.remaining ?? usage?.remaining;

  return (
    <div lang={language}>
      <header className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
          {copy.workspace}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          {copy.workspaceTitle}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600 sm:text-base">
          {copy.workspaceDescription}
        </p>
      </header>

      <div
        role="group"
        className="mb-5 flex items-center gap-2"
        aria-label={copy.language}
      >
        <span className="mr-1 text-sm font-medium text-gray-500">{copy.language}:</span>
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

      {usage && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 px-5 py-4">
          <div>
            <p className="text-sm font-semibold capitalize text-blue-900">
              {usage.plan_name} plan
            </p>
            <p className="mt-1 text-xs text-blue-800">
              {!usage.configured
                ? copy.planAllowanceNeedsConfiguration
                : limit === null || limit === undefined || limit < 0
                  ? copy.monthlyAllowanceUnavailable
                  : copy.searchesRemaining
                      .replace("{remaining}", String(remaining ?? 0))
                      .replace("{limit}", String(limit))}
            </p>
          </div>
          <Link href="/dashboard/usage" className="text-sm font-semibold text-blue-700 hover:text-blue-900">
            {copy.usagePlan}
          </Link>
        </div>
      )}

      <form
        onSubmit={submitSearch}
        className="rounded-3xl border border-gray-200 bg-white p-3 shadow-lg shadow-gray-200/50 focus-within:border-blue-300"
      >
        <label htmlFor="dashboard-problem" className="sr-only">
          {copy.problemLabel}
        </label>
        <textarea
          id="dashboard-problem"
          value={problem}
          onChange={(event) => setProblem(event.target.value)}
          maxLength={2000}
          rows={3}
          placeholder={copy.problemPlaceholder}
          className="min-h-28 w-full resize-y rounded-2xl bg-gray-50 p-4 text-sm leading-6 outline-none placeholder:text-gray-400 focus:bg-white"
        />
        <div className="flex flex-col gap-2 px-1 pt-2 sm:flex-row sm:items-center">
          <label htmlFor="dashboard-search-category" className="text-sm font-medium text-gray-600">
            {copy.category}
          </label>
          <select
            id="dashboard-search-category"
            value={category}
            onChange={(event) => {
              const selected = event.target.value;
              setCategory(isSearchCategory(selected) ? selected : "");
            }}
            className="min-h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-blue-300 sm:w-auto"
          >
            <option value="">{copy.categoryAny}</option>
            {searchCategories.map((option) => (
              <option key={option} value={option}>
                {copy.categories[option]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col justify-between gap-3 px-1 pb-1 pt-2 sm:flex-row sm:items-center">
          <p className="text-xs text-gray-400">
            {copy.characterCount.replace("{count}", String(problem.length))}
          </p>
          <button
            disabled={pending || problem.trim().length < 2}
            className="min-h-11 rounded-xl bg-gray-900 px-6 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? copy.searchingButton : copy.search}
          </button>
        </div>
      </form>

      <RecentProblems
        language={language}
        onSelect={(recentProblem) => setProblem(recentProblem)}
      />

      {error && (
        <div role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
          {limitReached && (
            <Link href="/dashboard/usage" className="mt-2 inline-block text-sm font-semibold text-red-900 underline">
              {copy.reviewPremium}
            </Link>
          )}
        </div>
      )}

      {pending && (
        <div role="status" className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="h-36 animate-pulse rounded-2xl bg-gray-200" />
          <div className="h-36 animate-pulse rounded-2xl bg-gray-200" />
        </div>
      )}

      {result && (
        <section className="mt-10" aria-live="polite">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
            {copy.solutionsFound}
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight">
            {result.resultProblem
              ? `${copy.resultFor} “${result.resultProblem}”`
              : `${copy.resultFor} “${result.problem}”`}
          </h2>
          {result.solutions.length > 0 ? (
            <>
              <ResultActions
                problem={result.resultProblem || result.problem}
                solutions={result.solutions}
                language={language}
              />
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {result.solutions.map((solution, index) => (
                <SolutionCard
                  key={`${solution.name}-${index}`}
                  solution={solution}
                  searchId={result.searchId}
                  index={index}
                  language={language}
                />
                ))}
              </div>
            </>
          ) : (
            <p className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-600">
              {copy.noResults}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

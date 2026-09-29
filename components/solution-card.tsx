"use client";

import { useState, useTransition } from "react";
import { saveSolution } from "@/app/dashboard/actions";
import type { Solution } from "@/lib/solutions";
import {
  getSearchCopy,
  type SearchLanguage,
} from "@/lib/search-language";
import SolutionFeedback from "@/components/solution-feedback";

export default function SolutionCard({
  solution,
  searchId,
  index,
  language = "en",
}: {
  solution: Solution;
  searchId: string;
  index: number;
  language?: SearchLanguage;
}) {
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const copy = getSearchCopy(language);

  function handleSave() {
    setMessage("");
    startTransition(async () => {
      const result = await saveSolution(searchId, solution);
      if (result.ok) {
        setSaved(true);
      } else {
        setMessage(result.message ?? copy.saveError);
      }
    });
  }

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 font-bold text-blue-700">
          {index + 1}
        </div>
        <div className="min-w-0 flex-1">
          {solution.name && <h3 className="font-semibold text-gray-900">{solution.name}</h3>}
          {solution.description && (
            <p className="mt-2 text-sm leading-6 text-gray-600">{solution.description}</p>
          )}
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
              {copy.aiSummary}
            </p>
            <p className="mt-1 text-sm leading-6 text-gray-600">
              {solution.summary || copy.summaryUnavailable}
            </p>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {solution.url && (
              <a
                href={solution.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                {copy.visitWebsite} ↗
              </a>
            )}
            <button
              type="button"
              disabled={saved || pending}
              onClick={handleSave}
              className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saved ? copy.saved : pending ? copy.saving : copy.save}
            </button>
          </div>
          <SolutionFeedback
            solution={solution}
            searchId={searchId}
            language={language}
          />
          {message && (
            <p role="alert" className="mt-2 text-xs text-red-700">
              {message}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

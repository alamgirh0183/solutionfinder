"use client";

import { useEffect, useState } from "react";
import {
  clearRecentProblems,
  readRecentProblems,
  removeRecentProblem,
  subscribeToRecentProblems,
} from "@/lib/recent-searches";
import {
  getSearchCopy,
  type SearchLanguage,
} from "@/lib/search-language";

export default function RecentProblems({
  language,
  onSelect,
}: {
  language: SearchLanguage;
  onSelect: (problem: string) => void;
}) {
  const [problems, setProblems] = useState<string[]>([]);
  const [storageError, setStorageError] = useState(false);
  const copy = getSearchCopy(language);

  useEffect(() => {
    const refresh = (failed = false) => {
      setProblems(readRecentProblems());
      setStorageError(failed);
    };
    refresh();
    return subscribeToRecentProblems(refresh);
  }, []);

  function remove(problem: string) {
    setStorageError(!removeRecentProblem(problem));
  }

  function clear() {
    setStorageError(!clearRecentProblems());
  }

  if (!problems.length && !storageError) return null;

  return (
    <section className="mt-8" aria-labelledby="recent-problems-heading">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="recent-problems-heading" className="text-sm font-semibold text-gray-700">
          {copy.recentTitle}
        </h2>
        {problems.length > 0 && (
          <button
            type="button"
            onClick={clear}
            className="min-h-9 rounded-lg px-3 text-xs font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          >
            {copy.recentClear}
          </button>
        )}
      </div>
      {storageError && (
        <p role="alert" className="mb-3 text-sm text-red-700">
          {copy.recentStorageError}
        </p>
      )}
      {problems.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {problems.map((problem) => (
            <li
              key={problem}
              className="flex max-w-full items-center overflow-hidden rounded-full border border-gray-200 bg-white text-sm shadow-sm"
            >
              <button
                type="button"
                onClick={() => onSelect(problem)}
                className="min-h-10 max-w-[min(70vw,24rem)] truncate px-4 py-2 text-left text-gray-600 hover:bg-blue-50 hover:text-blue-700"
                title={problem}
              >
                {problem}
              </button>
              <button
                type="button"
                onClick={() => remove(problem)}
                aria-label={`${copy.recentRemove}: ${problem}`}
                className="min-h-10 shrink-0 border-l border-gray-100 px-3 text-gray-400 hover:bg-red-50 hover:text-red-700"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">{copy.recentEmpty}</p>
      )}
      <p className="mt-2 text-xs text-gray-400">{copy.recentDeviceOnly}</p>
    </section>
  );
}

"use client";

import { useState } from "react";
import type { Solution } from "@/lib/solutions";
import {
  getSearchCopy,
  type SearchLanguage,
} from "@/lib/search-language";

export default function ResultActions({
  problem,
  solutions,
  language,
}: {
  problem: string;
  solutions: Solution[];
  language: SearchLanguage;
}) {
  const [message, setMessage] = useState("");
  const copy = getSearchCopy(language);
  const links = solutions
    .filter((solution) => solution.url)
    .map((solution) => `${solution.name || solution.url}: ${solution.url}`);
  const shareText = [`SolutionFinder results for: ${problem}`, ...links].join("\n");

  async function copyLinks() {
    setMessage("");
    try {
      await navigator.clipboard.writeText(links.join("\n"));
      setMessage(copy.copied);
    } catch {
      setMessage(copy.shareError);
    }
  }

  async function shareResults() {
    setMessage("");
    try {
      if (navigator.share) {
        await navigator.share({ title: "SolutionFinder results", text: shareText });
        setMessage(copy.shared);
      } else {
        await navigator.clipboard.writeText(shareText);
        setMessage(copy.shareCopied);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setMessage(copy.shareError);
    }
  }

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={!links.length}
        onClick={copyLinks}
        className="min-h-10 rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {copy.copyLinks}
      </button>
      <button
        type="button"
        disabled={!links.length}
        onClick={shareResults}
        className="min-h-10 rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {copy.shareResult}
      </button>
      {message && (
        <p role="status" className="text-xs text-gray-500">
          {message}
        </p>
      )}
    </div>
  );
}

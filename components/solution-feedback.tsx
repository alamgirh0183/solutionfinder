"use client";

import { useState } from "react";
import type { Solution } from "@/lib/solutions";
import {
  getSearchCopy,
  type SearchLanguage,
} from "@/lib/search-language";

export default function SolutionFeedback({
  solution,
  searchId,
  language,
}: {
  solution: Solution;
  searchId?: string;
  language: SearchLanguage;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(false);
  const copy = getSearchCopy(language);

  async function sendFeedback(helpful: boolean) {
    if (submitting || submitted) return;
    setSubmitting(true);
    setError(false);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          searchId,
          solution: { name: solution.name, url: solution.url },
          helpful,
        }),
      });
      if (!response.ok) {
        setError(true);
        return;
      }
      setSubmitted(true);
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-4 border-t border-gray-100 pt-3">
      {submitted ? (
        <p role="status" className="text-xs text-green-700">
          {copy.feedbackSent}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs text-gray-500">{copy.feedbackPrompt}</span>
          <button
            type="button"
            disabled={submitting}
            onClick={() => sendFeedback(true)}
            className="min-h-9 rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-600 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
          >
            {copy.helpful}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => sendFeedback(false)}
            className="min-h-9 rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            {submitting ? copy.feedbackSending : copy.notHelpful}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {copy.feedbackError}
        </p>
      )}
    </div>
  );
}

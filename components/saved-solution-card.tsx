"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { removeSavedSolution } from "@/app/dashboard/actions";

export default function SavedSolutionCard({
  saved,
}: {
  saved: {
    id: string;
    problem: string;
    solution_name: string;
    description: string;
    solution_url: string;
    created_at: string;
    source_search_id: string;
  };
}) {
  const [removed, setRemoved] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function handleRemove() {
    setMessage("");
    startTransition(async () => {
      const result = await removeSavedSolution(saved.id);
      if (result.ok) {
        setRemoved(true);
      } else {
        setMessage(result.message ?? "Could not remove this saved solution.");
      }
    });
  }

  if (removed) return null;

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wider text-blue-600">Saved recommendation</p>
      <h2 className="mt-2 text-lg font-semibold">{saved.solution_name || "Solution"}</h2>
      <p className="mt-2 text-sm leading-6 text-gray-600">{saved.description}</p>
      <p className="mt-4 rounded-xl bg-gray-50 px-4 py-3 text-xs text-gray-600">
        From: <span className="font-medium text-gray-800">{saved.problem}</span>
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {saved.solution_url && (
          <a href={saved.solution_url} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700">
            Visit website ↗
          </a>
        )}
        <Link href={`/dashboard/history#${saved.source_search_id}`} className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
          View source search
        </Link>
        <button type="button" onClick={handleRemove} disabled={pending} className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60">
          {pending ? "Removing…" : "Remove"}
        </button>
      </div>
      {message && <p role="alert" className="mt-2 text-xs text-red-700">{message}</p>}
      <p className="mt-3 text-xs text-gray-400">Saved {new Date(saved.created_at).toLocaleDateString()}</p>
    </article>
  );
}

import type { ReactNode } from "react";
import Link from "next/link";
import {
  getSupabaseSetupMessage,
  hasSupabaseConfig,
} from "@/lib/supabase/config";

export default function AuthCard({
  title,
  description,
  error,
  message,
  children,
}: {
  title: string;
  description: string;
  error?: string;
  message?: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-white px-6 py-12 text-gray-900">
      <div className="mx-auto max-w-md">
        <Link href="/" className="mb-10 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 text-sm font-bold text-white">
            S
          </span>
          <span className="text-xl font-bold tracking-tight">SolutionFinder</span>
        </Link>
        <section className="rounded-3xl border border-gray-200 bg-white p-8 shadow-xl shadow-gray-100">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-gray-600">{description}</p>
          {!hasSupabaseConfig() && (
            <p
              role="status"
              className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
            >
              {getSupabaseSetupMessage()}
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}
          {message && (
            <p
              role="status"
              className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800"
            >
              {message}
            </p>
          )}
          <div className="mt-6">{children}</div>
        </section>
      </div>
    </main>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import {
  getSearchCopy,
  type SearchLanguage,
} from "@/lib/search-language";

export default function WaitlistForm({
  language,
}: {
  language: SearchLanguage;
}) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const copy = getSearchCopy(language);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    setSuccess(false);
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        setMessage(copy.waitlistError);
        return;
      }
      setSuccess(true);
      setEmail("");
      setMessage(copy.waitlistSuccess);
    } catch {
      setMessage(copy.waitlistError);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mx-auto mt-16 max-w-3xl rounded-3xl border border-blue-100 bg-blue-50/70 p-7 text-left sm:p-9">
      <h2 className="text-2xl font-bold tracking-tight text-gray-900">
        {copy.waitlistTitle}
      </h2>
      <p className="mt-2 text-sm leading-6 text-gray-600">
        {copy.waitlistDescription}
      </p>
      <p className="mt-2 text-xs leading-5 text-gray-500">
        {copy.waitlistPrivacy}
      </p>
      <form onSubmit={submit} className="mt-5 flex flex-col gap-3 sm:flex-row">
        <label htmlFor="waitlist-email" className="sr-only">
          {copy.emailPlaceholder}
        </label>
        <input
          id="waitlist-email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={copy.emailPlaceholder}
          className="min-h-12 min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-4 text-sm outline-none focus:border-blue-400"
        />
        <button
          type="submit"
          disabled={pending}
          className="min-h-12 rounded-xl bg-gray-900 px-6 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? copy.joiningWaitlist : copy.joinWaitlist}
        </button>
      </form>
      {message && (
        <p
          role={success ? "status" : "alert"}
          className={`mt-3 text-sm ${success ? "text-green-800" : "text-red-700"}`}
        >
          {message}
        </p>
      )}
    </section>
  );
}

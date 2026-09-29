import "server-only";

import { randomUUID } from "node:crypto";

type SupabaseError = {
  code?: string;
  message?: string;
  hint?: string | null;
};

function safeText(value: string | null | undefined) {
  return (value ?? "")
    .replace(/\b(?:sb_secret_|sk_(?:test|live)_|whsec_)[A-Za-z0-9_-]+/gi, "[REDACTED]")
    .slice(0, 500);
}

export function logSupabaseError(operation: string, error: SupabaseError) {
  const reference = randomUUID();
  console.error("Supabase operation failed", {
    reference,
    operation,
    code: error.code ?? "UNKNOWN",
    message: safeText(error.message),
    hint: safeText(error.hint),
  });
  return reference;
}

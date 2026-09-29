"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getSupabaseSetupMessage,
  hasSupabaseConfig,
} from "@/lib/supabase/config";
import { logSupabaseError } from "@/lib/supabase/diagnostics";
import { createClient } from "@/lib/supabase/server";

function rawFormValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function formEmail(formData: FormData) {
  return rawFormValue(formData, "email").trim();
}

function withMessage(
  path: string,
  key: "error" | "message",
  message: string
): never {
  redirect(`${path}?${key}=${encodeURIComponent(message)}`);
}

function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(
    /\/$/,
    ""
  );
}

async function configuredClient(path: string) {
  if (!hasSupabaseConfig()) {
    withMessage(path, "error", getSupabaseSetupMessage());
  }
  return createClient();
}

function validateEmail(email: string, path: string): void {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    withMessage(path, "error", "Enter a valid email address.");
  }
}

export async function signUp(formData: FormData) {
  const email = formEmail(formData);
  const password = rawFormValue(formData, "password");
  validateEmail(email, "/signup");
  if (password.length < 8) {
    withMessage("/signup", "error", "Use a password with at least 8 characters.");
  }

  const supabase = await configuredClient("/signup");
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${getSiteUrl()}/auth/callback?next=/dashboard`,
    },
  });

  if (error) {
    withMessage("/signup", "error", error.message);
  }
  if (data.session) {
    redirect("/dashboard");
  }
  withMessage(
    "/login",
    "message",
    "Your account was created. Confirm your email once using the link we sent; after that, sign in directly with your email and password."
  );
}

export async function signIn(formData: FormData) {
  const email = formEmail(formData);
  const password = rawFormValue(formData, "password");
  const requestedPath = rawFormValue(formData, "next");
  const nextPath =
    requestedPath.startsWith("/dashboard") &&
    !requestedPath.startsWith("//") &&
    !requestedPath.includes("\\")
      ? requestedPath
      : "/dashboard";
  validateEmail(email, "/login");
  if (!password) {
    withMessage("/login", "error", "Enter your password.");
  }

  const supabase = await configuredClient("/login");
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.message.toLowerCase().includes("email not confirmed")) {
      withMessage(
        "/login",
        "error",
        "Confirm your email before signing in. If the message did not arrive, request another confirmation email below."
      );
    }
    withMessage("/login", "error", error.message);
  }
  redirect(nextPath);
}

export async function resendSignupConfirmation(formData: FormData) {
  const email = formEmail(formData);
  validateEmail(email, "/resend-confirmation");

  const supabase = await configuredClient("/resend-confirmation");
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: `${getSiteUrl()}/auth/callback?next=/dashboard`,
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes("email address not authorized")) {
      withMessage(
        "/resend-confirmation",
        "error",
        "Supabase's default email service only sends to project team addresses. Configure custom SMTP in your Supabase Auth settings to deliver to Gmail."
      );
    }
    if (error.message.toLowerCase().includes("rate limit")) {
      withMessage(
        "/resend-confirmation",
        "error",
        "Email sending is temporarily rate-limited. Wait before retrying, or configure custom SMTP in Supabase."
      );
    }
    const reference = logSupabaseError("resend_signup_confirmation", error);
    withMessage(
      "/resend-confirmation",
      "error",
      `Supabase could not send the confirmation message (${error.code ?? "unknown"}). Reference: ${reference}.`
    );
  }

  withMessage(
    "/login",
    "message",
    "If that address has an unconfirmed account, a new confirmation email has been sent."
  );
}

export async function sendPasswordReset(formData: FormData) {
  const email = formEmail(formData);
  validateEmail(email, "/forgot-password");

  const supabase = await configuredClient("/forgot-password");
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getSiteUrl()}/auth/callback?next=/auth/update-password`,
  });

  if (error) {
    withMessage("/forgot-password", "error", error.message);
  }
  withMessage(
    "/login",
    "message",
    "If an account exists for that email, a password reset link has been sent."
  );
}

export async function updatePassword(formData: FormData) {
  const password = rawFormValue(formData, "password");
  if (password.length < 8) {
    withMessage(
      "/auth/update-password",
      "error",
      "Use a password with at least 8 characters."
    );
  }

  const supabase = await configuredClient("/auth/update-password");
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user) {
    withMessage(
      "/login",
      "error",
      "Your reset session has expired. Request a new link."
    );
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    withMessage("/auth/update-password", "error", error.message);
  }
  withMessage(
    "/login",
    "message",
    "Your password has been updated. Sign in to continue."
  );
}

export async function signOut() {
  if (hasSupabaseConfig()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      withMessage("/account", "error", error.message);
    }
  }
  revalidatePath("/", "layout");
  redirect("/");
}

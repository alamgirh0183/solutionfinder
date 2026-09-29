import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

function getSafeNextPath(value: string | null) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return "/dashboard";
  }

  return value;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!hasSupabaseConfig()) {
    return NextResponse.redirect(
      new URL("/login?error=Supabase%20is%20not%20configured.", request.url)
    );
  }
  if (!code) {
    return NextResponse.redirect(
      new URL(
        "/login?error=The%20authentication%20link%20is%20invalid%20or%20expired.",
        request.url
      )
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("Unable to complete the Supabase auth callback:", error.message);
    return NextResponse.redirect(
      new URL(
        "/login?error=The%20authentication%20link%20is%20invalid%20or%20expired.",
        request.url
      )
    );
  }

  return NextResponse.redirect(
    new URL(getSafeNextPath(request.nextUrl.searchParams.get("next")), request.url)
  );
}

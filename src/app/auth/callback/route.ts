import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/home";
  }
  return value;
}

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL("/forgot-password", request.url));
    }
  }

  return NextResponse.redirect(new URL(next, request.url));
}

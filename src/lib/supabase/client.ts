import { createBrowserClient } from "@supabase/ssr";
import {
  getSupabasePublishableKey,
  getSupabaseUrl,
  isSupabaseConfigured,
} from "@/lib/env";

export function createClient() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase environment variables are not configured.");
  }

  return createBrowserClient(getSupabaseUrl()!, getSupabasePublishableKey()!);
}

/** @deprecated Use createClient — official @supabase/ssr browser helper. */
export function createBrowserSupabaseClient() {
  return createClient();
}

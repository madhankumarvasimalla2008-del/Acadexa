import {
  getMissingRequiredSupabaseEnv,
  getSupabaseEnvPresence,
  isSupabaseConfigured,
} from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const presence = getSupabaseEnvPresence();
  const missingRequired = getMissingRequiredSupabaseEnv();
  const publishablePresent = presence.some(
    (item) =>
      (item.name === "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" ||
        item.name === "NEXT_PUBLIC_SUPABASE_ANON_KEY") &&
      item.present,
  );

  if (!isSupabaseConfigured()) {
    return Response.json({
      ok: false,
      supabase: false,
      connected: false,
      missingRequired,
      env: presence.map(({ name, required, present, clientExposed }) => ({
        name,
        required,
        present,
        clientExposed,
      })),
    });
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.getSession();

    return Response.json({
      ok: !error,
      supabase: true,
      connected: !error,
      authReachable: !error,
      error: error?.message,
      missingRequired,
      env: presence.map(({ name, required, present, clientExposed }) => ({
        name,
        required,
        present,
        clientExposed,
      })),
      note: publishablePresent
        ? undefined
        : "Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        supabase: true,
        connected: false,
        missingRequired,
        error: error instanceof Error ? error.message : "Unknown error",
        env: presence.map(({ name, required, present, clientExposed }) => ({
          name,
          required,
          present,
          clientExposed,
        })),
      },
      { status: 500 },
    );
  }
}

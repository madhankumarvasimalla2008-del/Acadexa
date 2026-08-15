/**
 * Public Supabase config only (safe for the browser client).
 * Never read SUPABASE_SERVICE_ROLE_KEY here.
 */
export function getSupabaseUrl(): string | undefined {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  return url || undefined;
}

/** Official publishable key, with legacy anon key as fallback. */
export function getSupabasePublishableKey(): string | undefined {
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return publishable || anon || undefined;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabasePublishableKey());
}

export function getSuperAdminEmail(): string | undefined {
  const value = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  return value || undefined;
}

export type EnvPresence = {
  name: string;
  required: boolean;
  present: boolean;
  clientExposed: boolean;
};

export function getSupabaseEnvPresence(): EnvPresence[] {
  return [
    {
      name: "NEXT_PUBLIC_SUPABASE_URL",
      required: true,
      present: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()),
      clientExposed: true,
    },
    {
      name: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      required: false,
      present: Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()),
      clientExposed: true,
    },
    {
      name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      required: false,
      present: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()),
      clientExposed: true,
    },
    {
      name: "SUPABASE_SERVICE_ROLE_KEY",
      required: false,
      present: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
      clientExposed: false,
    },
    {
      name: "SUPER_ADMIN_EMAIL",
      required: false,
      present: Boolean(process.env.SUPER_ADMIN_EMAIL?.trim()),
      clientExposed: false,
    },
    {
      name: "NEXT_PUBLIC_APP_URL",
      required: false,
      present: Boolean(process.env.NEXT_PUBLIC_APP_URL?.trim()),
      clientExposed: true,
    },
  ];
}

export function getMissingRequiredSupabaseEnv(): string[] {
  const missing: string[] = [];
  if (!getSupabaseUrl()) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!getSupabasePublishableKey()) {
    missing.push(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)",
    );
  }
  return missing;
}

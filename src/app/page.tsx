import Link from "next/link";
import { getAuthContext, defaultHomePath } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const configured = isSupabaseConfigured();
  const context = await getAuthContext();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-4 py-16">
      <p className="text-sm font-medium uppercase tracking-wide text-teal-800">
        Acadexa
      </p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">
        School requirements, collected at school
      </h1>
      <p className="mt-4 max-w-xl text-zinc-600">
        Parents pay online and collect books, uniforms, and other requirements
        from the school. This is Phase 0: authentication, tenancy, and enrollment
        foundations — not the full product.
      </p>
      {!configured ? (
        <p className="mt-6 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Supabase env vars are missing. Copy <code>.env.example</code> to{" "}
          <code>.env.local</code> and apply the Phase 0 SQL migration.
        </p>
      ) : null}
      <div className="mt-8 flex flex-wrap gap-3">
        {context ? (
          <Button asChild>
            <Link href={defaultHomePath(context)}>Continue</Link>
          </Button>
        ) : (
          <>
            <Button asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/register">Create parent account</Link>
            </Button>
          </>
        )}
      </div>
    </main>
  );
}

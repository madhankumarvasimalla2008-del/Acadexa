import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";
import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function ResetPasswordPage() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Reset password</CardTitle>
            <CardDescription>Supabase is not configured.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Set a new password</CardTitle>
          <CardDescription>
            {user
              ? "Choose a new password for this account."
              : "This reset link is invalid or has expired."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user ? (
            <ResetPasswordForm />
          ) : (
            <p className="text-sm text-zinc-600">
              Request a new link from{" "}
              <Link className="text-teal-800 underline" href="/forgot-password">
                forgot password
              </Link>
              .
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

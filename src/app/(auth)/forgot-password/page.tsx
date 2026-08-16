import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Forgot password</CardTitle>
          <CardDescription>
            Enter the email for your Acadexa account. If it is registered, we will
            send a reset link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ForgotPasswordForm />
          <p className="mt-4 text-sm text-zinc-600">
            Remembered it?{" "}
            <Link className="text-teal-800 underline" href="/login">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

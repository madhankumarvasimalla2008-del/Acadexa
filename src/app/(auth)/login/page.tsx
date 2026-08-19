import Image from "next/image";
import Link from "next/link";
import AbpsOrnament from "@/components/brand/abps-ornament";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/features/auth/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const nextPath = next && next.startsWith("/") ? next : "/home";

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10 sm:px-6 sm:py-16">
      <div className="acadexa-surface pointer-events-none absolute inset-0" />
      <div className="acadexa-pattern-drift" aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-[#c9a227]" />
      <div className="acadexa-header-pattern pointer-events-none absolute inset-x-0 top-1.5 h-16 sm:h-20" />
      <div className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-[#6b1d2a]/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-10 h-80 w-80 rounded-full bg-[#c9a227]/15 blur-3xl" />

      <div className="relative z-10 w-full max-w-[26rem]">
        <div className="acadexa-anim-logo mb-6 flex flex-col items-center text-center">
          <div className="acadexa-glass relative h-[5.5rem] w-[5.5rem] rounded-2xl p-2 ring-1 ring-[#c9a227]/50 sm:h-24 sm:w-24">
            <Image
              src="/school-logo.png"
              alt="Aditya Birla Public School"
              fill
              sizes="96px"
              className="object-contain p-2"
              priority
            />
          </div>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#c9a227]">
            School administration
          </p>
          <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-[#6b1d2a] sm:text-[1.65rem]">
            Aditya Birla Public School
          </h1>
          <AbpsOrnament className="mx-auto mt-2 h-4 w-40" />
          <p className="mt-2 text-sm text-zinc-600">Sign in to Acadexa</p>
        </div>

        <Card className="acadexa-anim-fade-up acadexa-card-premium acadexa-glass acadexa-delay-1 border-[#c9a227]/40">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-lg text-[#6b1d2a]">Welcome back</CardTitle>
            <CardDescription className="text-[15px] leading-relaxed">
              Use the email and password for your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-1">
            <LoginForm nextPath={nextPath} />
            <div className="mt-6 space-y-2 border-t border-[#c9a227]/20 pt-4 text-sm text-zinc-600">
              <p>
                <Link className="font-medium text-[#6b1d2a] underline" href="/forgot-password">
                  Forgot password?
                </Link>
              </p>
              <p>
                New parent?{" "}
                <Link className="font-medium text-[#6b1d2a] underline" href="/register">
                  Create an account
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

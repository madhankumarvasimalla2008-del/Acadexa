import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Not authorized</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Your account does not have access to that workspace. Roles are
        school-scoped and never taken from the browser.
      </p>
      <Link href="/home" className="mt-6 inline-block text-sm text-teal-800 underline">
        Back to home
      </Link>
    </main>
  );
}

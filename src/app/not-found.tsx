import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-zinc-600">
        That route is not part of the Acadexa Phase 0 foundation.
      </p>
      <Link href="/" className="mt-6 inline-block text-sm text-teal-800 underline">
        Go home
      </Link>
    </div>
  );
}

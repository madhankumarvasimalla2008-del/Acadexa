export default function PaymentsLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6" aria-busy="true" aria-label="Loading payments">
      <div className="h-8 w-40 animate-pulse rounded bg-[#6b1d2a]/10" />
      <div className="h-24 animate-pulse rounded-2xl bg-[#c9a227]/15" />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="h-24 animate-pulse rounded-2xl bg-[#c9a227]/10" />
        <div className="h-24 animate-pulse rounded-2xl bg-[#c9a227]/10" />
        <div className="h-24 animate-pulse rounded-2xl bg-[#c9a227]/10" />
      </div>
    </div>
  );
}

export default function ParentPacksLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6" aria-busy="true" aria-label="Loading packs">
      <div className="h-8 w-40 animate-pulse rounded bg-[#6b1d2a]/10" />
      <div className="h-40 animate-pulse rounded-2xl bg-[#c9a227]/15" />
    </div>
  );
}

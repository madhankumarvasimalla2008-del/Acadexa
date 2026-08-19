export default function AcademicYearsLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6" aria-busy="true" aria-label="Loading academic years">
      <div className="h-8 w-56 animate-pulse rounded bg-[#6b1d2a]/10" />
      <div className="h-48 animate-pulse rounded-2xl bg-[#c9a227]/15" />
      <div className="h-40 animate-pulse rounded-2xl bg-[#c9a227]/10" />
    </div>
  );
}

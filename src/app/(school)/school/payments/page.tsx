import AbpsOrnament from "@/components/brand/abps-ornament";
import { EmptyState } from "@/components/brand/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatInr, packTypeLabel, paymentStatusLabel, toAmount } from "@/lib/payments/display";
import { requireSchoolAdmin } from "@/lib/auth/workspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const selectClassName =
  "h-10 w-full rounded-md border border-[#6b1d2a]/20 bg-white px-3 text-base text-[#6b1d2a] sm:text-sm";
const fieldClass =
  "h-10 w-full rounded-md border border-[#6b1d2a]/20 bg-white px-3 text-base text-[#6b1d2a] sm:text-sm";

const STATUSES = ["pending", "successful", "failed", "refunded"] as const;

function classLabel(name: string, section: string | null) {
  return section ? `Class ${name} · ${section}` : `Class ${name}`;
}

export default async function SchoolPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    yearId?: string;
    classId?: string;
    packId?: string;
    status?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const { schoolId } = await requireSchoolAdmin();
  const filters = await searchParams;
  const supabase = await createServerSupabaseClient();

  const [{ data: years, error: yearsError }, { data: classes, error: classesError }] = await Promise.all([
    supabase
      .from("academic_years")
      .select("id, name")
      .eq("school_id", schoolId)
      .order("starts_on", { ascending: false }),
    supabase
      .from("classes")
      .select("id, name, section, sort_order")
      .eq("school_id", schoolId)
      .order("sort_order")
      .order("name"),
  ]);

  const selectedYearId =
    filters.yearId && (years ?? []).some((row) => row.id === filters.yearId)
      ? filters.yearId
      : (years?.[0]?.id ?? "");
  const selectedClassId =
    filters.classId && (classes ?? []).some((row) => row.id === filters.classId) ? filters.classId : "";
  const statusFilter = STATUSES.includes(filters.status as (typeof STATUSES)[number])
    ? (filters.status as (typeof STATUSES)[number])
    : "";

  let packsQuery = supabase
    .from("packs")
    .select("id, name, academic_year_id, class_id")
    .eq("school_id", schoolId)
    .order("name");
  if (selectedYearId) {
    packsQuery = packsQuery.eq("academic_year_id", selectedYearId);
  }
  if (selectedClassId) {
    packsQuery = packsQuery.eq("class_id", selectedClassId);
  }
  const { data: packs, error: packsError } = await packsQuery;

  const selectedPackId =
    filters.packId && (packs ?? []).some((row) => row.id === filters.packId) ? filters.packId : "";

  let ordersQuery = supabase
    .from("orders")
    .select(
      "id, payment_status, amount_snapshot, created_at, pack_id, student_id, academic_year_id, class_id, pack_name_snapshot, pack_type_snapshot, student_name_snapshot, academic_year_name_snapshot, class_name_snapshot",
    )
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });
  if (selectedYearId) {
    ordersQuery = ordersQuery.eq("academic_year_id", selectedYearId);
  }
  if (selectedClassId) {
    ordersQuery = ordersQuery.eq("class_id", selectedClassId);
  }
  if (selectedPackId) {
    ordersQuery = ordersQuery.eq("pack_id", selectedPackId);
  }
  if (statusFilter) {
    ordersQuery = ordersQuery.eq("payment_status", statusFilter);
  }
  if (filters.from) {
    ordersQuery = ordersQuery.gte("created_at", `${filters.from}T00:00:00.000Z`);
  }
  if (filters.to) {
    ordersQuery = ordersQuery.lte("created_at", `${filters.to}T23:59:59.999Z`);
  }

  const { data: orders, error: ordersError } = await ordersQuery;
  const error =
    yearsError?.message || classesError?.message || packsError?.message || ordersError?.message;

  const rows = orders ?? [];
  const expected = rows
    .filter((row) => row.payment_status === "pending" || row.payment_status === "successful")
    .reduce((sum, row) => sum + toAmount(row.amount_snapshot), 0);
  const received = rows
    .filter((row) => row.payment_status === "successful")
    .reduce((sum, row) => sum + toAmount(row.amount_snapshot), 0);
  const pending = rows
    .filter((row) => row.payment_status === "pending")
    .reduce((sum, row) => sum + toAmount(row.amount_snapshot), 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="border-b border-[#c9a227]/30 pb-5 sm:pb-6">
        <p className="acadexa-kicker text-[#6b1d2a]">School administration</p>
        <h1 className="acadexa-display mt-2 text-2xl text-[#6b1d2a] sm:text-3xl">Payments</h1>
        <AbpsOrnament className="mt-2 h-3 w-32" />
        <p className="acadexa-lede mt-3 max-w-2xl text-zinc-600">
          Checkout records for this school. Totals follow the filters below.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      <Card className="acadexa-anim-fade-up acadexa-card-premium border-[#c9a227]/30">
        <CardHeader className="border-[#c9a227]/20">
          <CardTitle>Filter</CardTitle>
          <CardDescription>Limit the list by year, class, pack, date, and status.</CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="grid gap-1 text-sm">
              <span>Academic year</span>
              <select name="yearId" defaultValue={selectedYearId} className={selectClassName}>
                {(years ?? []).map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span>Class</span>
              <select name="classId" defaultValue={selectedClassId} className={selectClassName}>
                <option value="">All classes</option>
                {(classes ?? []).map((klass) => (
                  <option key={klass.id} value={klass.id}>
                    {classLabel(klass.name, klass.section)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span>Pack</span>
              <select name="packId" defaultValue={selectedPackId} className={selectClassName}>
                <option value="">All packs</option>
                {(packs ?? []).map((pack) => (
                  <option key={pack.id} value={pack.id}>
                    {pack.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span>Payment status</span>
              <select name="status" defaultValue={statusFilter} className={selectClassName}>
                <option value="">All statuses</option>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {paymentStatusLabel(status)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span>From date</span>
              <input type="date" name="from" defaultValue={filters.from ?? ""} className={fieldClass} />
            </label>
            <label className="grid gap-1 text-sm">
              <span>To date</span>
              <input type="date" name="to" defaultValue={filters.to ?? ""} className={fieldClass} />
            </label>
            <div className="sm:col-span-2 lg:col-span-3">
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-md border border-[#c9a227]/50 bg-white px-4 text-sm font-medium text-[#6b1d2a] hover:bg-[#faf6ef]"
              >
                Show payments
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="acadexa-card-premium border-[#c9a227]/30">
          <CardHeader className="border-0 pb-0">
            <CardDescription>Expected</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <p className="acadexa-display text-2xl text-[#6b1d2a]">{formatInr(expected)}</p>
          </CardContent>
        </Card>
        <Card className="acadexa-card-premium border-[#c9a227]/30">
          <CardHeader className="border-0 pb-0">
            <CardDescription>Received</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <p className="acadexa-display text-2xl text-[#6b1d2a]">{formatInr(received)}</p>
          </CardContent>
        </Card>
        <Card className="acadexa-card-premium border-[#c9a227]/30">
          <CardHeader className="border-0 pb-0">
            <CardDescription>Pending</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <p className="acadexa-display text-2xl text-[#6b1d2a]">{formatInr(pending)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="acadexa-anim-fade-up acadexa-card-premium border-[#c9a227]/30">
        <CardHeader className="border-[#c9a227]/20">
          <CardTitle>Checkout records</CardTitle>
          <CardDescription>
            Each row is a pack purchase for one student. Retries stay on the same checkout when
            payment failed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState
              kind="payments"
              title="No payments yet"
              description="When a parent checks out a pack for this year and class, it will appear here."
            />
          ) : (
            <ul className="space-y-3">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="rounded-xl border border-[#c9a227]/25 bg-white/80 p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-[#6b1d2a]">{row.student_name_snapshot}</p>
                      <p className="text-sm text-zinc-600">
                        {row.pack_name_snapshot} · {packTypeLabel(row.pack_type_snapshot)}
                      </p>
                      <p className="text-sm text-zinc-500">
                        {row.academic_year_name_snapshot} · {row.class_name_snapshot}
                      </p>
                    </div>
                    <div className="text-sm sm:text-right">
                      <p className="font-medium text-[#6b1d2a]">{formatInr(toAmount(row.amount_snapshot))}</p>
                      <p>{paymentStatusLabel(row.payment_status)}</p>
                      <p className="text-zinc-500">{new Date(row.created_at).toLocaleString("en-IN")}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

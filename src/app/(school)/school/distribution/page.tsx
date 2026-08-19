import AbpsOrnament from "@/components/brand/abps-ornament";
import { EmptyState } from "@/components/brand/empty-state";
import { FoundationForm } from "@/components/forms/foundation-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recordDistributionAction } from "@/features/school/distribution-actions";
import { requireSchoolAdmin } from "@/lib/auth/workspace";
import { packTypeLabel } from "@/lib/payments/display";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const fieldClass =
  "border-[#6b1d2a]/20 text-base text-[#6b1d2a] focus-visible:ring-[#6b1d2a] sm:text-sm";
const selectClassName =
  "h-10 w-full rounded-md border border-[#6b1d2a]/20 bg-white px-3 text-base text-[#6b1d2a] sm:text-sm";
const schoolSubmitClass =
  "bg-[#6b1d2a] text-[#f7e0a3] hover:bg-[#4a121c] focus-visible:ring-[#6b1d2a]";

const STATUS_FILTERS = [
  { value: "not_distributed", label: "Not Distributed" },
  { value: "partial", label: "Partially Distributed" },
  { value: "fully_distributed", label: "Fully Distributed" },
] as const;

type DistributionStatus = (typeof STATUS_FILTERS)[number]["value"];

type OrderItemRow = {
  id: string;
  product_variant_id: string;
  name_snapshot: string;
  quantity: number;
};

function classLabel(name: string, section: string | null) {
  return section ? `Class ${name} · ${section}` : `Class ${name}`;
}

function receiptLabel(id: string) {
  return id.replace(/-/g, "").slice(-8).toUpperCase();
}

function istTodayStamp(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function distributionStatusLabel(status: DistributionStatus) {
  if (status === "fully_distributed") {
    return "Fully Distributed";
  }
  if (status === "partial") {
    return "Partially Distributed";
  }
  return "Not Distributed";
}

function statusOf(paid: number, distributed: number): DistributionStatus {
  if (distributed <= 0) {
    return "not_distributed";
  }
  if (distributed >= paid && paid > 0) {
    return "fully_distributed";
  }
  return "partial";
}

export default async function DistributionPage({
  searchParams,
}: {
  searchParams: Promise<{
    yearId?: string;
    classId?: string;
    studentId?: string;
    receipt?: string;
    status?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const { schoolId } = await requireSchoolAdmin();
  const filters = await searchParams;
  const supabase = await createServerSupabaseClient();

  const [
    { data: years, error: yearsError },
    { data: classes, error: classesError },
    { data: school },
  ] = await Promise.all([
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
    supabase.from("schools").select("name").eq("id", schoolId).maybeSingle(),
  ]);

  const selectedYearId =
    filters.yearId && (years ?? []).some((row) => row.id === filters.yearId)
      ? filters.yearId
      : (years?.[0]?.id ?? "");
  const selectedClassId =
    filters.classId && (classes ?? []).some((row) => row.id === filters.classId) ? filters.classId : "";
  const statusFilter = STATUS_FILTERS.some((item) => item.value === filters.status)
    ? (filters.status as DistributionStatus)
    : "";
  const receiptQuery = (filters.receipt ?? "").trim();
  const studentFilter = filters.studentId ?? "";

  let ordersQuery = supabase
    .from("orders")
    .select(
      "id, payment_status, created_at, pack_id, student_id, parent_id, academic_year_id, class_id, pack_name_snapshot, pack_type_snapshot, student_name_snapshot, school_name_snapshot, academic_year_name_snapshot, class_name_snapshot, order_items ( id, product_variant_id, name_snapshot, quantity )",
    )
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });

  if (selectedYearId) {
    ordersQuery = ordersQuery.eq("academic_year_id", selectedYearId);
  }
  if (selectedClassId) {
    ordersQuery = ordersQuery.eq("class_id", selectedClassId);
  }
  if (studentFilter) {
    ordersQuery = ordersQuery.eq("student_id", studentFilter);
  }
  if (filters.from) {
    ordersQuery = ordersQuery.gte("created_at", `${filters.from}T00:00:00.000Z`);
  }
  if (filters.to) {
    ordersQuery = ordersQuery.lte("created_at", `${filters.to}T23:59:59.999Z`);
  }

  const uuidLike =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      receiptQuery,
    );

  let summaryQuery = supabase
    .from("orders")
    .select("id, payment_status, order_items ( id, quantity )")
    .eq("school_id", schoolId)
    .eq("payment_status", "successful");
  if (selectedYearId) {
    summaryQuery = summaryQuery.eq("academic_year_id", selectedYearId);
  }
  if (selectedClassId) {
    summaryQuery = summaryQuery.eq("class_id", selectedClassId);
  }

  const [
    { data: orders, error: ordersError },
    { data: summaryOrders, error: summaryError },
    { data: events, error: eventsError },
    { data: balances, error: balanceError },
    receiptLookup,
  ] = await Promise.all([
    ordersQuery,
    summaryQuery,
    supabase
      .from("distribution_events")
      .select("id, order_id, order_item_id, quantity, note, created_at")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false }),
    supabase
      .from("inventory_balances")
      .select("product_variant_id, on_hand, distributed")
      .eq("school_id", schoolId),
    uuidLike
      ? supabase
          .from("orders")
          .select(
            "id, payment_status, created_at, pack_id, student_id, parent_id, academic_year_id, class_id, pack_name_snapshot, pack_type_snapshot, student_name_snapshot, school_name_snapshot, academic_year_name_snapshot, class_name_snapshot, order_items ( id, product_variant_id, name_snapshot, quantity )",
          )
          .eq("school_id", schoolId)
          .eq("id", receiptQuery)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const loadError =
    yearsError?.message ||
    classesError?.message ||
    ordersError?.message ||
    summaryError?.message ||
    eventsError?.message ||
    balanceError?.message ||
    receiptLookup.error?.message ||
    null;

  const availableByVariant = new Map<string, number>();
  for (const row of balances ?? []) {
    availableByVariant.set(row.product_variant_id, row.on_hand - row.distributed);
  }

  const issuedByItem = new Map<string, number>();
  const eventsByOrder = new Map<
    string,
    Array<{ id: string; order_item_id: string; quantity: number; note: string | null; created_at: string }>
  >();
  for (const event of events ?? []) {
    issuedByItem.set(event.order_item_id, (issuedByItem.get(event.order_item_id) ?? 0) + event.quantity);
    const list = eventsByOrder.get(event.order_id) ?? [];
    if (list.length < 8) {
      list.push(event);
      eventsByOrder.set(event.order_id, list);
    }
  }

  type OrderRow = NonNullable<typeof orders>[number];
  const byId = new Map<string, OrderRow>();
  for (const order of orders ?? []) {
    byId.set(order.id, order);
  }
  if (receiptLookup.data && !byId.has(receiptLookup.data.id)) {
    byId.set(receiptLookup.data.id, receiptLookup.data);
  }

  const parentIds = [...new Set([...byId.values()].map((row) => row.parent_id).filter(Boolean))];
  const { data: parents } =
    parentIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", parentIds)
      : { data: [] as Array<{ id: string; full_name: string }> };
  const parentName = new Map((parents ?? []).map((row) => [row.id, row.full_name]));

  const students = [...byId.values()]
    .map((row) => ({ id: row.student_id, name: row.student_name_snapshot }))
    .filter((row, index, list) => list.findIndex((item) => item.id === row.id) === index)
    .sort((a, b) => a.name.localeCompare(b.name));

  const receiptNeedle = receiptQuery.replace(/-/g, "").toLowerCase();

  const rows = [...byId.values()]
    .map((order) => {
      const items = (Array.isArray(order.order_items) ? order.order_items : []) as OrderItemRow[];
      const detail = items.map((item) => {
        const required = Number(item.quantity);
        const distributed = issuedByItem.get(item.id) ?? 0;
        const remaining = Math.max(0, required - distributed);
        return {
          ...item,
          required,
          distributed,
          remaining,
          available: availableByVariant.get(item.product_variant_id) ?? 0,
        };
      });
      const paidTotal = detail.reduce((sum, item) => sum + item.required, 0);
      const distributedTotal = detail.reduce((sum, item) => sum + item.distributed, 0);
      const remainingTotal = detail.reduce((sum, item) => sum + item.remaining, 0);
      return {
        ...order,
        items: detail,
        paidTotal,
        distributedTotal,
        remainingTotal,
        status: statusOf(paidTotal, distributedTotal),
        parentName: parentName.get(order.parent_id)?.trim() || "Parent",
        schoolName: order.school_name_snapshot || school?.name || "School",
        movements: eventsByOrder.get(order.id) ?? [],
      };
    })
    .filter((row) => {
      if (receiptNeedle) {
        const compact = row.id.replace(/-/g, "").toLowerCase();
        if (!compact.includes(receiptNeedle) && !receiptLabel(row.id).toLowerCase().includes(receiptNeedle)) {
          return false;
        }
      }
      if (row.payment_status !== "successful" && !receiptNeedle) {
        return false;
      }
      if (!receiptNeedle && row.payment_status === "successful") {
        return true;
      }
      return true;
    })
    .filter((row) => !statusFilter || row.status === statusFilter);

  const todayStamp = istTodayStamp();
  const todayEventOrderIds = new Set(
    (events ?? [])
      .filter((event) => istTodayStamp(new Date(event.created_at)) === todayStamp)
      .map((event) => event.order_id),
  );

  const summarySource = (summaryOrders ?? []).map((order) => {
    const items = (Array.isArray(order.order_items) ? order.order_items : []) as Array<{
      id: string;
      quantity: number;
    }>;
    const paid = items.reduce((sum, item) => sum + Number(item.quantity), 0);
    const distributed = items.reduce((sum, item) => sum + (issuedByItem.get(item.id) ?? 0), 0);
    return { id: order.id, status: statusOf(paid, distributed) };
  });

  const todayCollections = summarySource.filter((row) => todayEventOrderIds.has(row.id));
  const todayFully = todayCollections.filter((row) => row.status === "fully_distributed").length;
  const todayPartial = todayCollections.filter((row) => row.status === "partial").length;
  const todayPending = summarySource.filter((row) => row.status === "not_distributed").length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="border-b border-[#c9a227]/30 pb-5 sm:pb-6">
        <p className="acadexa-kicker text-[#6b1d2a]">School administration</p>
        <h1 className="acadexa-display mt-2 text-2xl text-[#6b1d2a] sm:text-3xl">Distribution</h1>
        <AbpsOrnament className="mt-2 h-3 w-32" />
        <p className="acadexa-lede mt-3 max-w-2xl text-zinc-600">
          Hand over paid packs from this school’s inventory. Partial issues are allowed.
          Each handover is appended to the ledger and never overwrites earlier records.
        </p>
      </div>

      {loadError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          Could not load distribution. Try again.
        </p>
      ) : null}

      <Card className="acadexa-anim-fade-up acadexa-card-premium border-[#c9a227]/30">
        <CardHeader className="border-[#c9a227]/20">
          <CardTitle>Filter</CardTitle>
          <CardDescription>
            Find paid packs by year, class, student, receipt, status, and date.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="grid gap-1 text-sm">
              <span>Academic year</span>
              <select name="yearId" defaultValue={selectedYearId} className={selectClassName}>
                {!(years ?? []).length ? <option value="">No years</option> : null}
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
              <span>Student</span>
              <select name="studentId" defaultValue={studentFilter} className={selectClassName}>
                <option value="">All students</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span>Receipt / order</span>
              <input
                name="receipt"
                defaultValue={receiptQuery}
                className={selectClassName}
                placeholder="Order id or last 8 characters"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span>Distribution status</span>
              <select name="status" defaultValue={statusFilter} className={selectClassName}>
                <option value="">All statuses</option>
                {STATUS_FILTERS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span>From date</span>
              <input type="date" name="from" defaultValue={filters.from ?? ""} className={selectClassName} />
            </label>
            <label className="grid gap-1 text-sm">
              <span>To date</span>
              <input type="date" name="to" defaultValue={filters.to ?? ""} className={selectClassName} />
            </label>
            <div className="sm:col-span-2 lg:col-span-3">
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-md border border-[#c9a227]/50 bg-white px-4 text-sm font-medium text-[#6b1d2a] hover:bg-[#faf6ef]"
              >
                Show collections
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div>
        <p className="mb-3 text-sm font-medium text-[#6b1d2a]">Today’s distribution</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="acadexa-card-premium border-[#c9a227]/30">
            <CardHeader className="border-0 pb-0">
              <CardDescription>Total collections</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <p className="acadexa-display text-2xl text-[#6b1d2a]">{todayCollections.length}</p>
            </CardContent>
          </Card>
          <Card className="acadexa-card-premium border-[#c9a227]/30">
            <CardHeader className="border-0 pb-0">
              <CardDescription>Fully distributed</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <p className="acadexa-display text-2xl text-[#6b1d2a]">{todayFully}</p>
            </CardContent>
          </Card>
          <Card className="acadexa-card-premium border-[#c9a227]/30">
            <CardHeader className="border-0 pb-0">
              <CardDescription>Partially distributed</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <p className="acadexa-display text-2xl text-[#6b1d2a]">{todayPartial}</p>
            </CardContent>
          </Card>
          <Card className="acadexa-card-premium border-[#c9a227]/30">
            <CardHeader className="border-0 pb-0">
              <CardDescription>Pending</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <p className="acadexa-display text-2xl text-[#6b1d2a]">{todayPending}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="acadexa-anim-fade-up acadexa-card-premium border-[#c9a227]/30">
        <CardHeader className="border-[#c9a227]/20">
          <CardTitle>Paid packs ready for collection</CardTitle>
          <CardDescription>
            Only successful checkouts can be issued. Remaining cannot exceed paid quantity or
            available stock.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState
              kind="distribution"
              title="No packs ready to collect"
              description="When a parent successfully pays for a pack in this year and class, it will appear here for handover."
            />
          ) : (
            <ul className="space-y-4">
              {rows.map((row) => {
                const canDistribute = row.payment_status === "successful" && row.remainingTotal > 0;
                return (
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
                          Receipt {receiptLabel(row.id)} · {new Date(row.created_at).toLocaleString("en-IN")}
                        </p>
                      </div>
                      <span
                        className={
                          row.payment_status !== "successful"
                            ? "rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-red-800"
                            : row.status === "fully_distributed"
                              ? "rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-emerald-800"
                              : row.status === "partial"
                                ? "rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-amber-800"
                                : "rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-zinc-700"
                        }
                      >
                        {row.payment_status !== "successful"
                          ? "Payment not successful"
                          : distributionStatusLabel(row.status)}
                      </span>
                    </div>

                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
                      <div>
                        <dt className="text-zinc-500">Student</dt>
                        <dd className="font-medium text-[#6b1d2a]">{row.student_name_snapshot}</dd>
                      </div>
                      <div>
                        <dt className="text-zinc-500">Parent</dt>
                        <dd className="font-medium text-[#6b1d2a]">{row.parentName}</dd>
                      </div>
                      <div>
                        <dt className="text-zinc-500">School</dt>
                        <dd className="font-medium text-[#6b1d2a]">{row.schoolName}</dd>
                      </div>
                      <div>
                        <dt className="text-zinc-500">Class</dt>
                        <dd className="font-medium text-[#6b1d2a]">{row.class_name_snapshot}</dd>
                      </div>
                      <div>
                        <dt className="text-zinc-500">Academic year</dt>
                        <dd className="font-medium text-[#6b1d2a]">{row.academic_year_name_snapshot}</dd>
                      </div>
                      <div>
                        <dt className="text-zinc-500">Paid pack</dt>
                        <dd className="font-medium text-[#6b1d2a]">{row.pack_name_snapshot}</dd>
                      </div>
                    </dl>

                    <div className="mt-4 overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-[#c9a227]/20 text-zinc-500">
                            <th className="py-2 pr-3 font-medium">Item</th>
                            <th className="py-2 pr-3 font-medium">Required</th>
                            <th className="py-2 pr-3 font-medium">Distributed</th>
                            <th className="py-2 pr-3 font-medium">Remaining</th>
                            <th className="py-2 font-medium">Stock left</th>
                          </tr>
                        </thead>
                        <tbody>
                          {row.items.map((item) => (
                            <tr key={item.id} className="border-b border-[#c9a227]/10">
                              <td className="py-2 pr-3 text-[#6b1d2a]">{item.name_snapshot}</td>
                              <td className="py-2 pr-3">{item.required}</td>
                              <td className="py-2 pr-3">{item.distributed}</td>
                              <td className="py-2 pr-3">{item.remaining}</td>
                              <td className="py-2">{item.available}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {row.payment_status !== "successful" ? (
                      <p className="mt-3 text-sm text-red-800" role="alert">
                        Only successfully paid orders can be distributed.
                      </p>
                    ) : null}

                    {canDistribute ? (
                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        <div>
                          <p className="text-sm font-medium text-[#6b1d2a]">Record distribution</p>
                          <FoundationForm
                            action={recordDistributionAction}
                            submitLabel="Record distribution"
                            submitClassName={schoolSubmitClass}
                          >
                            <input type="hidden" name="orderId" value={row.id} />
                            <div className="space-y-3">
                              {row.items.map((item) => (
                                <div key={item.id} className="space-y-1">
                                  <Label htmlFor={`qty-${item.id}`}>
                                    {item.name_snapshot} (remaining {item.remaining})
                                  </Label>
                                  <Input
                                    id={`qty-${item.id}`}
                                    name={`qty:${item.id}`}
                                    type="number"
                                    min={0}
                                    step={1}
                                    defaultValue={Math.min(item.remaining, Math.max(0, item.available))}
                                    className={fieldClass}
                                  />
                                </div>
                              ))}
                              <div className="space-y-1">
                                <Label htmlFor={`note-${row.id}`}>Note (optional)</Label>
                                <Input
                                  id={`note-${row.id}`}
                                  name="note"
                                  className={fieldClass}
                                  placeholder="Counter 1 · partial issue"
                                />
                              </div>
                            </div>
                          </FoundationForm>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#6b1d2a]">Recent movements</p>
                          {row.movements.length === 0 ? (
                            <p className="mt-2 text-sm text-zinc-500">No distribution recorded yet.</p>
                          ) : (
                            <ul className="mt-2 divide-y divide-[#c9a227]/20 rounded-lg border border-[#c9a227]/20 text-sm">
                              {row.movements.map((movement) => (
                                <li key={movement.id} className="px-3 py-2">
                                  <span className="font-medium text-[#6b1d2a]">Issued {movement.quantity}</span>
                                  <span className="block text-zinc-500">
                                    {new Date(movement.created_at).toLocaleString("en-IN")}
                                    {movement.note ? ` · ${movement.note}` : ""}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    ) : row.payment_status === "successful" ? (
                      <p className="mt-3 text-sm text-zinc-600">This pack is fully distributed.</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import AbpsOrnament from "@/components/brand/abps-ornament";
import { EmptyState } from "@/components/brand/empty-state";
import { FoundationForm } from "@/components/forms/foundation-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recordInventoryMovementAction } from "@/features/school/inventory-actions";
import { requireSchoolAdmin } from "@/lib/auth/workspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const fieldClass =
  "border-[#6b1d2a]/20 text-base text-[#6b1d2a] focus-visible:ring-[#6b1d2a] sm:text-sm";
const selectClassName =
  "h-10 w-full rounded-md border border-[#6b1d2a]/20 bg-white px-3 text-base text-[#6b1d2a] sm:text-sm";
const schoolSubmitClass =
  "bg-[#6b1d2a] text-[#f7e0a3] hover:bg-[#4a121c] focus-visible:ring-[#6b1d2a]";

const CATEGORIES = [
  { value: "book", label: "Books" },
  { value: "uniform", label: "Uniform" },
  { value: "other", label: "Other" },
] as const;

type ProductInfo = {
  name: string;
  kind: "book" | "uniform" | "other";
};

type VariantInfo = {
  id: string;
  products: ProductInfo | ProductInfo[] | null;
};

function asRelated<T extends object>(value: unknown): T | null {
  if (!value) {
    return null;
  }
  if (Array.isArray(value)) {
    return (value[0] as T | undefined) ?? null;
  }
  return value as T;
}

function classLabel(name: string, section: string | null) {
  return section ? `Class ${name} · ${section}` : `Class ${name}`;
}

function categoryLabel(kind: string) {
  return CATEGORIES.find((item) => item.value === kind)?.label ?? kind;
}

function reasonLabel(reason: string) {
  switch (reason) {
    case "stock_in":
      return "Stock in";
    case "adjustment":
      return "Adjustment";
    case "reserve_on_payment":
      return "Reserved on payment";
    case "release_on_refund":
      return "Released on refund";
    case "distribute":
      return "Distributed";
    default:
      return reason;
  }
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    yearId?: string;
    classId?: string;
    kind?: string;
    status?: string;
  }>;
}) {
  const { schoolId } = await requireSchoolAdmin();
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();

  const [yearsResult, classesResult, currentYearResult] = await Promise.all([
    supabase
      .from("academic_years")
      .select("id, name, is_current")
      .eq("school_id", schoolId)
      .order("starts_on", { ascending: false }),
    supabase
      .from("classes")
      .select("id, name, section, sort_order")
      .eq("school_id", schoolId)
      .order("sort_order")
      .order("name"),
    supabase
      .from("academic_years")
      .select("id")
      .eq("school_id", schoolId)
      .eq("is_current", true)
      .maybeSingle(),
  ]);

  const years = yearsResult.data ?? [];
  const classes = classesResult.data ?? [];
  const selectedYearId =
    params.yearId && years.some((year) => year.id === params.yearId)
      ? params.yearId
      : (currentYearResult.data?.id ?? years[0]?.id ?? "");
  const selectedClassId =
    params.classId && classes.some((klass) => klass.id === params.classId) ? params.classId : "";
  const selectedKind = CATEGORIES.some((item) => item.value === params.kind) ? params.kind : "";
  const selectedStatus =
    params.status === "active" || params.status === "inactive" ? params.status : "";

  let requirementQuery = supabase
    .from("school_requirements")
    .select(
      "id, required_quantity, is_active, academic_year_id, class_id, product_variant_id, product_variants ( id, products ( name, kind ) )",
    )
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });
  if (selectedYearId) {
    requirementQuery = requirementQuery.eq("academic_year_id", selectedYearId);
  }
  if (selectedClassId) {
    requirementQuery = requirementQuery.eq("class_id", selectedClassId);
  }
  if (selectedStatus === "active") {
    requirementQuery = requirementQuery.eq("is_active", true);
  }
  if (selectedStatus === "inactive") {
    requirementQuery = requirementQuery.eq("is_active", false);
  }

  const [
    { data: requirementRows, error: requirementError },
    { data: balances, error: balanceError },
    { data: paidOrders, error: orderError },
    { data: movements, error: movementError },
  ] = await Promise.all([
    requirementQuery,
    supabase
      .from("inventory_balances")
      .select("product_variant_id, on_hand, distributed")
      .eq("school_id", schoolId),
    supabase
      .from("orders")
      .select("id, academic_year_id, class_id, order_items ( product_variant_id, quantity )")
      .eq("school_id", schoolId)
      .eq("payment_status", "successful"),
    supabase
      .from("inventory_transactions")
      .select("id, product_variant_id, reason, on_hand_delta, distributed_delta, note, created_at")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(80),
  ]);

  const loadError =
    yearsResult.error?.message ||
    classesResult.error?.message ||
    requirementError?.message ||
    balanceError?.message ||
    orderError?.message ||
    movementError?.message ||
    null;

  const onHandByVariant = new Map<string, number>();
  const distributedByVariant = new Map<string, number>();
  for (const row of balances ?? []) {
    onHandByVariant.set(row.product_variant_id, row.on_hand);
    distributedByVariant.set(row.product_variant_id, row.distributed);
  }

  const reservedByVariant = new Map<string, number>();
  for (const order of paidOrders ?? []) {
    if (selectedYearId && order.academic_year_id !== selectedYearId) {
      continue;
    }
    if (selectedClassId && order.class_id !== selectedClassId) {
      continue;
    }
    const items = Array.isArray(order.order_items) ? order.order_items : [];
    for (const item of items) {
      reservedByVariant.set(
        item.product_variant_id,
        (reservedByVariant.get(item.product_variant_id) ?? 0) + Number(item.quantity ?? 0),
      );
    }
  }

  const movementsByVariant = new Map<
    string,
    Array<{
      id: string;
      product_variant_id: string;
      reason: string;
      on_hand_delta: number;
      distributed_delta: number;
      note: string | null;
      created_at: string;
    }>
  >();
  for (const row of movements ?? []) {
    const list = movementsByVariant.get(row.product_variant_id) ?? [];
    if (list.length < 6) {
      list.push(row);
      movementsByVariant.set(row.product_variant_id, list);
    }
  }

  const rows = (requirementRows ?? [])
    .map((row) => {
      const variant = asRelated<VariantInfo>(row.product_variants);
      const product = asRelated<ProductInfo>(variant?.products);
      const variantId = (variant?.id ?? row.product_variant_id) as string;
      const required = row.required_quantity as number;
      const available = onHandByVariant.get(variantId) ?? 0;
      const reserved = reservedByVariant.get(variantId) ?? 0;
      const distributed = distributedByVariant.get(variantId) ?? 0;
      const remaining = Math.max(0, available - reserved);
      const kind = product?.kind ?? "other";
      let stockStatus: "ok" | "low" | "out" = "ok";
      if (remaining <= 0) {
        stockStatus = "out";
      } else if (remaining <= required) {
        stockStatus = "low";
      }
      return {
        id: row.id as string,
        variantId,
        name: product?.name ?? "Untitled item",
        kind,
        required,
        available,
        reserved,
        distributed,
        remaining,
        stockStatus,
        isActive: Boolean(row.is_active),
        academicYearId: row.academic_year_id as string,
        classId: row.class_id as string,
        movements: movementsByVariant.get(variantId) ?? [],
      };
    })
    .filter((row) => !selectedKind || row.kind === selectedKind);

  const yearName = new Map(years.map((year) => [year.id, year.name]));
  const className = new Map(classes.map((klass) => [klass.id, classLabel(klass.name, klass.section)]));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="border-b border-[#c9a227]/30 pb-5 sm:pb-6">
        <p className="acadexa-kicker text-[#6b1d2a]">School administration</p>
        <h1 className="acadexa-display mt-2 text-2xl text-[#6b1d2a] sm:text-3xl">Inventory</h1>
        <AbpsOrnament className="mt-2 h-3 w-32" />
        <p className="acadexa-lede mt-3 max-w-2xl text-zinc-600">
          Stock for this school’s requirements. Paid quantities come from successful
          checkouts. Stock changes are recorded as movements, not overwrites.
        </p>
      </div>

      {loadError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          Could not load inventory. Try again.
        </p>
      ) : null}

      <Card className="acadexa-anim-fade-up acadexa-card-premium border-[#c9a227]/30">
        <CardHeader className="border-[#c9a227]/20">
          <CardTitle>Filter</CardTitle>
          <CardDescription>
            Inventory rows follow the selected year, class, category, and requirement status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="grid gap-1 text-sm">
              <span>Academic year</span>
              <select name="yearId" defaultValue={selectedYearId} className={selectClassName}>
                {years.length === 0 ? <option value="">No years</option> : null}
                {years.map((year) => (
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
                {classes.map((klass) => (
                  <option key={klass.id} value={klass.id}>
                    {classLabel(klass.name, klass.section)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span>Category</span>
              <select name="kind" defaultValue={selectedKind} className={selectClassName}>
                <option value="">All categories</option>
                {CATEGORIES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span>Requirement status</span>
              <select name="status" defaultValue={selectedStatus} className={selectClassName}>
                <option value="">Active and inactive</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <div className="sm:col-span-2 lg:col-span-4">
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-md border border-[#c9a227]/50 bg-white px-4 text-sm font-medium text-[#6b1d2a] hover:bg-[#faf6ef]"
              >
                Show inventory
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="acadexa-anim-fade-up acadexa-card-premium border-[#c9a227]/30">
        <CardHeader className="border-[#c9a227]/20">
          <CardTitle>Stock by requirement</CardTitle>
          <CardDescription>
            Remaining is available stock minus paid/reserved quantity. Negative stock is blocked.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState
              kind="inventory"
              title="No inventory rows yet"
              description="Add requirements for this year and class, then record stock in or adjustments here."
            />
          ) : (
            <ul className="space-y-4">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="rounded-xl border border-[#c9a227]/25 bg-white/80 p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-[#6b1d2a]">{row.name}</p>
                      <p className="text-sm text-zinc-600">
                        {categoryLabel(row.kind)} · {yearName.get(row.academicYearId) ?? "Year"} ·{" "}
                        {className.get(row.classId) ?? "Class"}
                        {row.isActive ? "" : " · Inactive"}
                      </p>
                    </div>
                    <span
                      className={
                        row.stockStatus === "out"
                          ? "rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-red-800"
                          : row.stockStatus === "low"
                            ? "rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-amber-800"
                            : "rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-emerald-800"
                      }
                    >
                      {row.stockStatus === "out"
                        ? "Out of stock"
                        : row.stockStatus === "low"
                          ? "Low stock"
                          : "In stock"}
                    </span>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
                    <div>
                      <dt className="text-zinc-500">Required</dt>
                      <dd className="font-medium text-[#6b1d2a]">{row.required}</dd>
                    </div>
                    <div>
                      <dt className="text-zinc-500">Available</dt>
                      <dd className="font-medium text-[#6b1d2a]">{row.available}</dd>
                    </div>
                    <div>
                      <dt className="text-zinc-500">Paid / reserved</dt>
                      <dd className="font-medium text-[#6b1d2a]">{row.reserved}</dd>
                    </div>
                    <div>
                      <dt className="text-zinc-500">Distributed</dt>
                      <dd className="font-medium text-[#6b1d2a]">{row.distributed}</dd>
                    </div>
                    <div>
                      <dt className="text-zinc-500">Remaining</dt>
                      <dd className="font-medium text-[#6b1d2a]">{row.remaining}</dd>
                    </div>
                    <div>
                      <dt className="text-zinc-500">Category</dt>
                      <dd className="font-medium text-[#6b1d2a]">{categoryLabel(row.kind)}</dd>
                    </div>
                  </dl>

                  {row.distributed > row.reserved || row.distributed > row.available ? (
                    <p className="mt-3 text-sm text-red-800" role="alert">
                      Distributed quantity cannot exceed available or reserved quantity.
                    </p>
                  ) : null}

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-[#6b1d2a]">Add or adjust stock</p>
                      <FoundationForm
                        action={recordInventoryMovementAction}
                        submitLabel="Record movement"
                        submitClassName={schoolSubmitClass}
                      >
                        <input type="hidden" name="variantId" value={row.variantId} />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label htmlFor={`reason-${row.id}`}>Movement</Label>
                            <select
                              id={`reason-${row.id}`}
                              name="reason"
                              className={selectClassName}
                              defaultValue="stock_in"
                            >
                              <option value="stock_in">Add stock</option>
                              <option value="adjustment">Adjust stock</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`qty-${row.id}`}>Quantity</Label>
                            <Input
                              id={`qty-${row.id}`}
                              name="quantity"
                              type="number"
                              step="1"
                              required
                              className={fieldClass}
                              placeholder="10 or -1"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`note-${row.id}`}>Note (optional)</Label>
                          <Input
                            id={`note-${row.id}`}
                            name="note"
                            className={fieldClass}
                            placeholder="Opening stock"
                          />
                        </div>
                      </FoundationForm>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#6b1d2a]">Recent movements</p>
                      {row.movements.length === 0 ? (
                        <p className="mt-2 text-sm text-zinc-500">No movements yet.</p>
                      ) : (
                        <ul className="mt-2 divide-y divide-[#c9a227]/20 rounded-lg border border-[#c9a227]/20 text-sm">
                          {row.movements.map((movement) => (
                            <li key={movement.id} className="px-3 py-2">
                              <span className="font-medium text-[#6b1d2a]">
                                {reasonLabel(movement.reason)}{" "}
                                {movement.reason === "distribute"
                                  ? `+${movement.distributed_delta}`
                                  : `${movement.on_hand_delta > 0 ? "+" : ""}${movement.on_hand_delta}`}
                              </span>
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
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

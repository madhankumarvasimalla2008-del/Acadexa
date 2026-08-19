import AbpsOrnament from "@/components/brand/abps-ornament";
import { EmptyState } from "@/components/brand/empty-state";
import { FoundationForm } from "@/components/forms/foundation-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addPackItemAction,
  createPackAction,
  deletePackAction,
  deletePackItemAction,
  updatePackAction,
  updatePackItemAction,
} from "@/features/school/pack-actions";
import { requireSchoolAdmin } from "@/lib/auth/workspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const fieldClass =
  "border-[#6b1d2a]/20 text-base text-[#6b1d2a] focus-visible:ring-[#6b1d2a] sm:text-sm";
const selectClassName =
  "h-10 w-full rounded-md border border-[#6b1d2a]/20 bg-white px-3 text-base text-[#6b1d2a] sm:text-sm";
const schoolSubmitClass =
  "bg-[#6b1d2a] text-[#f7e0a3] hover:bg-[#4a121c] focus-visible:ring-[#6b1d2a]";

const PACK_TYPES = [
  { value: "book_pack", label: "Book Pack" },
  { value: "uniform_pack", label: "Uniform Pack" },
  { value: "complete_pack", label: "Complete Pack" },
  { value: "custom_pack", label: "Custom Pack" },
] as const;

type ProductInfo = {
  name: string;
  kind: string;
  subject: string | null;
};

type VariantInfo = {
  id: string;
  unit_price_amount: number | string | null;
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

function packTypeLabel(value: string) {
  return PACK_TYPES.find((item) => item.value === value)?.label ?? value;
}

function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(value);
}

function toAmount(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

export default async function PacksPage({
  searchParams,
}: {
  searchParams: Promise<{ yearId?: string; classId?: string }>;
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
    params.classId && classes.some((klass) => klass.id === params.classId)
      ? params.classId
      : classes[0]?.id ?? "";

  let packsQuery = supabase
    .from("packs")
    .select("id, name, pack_type, price_amount, is_active, academic_year_id, class_id")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });
  if (selectedYearId) {
    packsQuery = packsQuery.eq("academic_year_id", selectedYearId);
  }
  if (selectedClassId) {
    packsQuery = packsQuery.eq("class_id", selectedClassId);
  }

  let requirementsQuery = supabase
    .from("school_requirements")
    .select(
      "id, required_quantity, product_variant_id, academic_year_id, class_id, product_variants ( id, unit_price_amount, products ( name, kind, subject ) )",
    )
    .eq("school_id", schoolId)
    .eq("is_active", true);
  if (selectedYearId) {
    requirementsQuery = requirementsQuery.eq("academic_year_id", selectedYearId);
  }
  if (selectedClassId) {
    requirementsQuery = requirementsQuery.eq("class_id", selectedClassId);
  }

  const [packsResult, itemsResult, requirementsResult] = await Promise.all([
    packsQuery,
    supabase
      .from("pack_items")
      .select(
        "id, pack_id, quantity, product_variant_id, product_variants ( id, unit_price_amount, products ( name, kind, subject ) )",
      )
      .eq("school_id", schoolId),
    requirementsQuery,
  ]);

  const loadError =
    yearsResult.error?.message ||
    classesResult.error?.message ||
    packsResult.error?.message ||
    itemsResult.error?.message ||
    requirementsResult.error?.message ||
    null;

  const requirements = (requirementsResult.data ?? []).map((row) => {
    const variant = asRelated<VariantInfo>(row.product_variants);
    const product = asRelated<ProductInfo>(variant?.products);
    return {
      id: row.id as string,
      variantId: row.product_variant_id as string,
      yearId: row.academic_year_id as string,
      classId: row.class_id as string,
      name: product?.name ?? "Untitled item",
      requiredQuantity: row.required_quantity as number,
      unitPrice: toAmount(variant?.unit_price_amount),
    };
  });

  const itemsByPack = new Map<
    string,
    Array<{
      id: string;
      variantId: string;
      name: string;
      quantity: number;
      unitPrice: number;
      lineValue: number;
    }>
  >();
  for (const row of itemsResult.data ?? []) {
    const variant = asRelated<VariantInfo>(row.product_variants);
    const product = asRelated<ProductInfo>(variant?.products);
    const quantity = row.quantity as number;
    const unitPrice = toAmount(variant?.unit_price_amount);
    const packId = row.pack_id as string;
    const list = itemsByPack.get(packId) ?? [];
    list.push({
      id: row.id as string,
      variantId: row.product_variant_id as string,
      name: product?.name ?? "Untitled item",
      quantity,
      unitPrice,
      lineValue: unitPrice * quantity,
    });
    itemsByPack.set(packId, list);
  }

  const packs = (packsResult.data ?? []).map((pack) => {
    const items = itemsByPack.get(pack.id) ?? [];
    const individualValue = items.reduce((sum, item) => sum + item.lineValue, 0);
    const packPrice = toAmount(pack.price_amount);
    return {
      id: pack.id as string,
      name: pack.name as string,
      packType: pack.pack_type as string,
      price: packPrice,
      isActive: Boolean(pack.is_active),
      academicYearId: pack.academic_year_id as string,
      classId: pack.class_id as string,
      items,
      individualValue,
      savings: individualValue - packPrice,
    };
  });

  const missingStructure = years.length === 0 || classes.length === 0;

  return (
    <div className="acadexa-anim-fade-up mx-auto max-w-6xl space-y-7 sm:space-y-10">
      <div className="border-b border-[#c9a227]/30 pb-5 sm:pb-6">
        <p className="acadexa-kicker text-[#c9a227]">School administration</p>
        <h1 className="acadexa-display mt-2 text-[1.65rem] text-[#6b1d2a] sm:text-3xl">Packs</h1>
        <AbpsOrnament className="mt-2.5 h-3.5 w-36" />
        <p className="acadexa-lede mt-2 max-w-2xl text-zinc-600">
          Bundles for one school, academic year, and class. Items come only from that
          class’s requirements.
        </p>
      </div>

      {loadError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          Could not load packs. Try again.
        </p>
      ) : null}

      <Card className="acadexa-anim-fade-up acadexa-card-premium border-[#c9a227]/30">
        <CardHeader className="border-[#c9a227]/20">
          <CardTitle className="text-[#6b1d2a]">Filter</CardTitle>
          <CardDescription>Packs and available items are limited to the selected year and class.</CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="yearId">Academic year</Label>
              <select id="yearId" name="yearId" className={selectClassName} defaultValue={selectedYearId}>
                {years.length === 0 ? (
                  <option value="">No years yet</option>
                ) : (
                  years.map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.name}
                      {year.is_current ? " (current)" : ""}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="classId">Class</Label>
              <select id="classId" name="classId" className={selectClassName} defaultValue={selectedClassId}>
                {classes.length === 0 ? (
                  <option value="">No classes yet</option>
                ) : (
                  classes.map((klass) => (
                    <option key={klass.id} value={klass.id}>
                      {classLabel(klass.name, klass.section)}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="inline-flex h-10 w-full items-center justify-center rounded-md border border-[#c9a227]/50 bg-white px-3 text-sm font-medium text-[#6b1d2a] hover:bg-[#faf6ef]"
              >
                Show packs
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="acadexa-anim-fade-up acadexa-card-premium border-[#c9a227]/30">
        <CardHeader className="border-[#c9a227]/20">
          <CardTitle className="text-[#6b1d2a]">Create pack</CardTitle>
          <CardDescription>
            Savings shown on each pack are the sum of item values minus the pack price.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {missingStructure ? (
            <EmptyState
              kind="packs"
              title="Add a year and a class first"
              description="Packs attach to an existing academic year and class for this school."
            />
          ) : (
            <FoundationForm
              action={createPackAction}
              submitLabel="Create pack"
              submitClassName={schoolSubmitClass}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="academicYearId">Academic year</Label>
                  <select
                    id="academicYearId"
                    name="academicYearId"
                    required
                    className={selectClassName}
                    defaultValue={selectedYearId}
                  >
                    {years.map((year) => (
                      <option key={year.id} value={year.id}>
                        {year.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="classIdCreate">Class</Label>
                  <select
                    id="classIdCreate"
                    name="classId"
                    required
                    className={selectClassName}
                    defaultValue={selectedClassId}
                  >
                    {classes.map((klass) => (
                      <option key={klass.id} value={klass.id}>
                        {classLabel(klass.name, klass.section)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <Label htmlFor="name">Pack name</Label>
              <Input id="name" name="name" required className={fieldClass} placeholder="Class 1 Book Pack" />
              <Label htmlFor="packType">Pack type</Label>
              <select id="packType" name="packType" required className={selectClassName} defaultValue="book_pack">
                {PACK_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <Label htmlFor="price">Pack price (INR)</Label>
              <Input
                id="price"
                name="price"
                type="number"
                min={0}
                step="0.01"
                required
                className={fieldClass}
                placeholder="0.00"
              />
              <label className="flex items-center gap-2 text-sm text-[#6b1d2a]">
                <input type="checkbox" name="isActive" defaultChecked className="h-4 w-4 accent-[#6b1d2a]" />
                Active
              </label>
            </FoundationForm>
          )}
        </CardContent>
      </Card>

      <Card className="acadexa-anim-fade-up acadexa-card-premium acadexa-delay-1 border-[#c9a227]/30">
        <CardHeader className="border-[#c9a227]/20">
          <CardTitle className="text-[#6b1d2a]">Packs</CardTitle>
          <CardDescription>
            Duplicate names for the same year and class are blocked. Remove is allowed until purchases exist.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {packs.length === 0 && !loadError ? (
            <EmptyState
              kind="packs"
              title="No packs yet"
              description="Create a pack for this year and class, then add requirements from the same class list."
            />
          ) : (
            <ul className="space-y-5">
              {packs.map((pack) => {
                const usedVariants = new Set(pack.items.map((item) => item.variantId));
                const availableRequirements = requirements.filter(
                  (requirement) =>
                    requirement.yearId === pack.academicYearId &&
                    requirement.classId === pack.classId &&
                    !usedVariants.has(requirement.variantId),
                );
                return (
                  <li
                    key={pack.id}
                    className="rounded-xl border border-[#c9a227]/25 bg-white/80 p-4 shadow-sm"
                  >
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <p className="font-medium text-[#6b1d2a]">{pack.name}</p>
                      <span className="rounded-full bg-[#faf6ef] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[#6b1d2a]">
                        {packTypeLabel(pack.packType)}
                      </span>
                      {pack.isActive ? null : (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-zinc-600">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="mb-4 text-sm text-zinc-600">
                      Item value {money(pack.individualValue)} · Pack price {money(pack.price)} ·
                      Savings {money(pack.savings)}
                    </p>
                    <FoundationForm
                      action={updatePackAction}
                      submitLabel="Save pack"
                      submitClassName={schoolSubmitClass}
                    >
                      <input type="hidden" name="id" value={pack.id} />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor={`year-${pack.id}`}>Academic year</Label>
                          <select
                            id={`year-${pack.id}`}
                            name="academicYearId"
                            required
                            className={selectClassName}
                            defaultValue={pack.academicYearId}
                          >
                            {years.map((year) => (
                              <option key={year.id} value={year.id}>
                                {year.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`class-${pack.id}`}>Class</Label>
                          <select
                            id={`class-${pack.id}`}
                            name="classId"
                            required
                            className={selectClassName}
                            defaultValue={pack.classId}
                          >
                            {classes.map((klass) => (
                              <option key={klass.id} value={klass.id}>
                                {classLabel(klass.name, klass.section)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <Label htmlFor={`name-${pack.id}`}>Pack name</Label>
                      <Input
                        id={`name-${pack.id}`}
                        name="name"
                        required
                        defaultValue={pack.name}
                        className={fieldClass}
                      />
                      <Label htmlFor={`type-${pack.id}`}>Pack type</Label>
                      <select
                        id={`type-${pack.id}`}
                        name="packType"
                        required
                        className={selectClassName}
                        defaultValue={pack.packType}
                      >
                        {PACK_TYPES.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                      <Label htmlFor={`price-${pack.id}`}>Pack price (INR)</Label>
                      <Input
                        id={`price-${pack.id}`}
                        name="price"
                        type="number"
                        min={0}
                        step="0.01"
                        required
                        defaultValue={pack.price}
                        className={fieldClass}
                      />
                      <label className="flex items-center gap-2 text-sm text-[#6b1d2a]">
                        <input
                          type="checkbox"
                          name="isActive"
                          defaultChecked={pack.isActive}
                          className="h-4 w-4 accent-[#6b1d2a]"
                        />
                        Active
                      </label>
                    </FoundationForm>

                    <div className="mt-5 space-y-3 border-t border-[#c9a227]/20 pt-4">
                      <p className="text-sm font-medium text-[#6b1d2a]">Included items</p>
                      {pack.items.length === 0 ? (
                        <p className="text-sm text-zinc-500">No items yet.</p>
                      ) : (
                        <ul className="space-y-3">
                          {pack.items.map((item) => (
                            <li key={item.id} className="rounded-lg border border-[#6b1d2a]/10 p-3">
                              <p className="text-sm text-[#6b1d2a]">
                                {item.name} · {money(item.unitPrice)} each · line {money(item.lineValue)}
                              </p>
                              <FoundationForm
                                action={updatePackItemAction}
                                submitLabel="Update quantity"
                                submitClassName={schoolSubmitClass}
                              >
                                <input type="hidden" name="id" value={item.id} />
                                <input type="hidden" name="packId" value={pack.id} />
                                <Label htmlFor={`qty-${item.id}`}>Quantity</Label>
                                <Input
                                  id={`qty-${item.id}`}
                                  name="quantity"
                                  type="number"
                                  min={1}
                                  required
                                  defaultValue={item.quantity}
                                  className={fieldClass}
                                />
                              </FoundationForm>
                              <FoundationForm
                                action={deletePackItemAction}
                                submitLabel="Remove item"
                                submitVariant="outline"
                              >
                                <input type="hidden" name="id" value={item.id} />
                                <input type="hidden" name="packId" value={pack.id} />
                              </FoundationForm>
                            </li>
                          ))}
                        </ul>
                      )}
                      {availableRequirements.length === 0 ? (
                        <p className="text-sm text-zinc-500">
                          No unused requirements for this year and class.
                        </p>
                      ) : (
                        <FoundationForm
                          action={addPackItemAction}
                          submitLabel="Add item"
                          submitClassName={schoolSubmitClass}
                        >
                          <input type="hidden" name="packId" value={pack.id} />
                          <Label htmlFor={`req-${pack.id}`}>Requirement</Label>
                          <select
                            id={`req-${pack.id}`}
                            name="requirementId"
                            required
                            className={selectClassName}
                          >
                            {availableRequirements.map((requirement) => (
                              <option key={requirement.id} value={requirement.id}>
                                {requirement.name} · req {requirement.requiredQuantity} ·{" "}
                                {money(requirement.unitPrice)}
                              </option>
                            ))}
                          </select>
                          <Label htmlFor={`add-qty-${pack.id}`}>Included quantity</Label>
                          <Input
                            id={`add-qty-${pack.id}`}
                            name="quantity"
                            type="number"
                            min={1}
                            required
                            defaultValue={availableRequirements[0]?.requiredQuantity ?? 1}
                            className={fieldClass}
                          />
                        </FoundationForm>
                      )}
                    </div>

                    <div className="mt-4">
                      <FoundationForm
                        action={deletePackAction}
                        submitLabel="Remove pack"
                        submitVariant="destructive"
                      >
                        <input type="hidden" name="id" value={pack.id} />
                      </FoundationForm>
                    </div>
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

import AbpsOrnament from "@/components/brand/abps-ornament";
import { EmptyState } from "@/components/brand/empty-state";
import { FoundationForm } from "@/components/forms/foundation-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProductImageManager, type ImageSummary } from "@/components/school/product-image-manager";
import {
  createRequirementAction,
  deleteRequirementAction,
  updateRequirementAction,
} from "@/features/school/requirement-actions";
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
  { value: "other", label: "Other Requirements" },
] as const;

type ProductInfo = {
  id: string;
  name: string;
  kind: "book" | "uniform" | "other";
  subject: string | null;
  description: string | null;
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

function categoryLabel(kind: string) {
  return CATEGORIES.find((item) => item.value === kind)?.label ?? kind;
}

function supabaseStorageUrl(storagePath: string): string {
  const base = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  ).replace(/\/+$/, "");
  return `${base}/storage/v1/object/public/product-images/${storagePath}`;
}

export default async function RequirementsPage({
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
      : "";

  let requirementQuery = supabase
    .from("school_requirements")
    .select(
      "id, required_quantity, is_active, academic_year_id, class_id, product_variant_id, product_variants ( id, unit_price_amount, products ( id, name, kind, subject, description ) )",
    )
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });

  if (selectedYearId) {
    requirementQuery = requirementQuery.eq("academic_year_id", selectedYearId);
  }
  if (selectedClassId) {
    requirementQuery = requirementQuery.eq("class_id", selectedClassId);
  }

  const { data: requirementRows, error } = await requirementQuery;

  const loadError =
    yearsResult.error?.message ||
    classesResult.error?.message ||
    error?.message ||
    null;

  const rows = (requirementRows ?? []).map((row) => {
    const variant = asRelated<VariantInfo>(row.product_variants);
    const product = asRelated<ProductInfo>(variant?.products);
    return {
      id: row.id as string,
      quantity: row.required_quantity as number,
      isActive: Boolean(row.is_active),
      academicYearId: row.academic_year_id as string,
      classId: row.class_id as string,
      productId: product?.id ?? "",
      name: product?.name ?? "Untitled item",
      kind: product?.kind ?? "other",
      subject: product?.subject ?? "",
      description: product?.description ?? "",
      unitPrice:
        variant?.unit_price_amount === null || variant?.unit_price_amount === undefined
          ? ""
          : String(variant.unit_price_amount),
    };
  });

  const productIds = Array.from(new Set(rows.map((r) => r.productId).filter(Boolean)));
  const { data: rawImages } =
    productIds.length > 0
      ? await supabase
          .from("product_images")
          .select("id, product_id, storage_path, is_primary, alt_text")
          .eq("school_id", schoolId)
          .in("product_id", productIds)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true })
      : { data: [] };

  const imagesByProduct = new Map<string, ImageSummary[]>();
  for (const img of rawImages ?? []) {
    const list = imagesByProduct.get(img.product_id) ?? [];
    list.push({
      id: img.id,
      productId: img.product_id,
      storagePath: img.storage_path,
      isPrimary: Boolean(img.is_primary),
      altText: img.alt_text,
      url: supabaseStorageUrl(img.storage_path),
    });
    imagesByProduct.set(img.product_id, list);
  }

  const missingStructure = years.length === 0 || classes.length === 0;

  return (
    <div className="acadexa-anim-fade-up mx-auto max-w-6xl space-y-7 sm:space-y-10">
      <div className="border-b border-[#c9a227]/30 pb-5 sm:pb-6">
        <p className="acadexa-kicker text-[#c9a227]">School administration</p>
        <h1 className="acadexa-display mt-2 text-[1.65rem] text-[#6b1d2a] sm:text-3xl">
          Requirements
        </h1>
        <AbpsOrnament className="mt-2.5 h-3.5 w-36" />
        <p className="acadexa-lede mt-2 max-w-2xl text-zinc-600">
          Required items for a school, academic year, and class. Categories are
          books, uniform, and other requirements.
        </p>
      </div>

      {loadError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          Could not load requirements. Try again.
        </p>
      ) : null}

      <Card className="acadexa-anim-fade-up acadexa-card-premium border-[#c9a227]/30">
        <CardHeader className="border-[#c9a227]/20">
          <CardTitle className="text-[#6b1d2a]">Filter</CardTitle>
          <CardDescription>
            Choose a year and class to review that list. Leave class empty to see every class in the year.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="yearId">Academic year</Label>
              <select
                id="yearId"
                name="yearId"
                className={selectClassName}
                defaultValue={selectedYearId}
              >
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
              <select
                id="classId"
                name="classId"
                className={selectClassName}
                defaultValue={selectedClassId}
              >
                <option value="">All classes</option>
                {classes.map((klass) => (
                  <option key={klass.id} value={klass.id}>
                    {classLabel(klass.name, klass.section)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="inline-flex h-10 w-full items-center justify-center rounded-md border border-[#c9a227]/50 bg-white px-3 text-sm font-medium text-[#6b1d2a] hover:bg-[#faf6ef]"
              >
                Show requirements
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="acadexa-anim-fade-up acadexa-card-premium border-[#c9a227]/30">
        <CardHeader className="border-[#c9a227]/20">
          <CardTitle className="text-[#6b1d2a]">Add requirement</CardTitle>
          <CardDescription>
            Item names are school catalog products. The year and class on this row use the existing academic structure.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {missingStructure ? (
            <EmptyState
              kind="requirements"
              title="Add a year and a class first"
              description="Requirements attach to an existing academic year and class for this school."
            />
          ) : (
            <FoundationForm
              action={createRequirementAction}
              submitLabel="Add requirement"
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
                    defaultValue={selectedClassId || classes[0]?.id}
                  >
                    {classes.map((klass) => (
                      <option key={klass.id} value={klass.id}>
                        {classLabel(klass.name, klass.section)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <Label htmlFor="kind">Category</Label>
              <select id="kind" name="kind" required className={selectClassName} defaultValue="book">
                {CATEGORIES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <Label htmlFor="name">Item name</Label>
              <Input id="name" name="name" required className={fieldClass} placeholder="English Reader" />
              <Label htmlFor="subject">Subject (books)</Label>
              <Input id="subject" name="subject" className={fieldClass} placeholder="English" />
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                name="description"
                className={fieldClass}
                placeholder="Prescribed textbook edition, publisher, syllabus notes..."
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity required</Label>
                  <Input
                    id="quantity"
                    name="quantity"
                    type="number"
                    min={1}
                    defaultValue={1}
                    required
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unitPrice">Unit price (INR, optional)</Label>
                  <Input
                    id="unitPrice"
                    name="unitPrice"
                    type="number"
                    min={0}
                    step="0.01"
                    className={fieldClass}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-[#6b1d2a]">
                <input
                  type="checkbox"
                  name="isActive"
                  defaultChecked
                  className="h-4 w-4 accent-[#6b1d2a]"
                />
                Active
              </label>
            </FoundationForm>
          )}
        </CardContent>
      </Card>

      <Card className="acadexa-anim-fade-up acadexa-card-premium acadexa-delay-1 border-[#c9a227]/30">
        <CardHeader className="border-[#c9a227]/20">
          <CardTitle className="text-[#6b1d2a]">Required items</CardTitle>
          <CardDescription>
            Duplicate items for the same year, class, and catalog item are blocked.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 && !loadError ? (
            <EmptyState
              kind="requirements"
              title="No requirements yet"
              description="Add books, uniform items, or other requirements for the selected year and class."
            />
          ) : (
            <ul className="space-y-4">
              {rows.map((row) => {
                const productImages = imagesByProduct.get(row.productId) ?? [];
                return (
                  <li
                    key={row.id}
                    className="rounded-xl border border-[#c9a227]/25 bg-white/80 p-4 shadow-sm"
                  >
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <p className="font-medium text-[#6b1d2a]">{row.name}</p>
                      <span className="rounded-full bg-[#faf6ef] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[#6b1d2a]">
                        {categoryLabel(row.kind)}
                      </span>
                      {row.isActive ? null : (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-zinc-600">
                          Inactive
                        </span>
                      )}
                    </div>
                    <FoundationForm
                      action={updateRequirementAction}
                      submitLabel="Save"
                      submitClassName={schoolSubmitClass}
                    >
                      <input type="hidden" name="id" value={row.id} />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor={`year-${row.id}`}>Academic year</Label>
                          <select
                            id={`year-${row.id}`}
                            name="academicYearId"
                            required
                            className={selectClassName}
                            defaultValue={row.academicYearId}
                          >
                            {years.map((year) => (
                              <option key={year.id} value={year.id}>
                                {year.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`class-${row.id}`}>Class</Label>
                          <select
                            id={`class-${row.id}`}
                            name="classId"
                            required
                            className={selectClassName}
                            defaultValue={row.classId}
                          >
                            {classes.map((klass) => (
                              <option key={klass.id} value={klass.id}>
                                {classLabel(klass.name, klass.section)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <Label htmlFor={`kind-${row.id}`}>Category</Label>
                      <select
                        id={`kind-${row.id}`}
                        name="kind"
                        required
                        className={selectClassName}
                        defaultValue={row.kind}
                      >
                        {CATEGORIES.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                      <Label htmlFor={`name-${row.id}`}>Item name</Label>
                      <Input
                        id={`name-${row.id}`}
                        name="name"
                        required
                        defaultValue={row.name}
                        className={fieldClass}
                      />
                      <Label htmlFor={`subject-${row.id}`}>Subject (books)</Label>
                      <Input
                        id={`subject-${row.id}`}
                        name="subject"
                        defaultValue={row.subject}
                        className={fieldClass}
                      />
                      <Label htmlFor={`desc-${row.id}`}>Description (optional)</Label>
                      <Input
                        id={`desc-${row.id}`}
                        name="description"
                        defaultValue={row.description}
                        placeholder="Textbook edition, notes, specifications..."
                        className={fieldClass}
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor={`qty-${row.id}`}>Quantity required</Label>
                          <Input
                            id={`qty-${row.id}`}
                            name="quantity"
                            type="number"
                            min={1}
                            required
                            defaultValue={row.quantity}
                            className={fieldClass}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`price-${row.id}`}>Unit price (INR)</Label>
                          <Input
                            id={`price-${row.id}`}
                            name="unitPrice"
                            type="number"
                            min={0}
                            step="0.01"
                            defaultValue={row.unitPrice}
                            className={fieldClass}
                          />
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-[#6b1d2a]">
                        <input
                          type="checkbox"
                          name="isActive"
                          defaultChecked={row.isActive}
                          className="h-4 w-4 accent-[#6b1d2a]"
                        />
                        Active
                      </label>
                    </FoundationForm>

                    {/* Product Photos & Cover Images Management */}
                    {row.productId ? (
                      <ProductImageManager
                        productId={row.productId}
                        productName={row.name}
                        images={productImages}
                      />
                    ) : null}

                    <div className="mt-3">
                      <FoundationForm
                        action={deleteRequirementAction}
                        submitLabel="Remove"
                        submitVariant="destructive"
                      >
                        <input type="hidden" name="id" value={row.id} />
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

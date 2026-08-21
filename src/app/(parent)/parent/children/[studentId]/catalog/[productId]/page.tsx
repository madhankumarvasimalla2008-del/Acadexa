import Link from "next/link";
import { z } from "zod";
import { notFound, redirect } from "next/navigation";
import AbpsOrnament from "@/components/brand/abps-ornament";
import { EmptyState } from "@/components/brand/empty-state";
import { ProductGallery } from "@/components/parent/product-gallery";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatInr, packTypeLabel, toAmount } from "@/lib/payments/display";
import { requireParentChild } from "@/lib/auth/workspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getProductDetail,
  availabilityLabel,
  availabilityDot,
} from "@/features/parent/catalog-queries";

type YearInfo = { id: string; name: string; is_current: boolean };
type ClassInfo = { id: string; name: string; section: string | null };

function asRelated<T extends object>(value: unknown): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null;
  return value as T;
}

function classLabel(name: string, section: string | null) {
  return section ? `Class ${name} · ${section}` : `Class ${name}`;
}

export default async function ParentProductDetailPage({
  params,
}: {
  params: Promise<{ studentId: string; productId: string }>;
}) {
  const { studentId: rawStudentId, productId: rawProductId } = await params;

  const parsedStudentId = z.string().uuid().safeParse(rawStudentId);
  const parsedProductId = z.string().uuid().safeParse(rawProductId);

  if (!parsedStudentId.success || !parsedProductId.success) {
    redirect("/unauthorized");
  }

  const studentId = parsedStudentId.data;
  const productId = parsedProductId.data;

  const { schoolId } = await requireParentChild(studentId);
  const supabase = await createServerSupabaseClient();

  const [{ data: student }, { data: enrollments }] = await Promise.all([
    supabase
      .from("students")
      .select("id, full_name")
      .eq("id", studentId)
      .eq("school_id", schoolId)
      .maybeSingle(),
    supabase
      .from("student_enrollments")
      .select(
        "id, academic_year_id, class_id, status, academic_years ( id, name, is_current ), classes ( id, name, section )",
      )
      .eq("student_id", studentId)
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false }),
  ]);

  if (!student) redirect("/unauthorized");

  const currentEnrollment =
    (enrollments ?? []).find((e) => {
      const y = asRelated<YearInfo>(e.academic_years);
      return y?.is_current && e.status === "active";
    }) ??
    (enrollments ?? []).find((e) => e.status === "active") ??
    (enrollments ?? [])[0] ??
    null;

  const year = currentEnrollment ? asRelated<YearInfo>(currentEnrollment.academic_years) : null;
  const klass = currentEnrollment ? asRelated<ClassInfo>(currentEnrollment.classes) : null;

  if (!year || !klass) {
    return (
      <div className="mx-auto max-w-3xl py-8">
        <Card className="acadexa-card-premium border-[#c9a227]/30">
          <CardContent className="py-8">
            <EmptyState
              kind="requirements"
              title="No active enrollment"
              description="This child is not currently enrolled in an active class."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const product = await getProductDetail(schoolId, productId, year.id, klass.id);

  if (!product) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 acadexa-anim-page">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-zinc-500">
        <Link
          href={`/parent/children/${studentId}`}
          className="hover:text-[#6b1d2a] hover:underline"
        >
          {student.full_name}
        </Link>
        <span>/</span>
        <Link
          href={`/parent/children/${studentId}/catalog`}
          className="hover:text-[#6b1d2a] hover:underline"
        >
          Catalog
        </Link>
        <span>/</span>
        <span className="truncate font-medium text-[#6b1d2a]">{product.name}</span>
      </nav>

      {/* Main Product Layout */}
      <div className="grid gap-6 md:grid-cols-12">
        {/* Left Column: Gallery */}
        <div className="md:col-span-5">
          <ProductGallery
            images={product.images}
            kind={product.kind}
            name={product.name}
          />
        </div>

        {/* Right Column: Product Info & Availability */}
        <div className="flex flex-col justify-between space-y-5 md:col-span-7">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#faf6ef] px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-[#6b1d2a] border border-[#c9a227]/30">
                {product.kind === "book" ? "📚 Book" : product.kind === "uniform" ? "👕 Uniform" : "📦 Material"}
              </span>
              {product.subject ? (
                <span className="text-xs font-medium text-zinc-600">
                  {product.subject}
                </span>
              ) : null}
            </div>

            <h1 className="acadexa-display mt-3 text-2xl text-[#6b1d2a] sm:text-3xl">
              {product.name}
            </h1>
            <AbpsOrnament className="mt-2 h-3 w-28" />

            <div className="mt-4 text-xs text-zinc-500">
              Prescribed for <strong className="text-zinc-700">{year.name}</strong> ·{" "}
              <strong className="text-zinc-700">{classLabel(klass.name, klass.section)}</strong>
            </div>

            {product.description ? (
              <div className="mt-4 prose prose-sm text-zinc-600">
                <p className="whitespace-pre-line leading-relaxed">{product.description}</p>
              </div>
            ) : null}
          </div>

          {/* Variants Table / Details */}
          <div className="rounded-xl border border-[#c9a227]/30 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-[#6b1d2a]">
              Available Variants & Pricing
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Prices and stock availability per variant.
            </p>

            {product.variants.length === 0 ? (
              <p className="mt-3 text-xs text-zinc-500">No variant details specified.</p>
            ) : (
              <div className="mt-3 divide-y divide-[#c9a227]/15">
                {product.variants.map((variant) => (
                  <div
                    key={variant.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        {variant.size ? (
                          <span className="font-medium text-xs text-[#6b1d2a]">
                            Size: {variant.size}
                          </span>
                        ) : null}
                        {variant.edition ? (
                          <span className="text-xs text-zinc-600">
                            Edition: {variant.edition}
                          </span>
                        ) : null}
                        {!variant.size && !variant.edition ? (
                          <span className="text-xs text-zinc-600">Standard item</span>
                        ) : null}
                        {variant.sku ? (
                          <span className="text-[11px] text-zinc-400">({variant.sku})</span>
                        ) : null}
                      </div>
                      {variant.unit_price_amount !== null ? (
                        <p className="mt-0.5 text-xs font-semibold text-[#6b1d2a]">
                          {formatInr(toAmount(variant.unit_price_amount))}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-xs text-zinc-400">Included in pack</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap">
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${availabilityDot(variant.availability)}`}
                      />
                      <span className="text-zinc-700">{availabilityLabel(variant.availability)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Matching Packs Section */}
      <Card className="acadexa-card-premium border-[#c9a227]/30">
        <CardHeader className="border-[#c9a227]/20">
          <CardTitle className="text-[#6b1d2a]">
            Included in Requirement Packs
          </CardTitle>
          <CardDescription>
            This item is included in the following curated packs for {student.full_name}’s class.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {product.packs.length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-xs text-zinc-500">
                This item is listed in the general curriculum and can be acquired as part of standard requirements.
              </p>
              <div className="mt-3 flex justify-center gap-3">
                <Link
                  href={`/parent/children/${studentId}/requirements`}
                  className="inline-flex h-8 items-center justify-center rounded-md border border-[#c9a227]/30 bg-white px-3 text-xs font-medium text-[#6b1d2a] hover:bg-[#faf6ef]"
                >
                  View requirement list
                </Link>
                <Link
                  href={`/parent/children/${studentId}/packs`}
                  className="inline-flex h-8 items-center justify-center rounded-md bg-[#6b1d2a] px-3 text-xs font-medium text-[#f7e0a3]"
                >
                  Browse all packs
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {product.packs.map((pack) => (
                <div
                  key={pack.id}
                  className="flex flex-col justify-between rounded-xl border border-[#c9a227]/25 bg-[#faf6ef]/40 p-4 transition-[transform,box-shadow] hover:shadow-xs"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-sm text-[#6b1d2a]">{pack.name}</h3>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-600 border border-[#c9a227]/20">
                        {packTypeLabel(pack.pack_type)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-bold text-[#6b1d2a]">
                      {formatInr(toAmount(pack.price_amount))}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#c9a227]/15 flex items-center justify-between">
                    <span className="text-xs text-zinc-500">All bundled items included</span>
                    <Link
                      href={`/parent/children/${studentId}/packs/${pack.id}`}
                      className="inline-flex h-8 items-center justify-center rounded-md bg-[#6b1d2a] px-3 text-xs font-medium text-[#f7e0a3] hover:bg-[#4a121c]"
                    >
                      View & checkout →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

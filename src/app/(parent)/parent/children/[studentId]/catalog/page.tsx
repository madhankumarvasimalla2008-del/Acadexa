import Link from "next/link";
import { z } from "zod";
import { redirect } from "next/navigation";
import AbpsOrnament from "@/components/brand/abps-ornament";
import { EmptyState } from "@/components/brand/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { requireParentChild } from "@/lib/auth/workspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getCatalogProducts,
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

const CATEGORIES = [
  { value: "all", label: "All Items", icon: "✨" },
  { value: "book", label: "Books", icon: "📚" },
  { value: "uniform", label: "Uniforms", icon: "👕" },
  { value: "other", label: "Other Items", icon: "📦" },
] as const;

export default async function ParentCatalogPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ kind?: string; q?: string }>;
}) {
  const { studentId: rawId } = await params;
  const { kind, q } = await searchParams;
  const parsedId = z.string().uuid().safeParse(rawId);
  if (!parsedId.success) redirect("/unauthorized");

  const { studentId, schoolId } = await requireParentChild(parsedId.data);
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

  const rawProducts =
    year && klass
      ? await getCatalogProducts(schoolId, year.id, klass.id)
      : [];

  const selectedKind = kind && ["book", "uniform", "other"].includes(kind) ? kind : "all";
  const searchQuery = (q ?? "").trim().toLowerCase();

  const products = rawProducts.filter((product) => {
    if (selectedKind !== "all" && product.kind !== selectedKind) {
      return false;
    }
    if (searchQuery) {
      const nameMatch = product.name.toLowerCase().includes(searchQuery);
      const subjectMatch = product.subject?.toLowerCase().includes(searchQuery);
      const descMatch = product.description?.toLowerCase().includes(searchQuery);
      return nameMatch || subjectMatch || descMatch;
    }
    return true;
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 acadexa-anim-page">
      <div className="border-b border-[#c9a227]/30 pb-5">
        <p className="acadexa-kicker text-[#6b1d2a]">School Catalog</p>
        <h1 className="acadexa-display mt-2 text-2xl text-[#6b1d2a] sm:text-3xl">
          Catalog & Materials
        </h1>
        <AbpsOrnament className="mt-2 h-3 w-32" />
        <p className="acadexa-lede mt-3 text-zinc-600">
          Browse textbooks, uniforms, and essential school items for {student.full_name}
          {year && klass ? ` — ${year.name}, ${classLabel(klass.name, klass.section)}` : ""}.
        </p>
      </div>

      {!currentEnrollment ? (
        <Card className="acadexa-card-premium border-[#c9a227]/30">
          <CardContent className="py-8">
            <EmptyState
              kind="requirements"
              title="No enrollment found"
              description="This child does not have an active enrollment. The catalog is customized for each student's class and year."
            />
          </CardContent>
        </Card>
      ) : rawProducts.length === 0 ? (
        <Card className="acadexa-card-premium border-[#c9a227]/30">
          <CardContent className="py-8">
            <EmptyState
              kind="requirements"
              title="Catalog not yet configured"
              description="The school has not published items for this class and year yet."
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Filters & Search */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              {CATEGORIES.map((cat) => {
                const isActive = selectedKind === cat.value;
                const href =
                  cat.value === "all"
                    ? `/parent/children/${studentId}/catalog${searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ""}`
                    : `/parent/children/${studentId}/catalog?kind=${cat.value}${searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : ""}`;
                return (
                  <Link
                    key={cat.value}
                    href={href}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-[#6b1d2a] text-[#f7e0a3] shadow-sm"
                        : "border border-[#c9a227]/30 bg-white text-[#6b1d2a] hover:bg-[#faf6ef]"
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </Link>
                );
              })}
            </div>

            <form method="get" className="relative">
              {selectedKind !== "all" ? (
                <input type="hidden" name="kind" value={selectedKind} />
              ) : null}
              <input
                name="q"
                defaultValue={searchQuery}
                placeholder="Search items or subjects..."
                className="h-9 w-full rounded-md border border-[#c9a227]/30 bg-white px-3 text-xs text-[#6b1d2a] placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-[#6b1d2a] sm:w-56"
              />
            </form>
          </div>

          {/* Product Grid */}
          {products.length === 0 ? (
            <Card className="acadexa-card-premium border-[#c9a227]/30">
              <CardContent className="py-8 text-center">
                <p className="text-sm text-zinc-600">No items match your filter criteria.</p>
                <Link
                  href={`/parent/children/${studentId}/catalog`}
                  className="mt-3 inline-block text-xs font-medium text-[#6b1d2a] underline"
                >
                  Clear filters
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <Link
                  key={product.id}
                  href={`/parent/children/${studentId}/catalog/${product.id}`}
                  className="group flex flex-col overflow-hidden rounded-xl border border-[#c9a227]/25 bg-white shadow-sm transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:border-[#c9a227]/60 hover:shadow-md"
                >
                  {/* Image container */}
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#faf6ef]">
                    {product.primaryImageUrl ? (
                      <img
                        src={product.primaryImageUrl}
                        alt={product.name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-4xl text-[#c9a227]/40">
                        {product.kind === "book" ? "📖" : product.kind === "uniform" ? "👕" : "📦"}
                      </div>
                    )}
                    <span className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-full border bg-white/95 px-2 py-0.5 text-[11px] font-medium shadow-xs backdrop-blur-xs">
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${availabilityDot(product.availability)}`}
                      />
                      <span className="text-zinc-700">{availabilityLabel(product.availability)}</span>
                    </span>
                  </div>

                  {/* Body container */}
                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                      <span>{product.kind === "book" ? "Book" : product.kind === "uniform" ? "Uniform" : "Material"}</span>
                      {product.subject ? (
                        <>
                          <span>·</span>
                          <span className="truncate">{product.subject}</span>
                        </>
                      ) : null}
                    </div>

                    <h2 className="mt-1 text-sm font-semibold text-[#6b1d2a] transition-colors group-hover:text-[#4a121c]">
                      {product.name}
                    </h2>

                    {product.description ? (
                      <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
                        {product.description}
                      </p>
                    ) : null}

                    <div className="mt-auto pt-3 flex items-center justify-between text-xs">
                      <span className="font-medium text-[#6b1d2a] group-hover:underline">
                        View details →
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Quick links to Requirements & Packs */}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#c9a227]/25 bg-[#faf6ef]/70 p-4">
            <div>
              <p className="font-semibold text-sm text-[#6b1d2a]">Ready to acquire materials?</p>
              <p className="text-xs text-zinc-600">
                Packs bundle all required textbooks and uniforms with a single click.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/parent/children/${studentId}/requirements`}
                className="inline-flex h-9 items-center justify-center rounded-md border border-[#c9a227]/40 bg-white px-4 text-xs font-medium text-[#6b1d2a] hover:bg-[#faf6ef]"
              >
                Required list
              </Link>
              <Link
                href={`/parent/children/${studentId}/packs`}
                className="inline-flex h-9 items-center justify-center rounded-md bg-[#6b1d2a] px-4 text-xs font-medium text-[#f7e0a3] hover:bg-[#4a121c]"
              >
                View packs & checkout
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

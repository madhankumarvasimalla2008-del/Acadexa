import Link from "next/link";
import { z } from "zod";
import { redirect } from "next/navigation";
import AbpsOrnament from "@/components/brand/abps-ornament";
import { EmptyState } from "@/components/brand/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatInr, toAmount } from "@/lib/payments/display";
import { requireParentChild } from "@/lib/auth/workspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getChildRequirements,
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


export default async function ParentRequirementsPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId: rawId } = await params;
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

  const requirements =
    year && klass
      ? await getChildRequirements(schoolId, year.id, klass.id)
      : [];

  const books = requirements.filter((r) => r.productKind === "book");
  const uniforms = requirements.filter((r) => r.productKind === "uniform");
  const other = requirements.filter((r) => r.productKind === "other");

  return (
    <div className="mx-auto max-w-3xl space-y-6 acadexa-anim-page">
      <div className="border-b border-[#c9a227]/30 pb-5">
        <p className="acadexa-kicker text-[#6b1d2a]">Requirements</p>
        <h1 className="acadexa-display mt-2 text-2xl text-[#6b1d2a] sm:text-3xl">
          Required Items
        </h1>
        <AbpsOrnament className="mt-2 h-3 w-32" />
        <p className="acadexa-lede mt-3 text-zinc-600">
          Items required for {student.full_name}
          {year && klass ? ` — ${year.name}, ${classLabel(klass.name, klass.section)}` : ""}.
        </p>
      </div>

      {!currentEnrollment ? (
        <Card className="acadexa-card-premium border-[#c9a227]/30">
          <CardContent className="py-8">
            <EmptyState
              kind="requirements"
              title="No enrollment found"
              description="This child does not have an active enrollment. Requirements appear based on the enrolled class and year."
            />
          </CardContent>
        </Card>
      ) : requirements.length === 0 ? (
        <Card className="acadexa-card-premium border-[#c9a227]/30">
          <CardContent className="py-8">
            <EmptyState
              kind="requirements"
              title="No requirements yet"
              description="The school has not published requirements for this class and year."
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {[
            { label: "Books", items: books, icon: "📚" },
            { label: "Uniforms", items: uniforms, icon: "👕" },
            { label: "Other Items", items: other, icon: "📦" },
          ]
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <Card key={group.label} className="acadexa-card-premium border-[#c9a227]/30">
                <CardHeader className="border-[#c9a227]/20">
                  <CardTitle className="flex items-center gap-2">
                    <span>{group.icon}</span> {group.label}
                  </CardTitle>
                  <CardDescription>
                    {group.items.length} {group.items.length === 1 ? "item" : "items"} required
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y divide-[#c9a227]/15">
                    {group.items.map((item) => (
                      <li key={item.id} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
                        <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-[#c9a227]/20 bg-[#faf6ef]">
                          {item.primaryImageUrl ? (
                            <img
                              src={item.primaryImageUrl}
                              alt={item.productName}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-2xl text-[#c9a227]/40">
                              {item.productKind === "book" ? "📖" : item.productKind === "uniform" ? "👕" : "📦"}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <Link
                                href={`/parent/children/${studentId}/catalog/${item.productId}`}
                                className="font-semibold text-[#6b1d2a] hover:underline"
                              >
                                {item.productName}
                              </Link>
                              {item.subject ? (
                                <p className="mt-0.5 text-sm text-zinc-500">{item.subject}</p>
                              ) : null}
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                                <span className="text-zinc-500">
                                  Qty: {item.required_quantity}
                                </span>
                                {item.unitPrice !== null ? (
                                  <span className="font-medium text-[#6b1d2a]">
                                    {formatInr(toAmount(item.unitPrice))} each
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap">
                              <span
                                className={`inline-block h-1.5 w-1.5 rounded-full ${availabilityDot(item.availability)}`}
                              />
                              {availabilityLabel(item.availability)}
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/parent/children/${studentId}/catalog`}
              className="inline-flex h-10 items-center justify-center rounded-md border border-[#c9a227]/30 bg-white px-5 text-sm font-medium text-[#6b1d2a] hover:bg-[#faf6ef]"
            >
              Browse catalog
            </Link>
            <Link
              href={`/parent/children/${studentId}/packs`}
              className="inline-flex h-10 items-center justify-center rounded-md bg-[#6b1d2a] px-5 text-sm font-medium text-[#f7e0a3]"
            >
              View packs & checkout
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

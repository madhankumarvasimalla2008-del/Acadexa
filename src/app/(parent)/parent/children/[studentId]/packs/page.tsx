import Link from "next/link";
import { z } from "zod";
import { redirect } from "next/navigation";
import AbpsOrnament from "@/components/brand/abps-ornament";
import { EmptyState } from "@/components/brand/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatInr, packTypeLabel, paymentStatusLabel, toAmount } from "@/lib/payments/display";
import { requireParentChild } from "@/lib/auth/workspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function classLabel(name: string, section: string | null) {
  return section ? `Class ${name} · ${section}` : `Class ${name}`;
}

export default async function ParentPacksPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId: rawId } = await params;
  const parsedId = z.string().uuid().safeParse(rawId);
  if (!parsedId.success) {
    redirect("/unauthorized");
  }

  const { studentId, schoolId } = await requireParentChild(parsedId.data);
  const supabase = await createServerSupabaseClient();

  const [{ data: student }, { data: enrollments, error: enrollmentError }] = await Promise.all([
    supabase
      .from("students")
      .select("id, full_name")
      .eq("id", studentId)
      .eq("school_id", schoolId)
      .maybeSingle(),
    supabase
      .from("student_enrollments")
      .select("academic_year_id, class_id")
      .eq("student_id", studentId)
      .eq("school_id", schoolId),
  ]);

  if (!student) {
    redirect("/unauthorized");
  }

  const yearIds = [...new Set((enrollments ?? []).map((row) => row.academic_year_id))];
  const classIds = [...new Set((enrollments ?? []).map((row) => row.class_id))];

  const [{ data: years }, { data: classes }, { data: packs, error: packsError }, { data: orders }] =
    await Promise.all([
      yearIds.length
        ? supabase.from("academic_years").select("id, name").eq("school_id", schoolId).in("id", yearIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      classIds.length
        ? supabase.from("classes").select("id, name, section").eq("school_id", schoolId).in("id", classIds)
        : Promise.resolve({ data: [] as { id: string; name: string; section: string | null }[] }),
      yearIds.length && classIds.length
        ? supabase
            .from("packs")
            .select("id, name, pack_type, price_amount, is_active, academic_year_id, class_id")
            .eq("school_id", schoolId)
            .eq("is_active", true)
            .in("academic_year_id", yearIds)
            .in("class_id", classIds)
            .order("name")
        : Promise.resolve({ data: [] as never[], error: null }),
      supabase
        .from("orders")
        .select("id, pack_id, payment_status, amount_snapshot")
        .eq("student_id", studentId)
        .eq("school_id", schoolId),
    ]);

  const error = enrollmentError?.message || packsError?.message;
  const yearName = new Map((years ?? []).map((row) => [row.id, row.name]));
  const className = new Map(
    (classes ?? []).map((row) => [row.id, classLabel(row.name, row.section)]),
  );
  const enrollmentKeys = new Set(
    (enrollments ?? []).map((row) => `${row.academic_year_id}:${row.class_id}`),
  );
  const visiblePacks = (packs ?? []).filter((pack) =>
    enrollmentKeys.has(`${pack.academic_year_id}:${pack.class_id}`),
  );
  const latestByPack = new Map<string, string>();
  for (const order of orders ?? []) {
    latestByPack.set(order.pack_id, order.payment_status);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="border-b border-[#c9a227]/30 pb-5">
        <p className="acadexa-kicker text-[#6b1d2a]">Parent</p>
        <h1 className="acadexa-display mt-2 text-2xl text-[#6b1d2a] sm:text-3xl">Packs</h1>
        <AbpsOrnament className="mt-2 h-3 w-32" />
        <p className="acadexa-lede mt-3 text-zinc-600">
          Packs for {student.full_name} only, limited to this child’s school, year, and class.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      <Card className="acadexa-card-premium border-[#c9a227]/30">
        <CardHeader className="border-[#c9a227]/20">
          <CardTitle>Available packs</CardTitle>
          <CardDescription>Open a pack to review items and pay.</CardDescription>
        </CardHeader>
        <CardContent>
          {visiblePacks.length === 0 ? (
            <EmptyState
              kind="packs"
              title="No packs yet"
              description="When the school publishes a pack for this child’s class, it will appear here."
            />
          ) : (
            <ul className="space-y-3">
              {visiblePacks.map((pack) => {
                const status = latestByPack.get(pack.id);
                return (
                  <li
                    key={pack.id}
                    className="rounded-xl border border-[#c9a227]/25 bg-white/80 p-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold text-[#6b1d2a]">{pack.name}</p>
                        <p className="text-sm text-zinc-600">
                          {packTypeLabel(pack.pack_type)} ·{" "}
                          {yearName.get(pack.academic_year_id) ?? "Year"} ·{" "}
                          {className.get(pack.class_id) ?? "Class"}
                        </p>
                        <p className="mt-1 text-sm font-medium text-[#6b1d2a]">
                          {formatInr(toAmount(pack.price_amount))}
                          {status ? ` · ${paymentStatusLabel(status)}` : ""}
                        </p>
                      </div>
                      <Link
                        href={`/parent/children/${studentId}/packs/${pack.id}`}
                        className="inline-flex h-10 items-center justify-center rounded-md bg-[#6b1d2a] px-4 text-sm font-medium text-[#f7e0a3]"
                      >
                        View and pay
                      </Link>
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

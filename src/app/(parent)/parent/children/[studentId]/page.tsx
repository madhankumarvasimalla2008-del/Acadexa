import { z } from "zod";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireParentChild } from "@/lib/auth/workspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type YearInfo = {
  name: string;
  starts_on: string;
  ends_on: string;
  is_current: boolean;
};

type ClassInfo = {
  name: string;
  section: string | null;
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

export default async function ParentChildHomePage({
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

  const [{ data: student }, { data: school }, { data: enrollments }] = await Promise.all([
    supabase
      .from("students")
      .select("id, full_name, student_code, status, school_id")
      .eq("id", studentId)
      .eq("school_id", schoolId)
      .maybeSingle(),
    supabase.from("schools").select("id, name, code, status").eq("id", schoolId).maybeSingle(),
    supabase
      .from("student_enrollments")
      .select(
        "id, status, academic_year_id, class_id, academic_years ( name, starts_on, ends_on, is_current ), classes ( name, section )",
      )
      .eq("student_id", studentId)
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false }),
  ]);

  if (!student) {
    redirect("/unauthorized");
  }

  const rows = (enrollments ?? []).map((row) => {
    const year = asRelated<YearInfo>(row.academic_years);
    const klass = asRelated<ClassInfo>(row.classes);
    return {
      id: row.id as string,
      status: row.status as string,
      year,
      klass,
    };
  });

  const currentEnrollment =
    rows.find((row) => row.year?.is_current && row.status === "active") ??
    rows.find((row) => row.status === "active") ??
    rows[0] ??
    null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{student.full_name}</h1>
        <p className="mt-1 text-sm text-zinc-600">
          School and class context for this child only. Other children are not mixed
          into this view.
        </p>
      </div>

      <section aria-label="Child context">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="border-0 p-4 pb-0">
              <CardDescription>School</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <p className="text-lg font-semibold text-zinc-900">
                {school?.name ?? "School"}
              </p>
              {school?.code ? (
                <p className="text-sm text-zinc-500">{school.code}</p>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="border-0 p-4 pb-0">
              <CardDescription>Student code</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <p className="text-lg font-semibold text-zinc-900">{student.student_code}</p>
              <p className="text-sm capitalize text-zinc-500">{student.status}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="border-0 p-4 pb-0">
              <CardDescription>Academic year</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <p className="text-lg font-semibold text-zinc-900">
                {currentEnrollment?.year?.name ?? "Not enrolled"}
              </p>
              {currentEnrollment?.year?.is_current ? (
                <p className="text-sm text-zinc-500">Current year</p>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="border-0 p-4 pb-0">
              <CardDescription>Class</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <p className="text-lg font-semibold text-zinc-900">
                {currentEnrollment?.klass
                  ? `${currentEnrollment.klass.name}${
                      currentEnrollment.klass.section
                        ? ` ${currentEnrollment.klass.section}`
                        : ""
                    }`
                  : "Not enrolled"}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Enrollment history</CardTitle>
          <CardDescription>
            Year and class stay on enrollment rows. Nothing is invented when there
            is no record.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-zinc-500">No enrollment on record yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 text-sm">
              {rows.map((row) => (
                <li key={row.id} className="py-2 text-zinc-700">
                  {row.year?.name ?? "Year"}
                  {row.klass
                    ? ` · ${row.klass.name}${
                        row.klass.section ? ` ${row.klass.section}` : ""
                      }`
                    : ""}
                  {row.year?.is_current ? " · current year" : ""}
                  {` · ${row.status}`}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Requirements and packs</CardTitle>
          <CardDescription>
            Catalog, packs, and payments are not in this phase. This screen only
            shows this child’s school and enrollment context.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

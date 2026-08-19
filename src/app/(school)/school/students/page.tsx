import Link from "next/link";
import AbpsOrnament from "@/components/brand/abps-ornament";
import { EmptyState } from "@/components/brand/empty-state";
import { FoundationForm } from "@/components/forms/foundation-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireSchoolAdmin } from "@/lib/auth/workspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createEnrollmentAction, createStudentAction } from "@/features/school/actions";

const selectClassName =
  "h-10 w-full rounded-md border border-[#6b1d2a]/20 bg-white px-3 text-base text-[#6b1d2a] sm:text-sm";

export default async function StudentsPage() {
  const { schoolId } = await requireSchoolAdmin();
  const supabase = await createServerSupabaseClient();
  const [{ data: years }, { data: classes }, { data: students }, { data: enrollments }] =
    await Promise.all([
      supabase
        .from("academic_years")
        .select("id, name, starts_on, ends_on, is_current")
        .eq("school_id", schoolId)
        .order("starts_on", { ascending: false }),
      supabase
        .from("classes")
        .select("id, name, section")
        .eq("school_id", schoolId)
        .order("name"),
      supabase
        .from("students")
        .select("id, student_code, full_name, status")
        .eq("school_id", schoolId)
        .order("full_name"),
      supabase
        .from("student_enrollments")
        .select("id, student_id, academic_year_id, class_id, status")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  const studentById = new Map((students ?? []).map((row) => [row.id, row]));
  const yearById = new Map((years ?? []).map((row) => [row.id, row]));
  const classById = new Map((classes ?? []).map((row) => [row.id, row]));

  return (
    <div className="acadexa-anim-fade-up mx-auto max-w-6xl space-y-7 sm:space-y-10">
      <div className="flex flex-col gap-4 border-b border-[#c9a227]/30 pb-5 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:pb-6">
        <div className="max-w-2xl">
          <p className="acadexa-kicker text-[#c9a227]">School records</p>
          <h1 className="acadexa-display mt-2 text-[1.65rem] text-[#6b1d2a] sm:text-3xl">
            Students
          </h1>
          <AbpsOrnament className="mt-2.5 h-3.5 w-36" />
          <p className="acadexa-lede mt-2 text-zinc-600">
            Identity only. Class history lives on enrollments, not a single overwritten
            class field.
          </p>
        </div>
        <Link
          href="/school/students/import"
          className="inline-flex w-full items-center justify-center rounded-md border border-[#c9a227]/50 bg-white px-3 py-2.5 text-sm font-medium tracking-tight text-[#6b1d2a] shadow-sm transition-[transform,background-color,box-shadow] duration-200 hover:-translate-y-px hover:bg-[#faf6ef] hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b1d2a] focus-visible:ring-offset-2 motion-reduce:transform-none sm:w-auto"
        >
          Import CSV
        </Link>
      </div>
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <Card className="acadexa-anim-fade-up acadexa-card-premium border-[#c9a227]/30">
          <CardHeader className="border-[#c9a227]/20">
            <CardTitle className="text-[#6b1d2a]">Students</CardTitle>
            <CardDescription>Names and school student codes for this school.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {(students ?? []).length === 0 ? (
              <EmptyState
                kind="students"
                title="No students yet"
                description="Add a student below or import a CSV of student_code and full_name."
              />
            ) : (
              <ul className="max-h-72 divide-y divide-[#c9a227]/20 overflow-auto rounded-lg border border-[#c9a227]/20">
                {(students ?? []).map((student) => (
                  <li
                    key={student.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-[#faf6ef]"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[#6b1d2a]">{student.full_name}</p>
                      <p className="truncate text-xs text-zinc-500">{student.student_code}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-[#faf6ef] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[#6b1d2a]">
                      {student.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="rounded-lg border border-[#6b1d2a]/10 bg-[#faf6ef]/60 p-4">
              <p className="mb-3 text-sm font-medium text-[#6b1d2a]">Add student</p>
              <FoundationForm action={createStudentAction} submitLabel="Add student">
                <Label htmlFor="studentCode">Student code</Label>
                <Input id="studentCode" name="studentCode" required />
                <Label htmlFor="fullName">Full name</Label>
                <Input id="fullName" name="fullName" required />
              </FoundationForm>
            </div>
          </CardContent>
        </Card>
        <Card className="acadexa-anim-fade-up acadexa-card-premium acadexa-delay-1 border-[#c9a227]/30">
          <CardHeader className="border-[#c9a227]/20">
            <CardTitle className="text-[#6b1d2a]">Enrollments</CardTitle>
            <CardDescription>
              Example: Rahul 2025–26 Class 5, then a new row for 2026–27 Class 6.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {(enrollments ?? []).length === 0 ? (
              <EmptyState
                kind="enrollments"
                title="No enrollments yet"
                description="Enroll a student in a year and class to start their history."
              />
            ) : (
              <ul className="max-h-72 divide-y divide-[#c9a227]/20 overflow-auto rounded-lg border border-[#c9a227]/20">
                {(enrollments ?? []).map((row) => {
                  const student = studentById.get(row.student_id);
                  const year = yearById.get(row.academic_year_id);
                  const klass = classById.get(row.class_id);
                  return (
                    <li key={row.id} className="px-4 py-3 text-sm">
                      <p className="font-medium text-[#6b1d2a]">
                        {student?.full_name ?? `Student ${row.student_id.slice(0, 8)}…`}
                      </p>
                      <p className="mt-0.5 text-zinc-600">
                        {year?.name ?? `Year ${row.academic_year_id.slice(0, 8)}…`}
                        {" · "}
                        {klass
                          ? `${klass.name}${klass.section ? ` ${klass.section}` : ""}`
                          : `Class ${row.class_id.slice(0, 8)}…`}
                      </p>
                      <span className="mt-2 inline-block rounded-full bg-[#faf6ef] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[#6b1d2a]">
                        {row.status}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="rounded-lg border border-[#6b1d2a]/10 bg-[#faf6ef]/60 p-4">
              <p className="mb-3 text-sm font-medium text-[#6b1d2a]">Enroll</p>
              <FoundationForm action={createEnrollmentAction} submitLabel="Enroll">
                <Label htmlFor="studentId">Student</Label>
                <select id="studentId" name="studentId" required className={selectClassName}>
                  {(students ?? []).map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.full_name}
                    </option>
                  ))}
                </select>
                <Label htmlFor="academicYearId">Year</Label>
                <select
                  id="academicYearId"
                  name="academicYearId"
                  required
                  className={selectClassName}
                >
                  {(years ?? []).map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.name}
                    </option>
                  ))}
                </select>
                <Label htmlFor="classId">Class</Label>
                <select id="classId" name="classId" required className={selectClassName}>
                  {(classes ?? []).map((klass) => (
                    <option key={klass.id} value={klass.id}>
                      {klass.name}
                      {klass.section ? ` ${klass.section}` : ""}
                    </option>
                  ))}
                </select>
              </FoundationForm>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

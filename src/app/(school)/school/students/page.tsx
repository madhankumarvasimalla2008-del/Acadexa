import { FoundationForm } from "@/components/forms/foundation-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireSchoolAdmin } from "@/lib/auth/workspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createEnrollmentAction, createStudentAction } from "@/features/school/actions";

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

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Students</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Students</CardTitle>
            <CardDescription>
              Identity only. Class history lives on enrollments, not a single
              overwritten class field.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="max-h-64 overflow-auto text-sm">
              {(students ?? []).length === 0 ? (
                <li className="text-zinc-500">No students yet.</li>
              ) : (
                (students ?? []).map((student) => (
                  <li key={student.id} className="border-b border-zinc-100 py-2 last:border-0">
                    {student.full_name} · {student.student_code}
                  </li>
                ))
              )}
            </ul>
            <FoundationForm action={createStudentAction} submitLabel="Add student">
              <Label htmlFor="studentCode">Student code</Label>
              <Input id="studentCode" name="studentCode" required />
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" name="fullName" required />
            </FoundationForm>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Enrollments</CardTitle>
            <CardDescription>
              Example: Rahul 2025–26 Class 5, then a new row for 2026–27 Class 6.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="max-h-64 overflow-auto text-sm">
              {(enrollments ?? []).length === 0 ? (
                <li className="text-zinc-500">No enrollments yet.</li>
              ) : (
                (enrollments ?? []).map((row) => (
                  <li key={row.id} className="truncate border-b border-zinc-100 py-2 last:border-0">
                    student {row.student_id.slice(0, 8)}… · year{" "}
                    {row.academic_year_id.slice(0, 8)}… · class{" "}
                    {row.class_id.slice(0, 8)}… · {row.status}
                  </li>
                ))
              )}
            </ul>
            <FoundationForm action={createEnrollmentAction} submitLabel="Enroll">
              <Label htmlFor="studentId">Student</Label>
              <select
                id="studentId"
                name="studentId"
                required
                className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
              >
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
                className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
              >
                {(years ?? []).map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.name}
                  </option>
                ))}
              </select>
              <Label htmlFor="classId">Class</Label>
              <select
                id="classId"
                name="classId"
                required
                className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
              >
                {(classes ?? []).map((klass) => (
                  <option key={klass.id} value={klass.id}>
                    {klass.name}
                    {klass.section ? ` ${klass.section}` : ""}
                  </option>
                ))}
              </select>
            </FoundationForm>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

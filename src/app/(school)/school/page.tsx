import { AppHeader } from "@/components/layout/app-header";
import { FoundationForm } from "@/components/forms/foundation-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getActiveSchoolId, requireSchoolAdmin } from "@/lib/auth/workspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  createAcademicYearAction,
  createClassAction,
  createEnrollmentAction,
  createStudentAction,
  inviteParentAction,
} from "@/features/school/actions";

export default async function SchoolFoundationPage() {
  const { context, schoolId } = await requireSchoolAdmin();
  const activeSchoolId = await getActiveSchoolId(context);
  const schoolName =
    context.memberships.find((m) => m.school_id === schoolId)?.schools?.name ??
    "School";

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
  const { data: invitations } = await supabase
    .from("parent_students")
    .select("id, student_id, parent_id, status, created_at")
    .eq("school_id", schoolId)
    .in("status", ["invited", "accepted"])
    .order("created_at", { ascending: false });

  return (
    <>
      <AppHeader context={context} activeSchoolId={activeSchoolId} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold">{schoolName}</h1>
          <p className="text-sm text-zinc-600">
            School Admin foundation. Full catalogs, packs, payments, and
            inventory are not in Phase 0. Tenant id is taken from your
            membership, not from a hidden form field.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Academic years</CardTitle>
              <CardDescription>Historical years stay as rows. Do not overwrite a year in place.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="text-sm">
                {(years ?? []).map((year) => (
                  <li key={year.id}>
                    {year.name} ({year.starts_on} → {year.ends_on})
                    {year.is_current ? " · current" : ""}
                  </li>
                ))}
              </ul>
              <FoundationForm action={createAcademicYearAction} submitLabel="Add year">
                <Label htmlFor="name">Label</Label>
                <Input id="name" name="name" placeholder="2026-27" required />
                <Label htmlFor="startsOn">Starts</Label>
                <Input id="startsOn" name="startsOn" type="date" required />
                <Label htmlFor="endsOn">Ends</Label>
                <Input id="endsOn" name="endsOn" type="date" required />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="isCurrent" /> Current year
                </label>
              </FoundationForm>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Classes</CardTitle>
              <CardDescription>Reusable across years via enrollments.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="text-sm">
                {(classes ?? []).map((klass) => (
                  <li key={klass.id}>
                    {klass.name}
                    {klass.section ? ` · ${klass.section}` : ""}
                  </li>
                ))}
              </ul>
              <FoundationForm action={createClassAction} submitLabel="Add class">
                <Label htmlFor="className">Name</Label>
                <Input id="className" name="name" required />
                <Label htmlFor="section">Section</Label>
                <Input id="section" name="section" />
              </FoundationForm>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Students</CardTitle>
              <CardDescription>
                Identity only. Class history lives on enrollments, not a single
                overwritten class field.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="max-h-40 overflow-auto text-sm">
                {(students ?? []).map((student) => (
                  <li key={student.id}>
                    {student.full_name} · {student.student_code}
                  </li>
                ))}
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
              <ul className="max-h-40 overflow-auto text-sm">
                {(enrollments ?? []).map((row) => (
                  <li key={row.id} className="truncate">
                    student {row.student_id.slice(0, 8)}… · year{" "}
                    {row.academic_year_id.slice(0, 8)}… · class{" "}
                    {row.class_id.slice(0, 8)}… · {row.status}
                  </li>
                ))}
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
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Invite a parent</CardTitle>
              <CardDescription>
                Search/link by email or mobile. Parents do not gain access from a
                Student ID. They must accept the invitation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="mb-4 space-y-2 text-sm">
                {(invitations ?? []).length === 0 ? (
                  <li className="text-zinc-500">No invitations yet.</li>
                ) : (
                  (invitations ?? []).map((invite) => {
                    const student = (students ?? []).find((s) => s.id === invite.student_id);
                    const parentAcceptUrl = `${(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/parent`;
                    return (
                      <li key={invite.id} className="rounded-md border border-zinc-200 p-3">
                        <div>
                          {(student?.full_name ?? "Student") +
                            (student?.student_code ? ` · ${student.student_code}` : "")}
                          {" · "}
                          {invite.status}
                        </div>
                        {invite.status === "invited" && invite.parent_id ? (
                          <p className="mt-1">
                            Ask the parent to sign in and accept here:{" "}
                            <a
                              href={parentAcceptUrl}
                              className="break-all underline"
                              target="_blank"
                              rel="noreferrer"
                            >
                              {parentAcceptUrl}
                            </a>
                          </p>
                        ) : null}
                        {invite.status === "invited" && !invite.parent_id ? (
                          <p className="mt-1 text-zinc-600">
                            This invite is not tied to an existing account. The original token
                            link cannot be shown again.
                          </p>
                        ) : null}
                      </li>
                    );
                  })
                )}
              </ul>
              <FoundationForm action={inviteParentAction} submitLabel="Create invitation">
                <Label htmlFor="inviteStudentId">Student</Label>
                <select
                  id="inviteStudentId"
                  name="studentId"
                  required
                  className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
                >
                  {(students ?? []).map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.full_name} ({student.student_code})
                    </option>
                  ))}
                </select>
                <Label htmlFor="inviteEmail">Parent email</Label>
                <Input id="inviteEmail" name="email" type="email" />
                <Label htmlFor="invitePhone">Parent mobile</Label>
                <Input id="invitePhone" name="phone" />
              </FoundationForm>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}

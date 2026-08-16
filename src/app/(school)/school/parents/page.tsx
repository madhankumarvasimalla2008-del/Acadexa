import { FoundationForm } from "@/components/forms/foundation-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireSchoolAdmin } from "@/lib/auth/workspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { inviteParentAction } from "@/features/school/actions";

export default async function ParentsPage() {
  const { schoolId } = await requireSchoolAdmin();
  const supabase = await createServerSupabaseClient();
  const [{ data: students }, { data: invitations }] = await Promise.all([
    supabase
      .from("students")
      .select("id, student_code, full_name, status")
      .eq("school_id", schoolId)
      .order("full_name"),
    supabase
      .from("parent_students")
      .select("id, student_id, parent_id, status, created_at")
      .eq("school_id", schoolId)
      .in("status", ["invited", "accepted"])
      .order("created_at", { ascending: false }),
  ]);

  const parentAcceptUrl = `${(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/parent`;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Parents</h1>
      <Card>
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
                const student = (students ?? []).find((row) => row.id === invite.student_id);
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
  );
}

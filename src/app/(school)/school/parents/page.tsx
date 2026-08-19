import AbpsOrnament from "@/components/brand/abps-ornament";
import { EmptyState } from "@/components/brand/empty-state";
import { FoundationForm } from "@/components/forms/foundation-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireSchoolAdmin } from "@/lib/auth/workspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { inviteParentAction } from "@/features/school/actions";

const selectClassName =
  "h-10 w-full rounded-md border border-[#6b1d2a]/20 bg-white px-3 text-base text-[#6b1d2a] sm:text-sm";

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
    <div className="acadexa-anim-fade-up mx-auto max-w-3xl space-y-7 sm:space-y-10">
      <div className="border-b border-[#c9a227]/30 pb-5 sm:pb-6">
        <p className="acadexa-kicker text-[#c9a227]">Family links</p>
        <h1 className="acadexa-display mt-2 text-[1.65rem] text-[#6b1d2a] sm:text-3xl">
          Parents
        </h1>
        <AbpsOrnament className="mt-2.5 h-3.5 w-36" />
        <p className="acadexa-lede mt-2 max-w-2xl text-zinc-600">
          Search/link by email or mobile. Parents do not gain access from a Student ID.
          They must accept the invitation.
        </p>
      </div>

      <Card className="acadexa-anim-fade-up acadexa-card-premium border-[#c9a227]/30">
        <CardHeader className="border-[#c9a227]/20">
          <CardTitle className="text-[#6b1d2a]">Invitations</CardTitle>
          <CardDescription>Pending and accepted parent links for this school.</CardDescription>
        </CardHeader>
        <CardContent>
          {(invitations ?? []).length === 0 ? (
            <EmptyState
              kind="invites"
              title="No invitations yet"
              description="Create an invitation below. The parent must accept before seeing the child."
            />
          ) : (
            <ul className="space-y-3">
              {(invitations ?? []).map((invite) => {
                const student = (students ?? []).find((row) => row.id === invite.student_id);
                const accepted = invite.status === "accepted";
                return (
                  <li
                    key={invite.id}
                    className="rounded-xl border border-[#c9a227]/25 bg-white p-4 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="break-words font-medium text-[#6b1d2a]">
                          {(student?.full_name ?? "Student") +
                            (student?.student_code ? ` · ${student.student_code}` : "")}
                        </p>
                      </div>
                      <span
                        className={
                          accepted
                            ? "rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-emerald-800"
                            : "rounded-full bg-[#faf6ef] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[#6b1d2a]"
                        }
                      >
                        {invite.status}
                      </span>
                    </div>
                    {invite.status === "invited" && invite.parent_id ? (
                      <p className="mt-2 text-sm text-zinc-600">
                        Ask the parent to sign in and accept here:{" "}
                        <a
                          href={parentAcceptUrl}
                          className="break-all text-[#6b1d2a] underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {parentAcceptUrl}
                        </a>
                      </p>
                    ) : null}
                    {invite.status === "invited" && !invite.parent_id ? (
                      <p className="mt-2 text-sm text-zinc-600">
                        This invite is not tied to an existing account. The original token
                        link cannot be shown again.
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="acadexa-anim-fade-up acadexa-card-premium acadexa-delay-1 border-[#c9a227]/30">
        <CardHeader className="border-[#c9a227]/20">
          <CardTitle className="text-[#6b1d2a]">Invite a parent</CardTitle>
          <CardDescription>
            Provide email or mobile. Access starts only after the parent accepts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FoundationForm action={inviteParentAction} submitLabel="Create invitation">
            <Label htmlFor="inviteStudentId">Student</Label>
            <select
              id="inviteStudentId"
              name="studentId"
              required
              className={selectClassName}
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

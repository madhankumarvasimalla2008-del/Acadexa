import Link from "next/link";
import { FoundationForm } from "@/components/forms/foundation-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { acceptOwnInviteAction } from "@/features/parent/actions";
import { requireParentWorkspace } from "@/lib/auth/workspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function ParentChildrenPage() {
  const { context } = await requireParentWorkspace();
  const supabase = await createServerSupabaseClient();
  const acceptedIds = context.acceptedParentLinks.map((link) => link.student_id);

  const { data: students } =
    acceptedIds.length > 0
      ? await supabase
          .from("students")
          .select("id, full_name, student_code, school_id, status")
          .in("id", acceptedIds)
      : { data: [] };

  const allowedStudents = (students ?? []).filter((row) => acceptedIds.includes(row.id));
  const schoolIds = [...new Set(allowedStudents.map((row) => row.school_id))];
  const { data: schools } =
    schoolIds.length > 0
      ? await supabase.from("schools").select("id, name, code").in("id", schoolIds)
      : { data: [] };
  const schoolById = new Map((schools ?? []).map((school) => [school.id, school]));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Children</h1>
        <p className="mt-1 text-sm text-zinc-600">
          You only see children after you accept a school invitation. Selecting a
          child sets school and class context for that child alone.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Approved children</CardTitle>
          <CardDescription>
            Context follows the selected child, including children at different
            schools. Open a child to view packs and checkout.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {allowedStudents.length === 0 ? (
            <p className="text-zinc-500">No accepted children yet.</p>
          ) : (
            <ul className="space-y-3">
              {allowedStudents.map((child) => {
                const school = schoolById.get(child.school_id);
                return (
                  <li key={child.id} className="rounded-md border border-zinc-200 p-3">
                    <div className="font-medium">{child.full_name}</div>
                    <div className="text-zinc-500">
                      {child.student_code}
                      {school ? ` · ${school.name}` : ""}
                    </div>
                    <Button asChild size="sm" className="mt-3">
                      <Link href={`/parent/children/${child.id}`}>Open child</Link>
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {context.pendingParentInvites.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Pending invitations</CardTitle>
            <CardDescription>
              Confirm the relationship before this child appears above.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {context.pendingParentInvites.map((invite) => (
                <li key={invite.id} className="rounded-md border border-zinc-200 p-3">
                  <p className="mb-2 text-sm text-zinc-600">
                    Your school invited this account. Confirm to view the child.
                  </p>
                  <FoundationForm
                    action={acceptOwnInviteAction}
                    submitLabel="Accept invitation"
                  >
                    <input type="hidden" name="inviteId" value={invite.id} />
                  </FoundationForm>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

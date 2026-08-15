import { AppHeader } from "@/components/layout/app-header";
import { FoundationForm } from "@/components/forms/foundation-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth/session";
import { getActiveSchoolId } from "@/lib/auth/workspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { acceptOwnInviteAction } from "@/features/parent/actions";

export default async function ParentPage() {
  const context = await requireAuth();
  const activeSchoolId = await getActiveSchoolId(context);
  const supabase = await createServerSupabaseClient();

  const acceptedIds = context.acceptedParentLinks.map((l) => l.student_id);
  const { data: children } =
    acceptedIds.length > 0
      ? await supabase
          .from("students")
          .select("id, full_name, student_code, school_id")
          .in("id", acceptedIds)
      : { data: [] };

  return (
    <>
      <AppHeader context={context} activeSchoolId={activeSchoolId} />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Parent workspace</CardTitle>
            <CardDescription>
              Full packs and payments are not in Phase 0. You only see children
              after you accept a school invitation. Knowing a student code is
              not enough.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {(children ?? []).length === 0 ? (
              <p>No accepted children yet.</p>
            ) : (
              <ul className="space-y-2">
                {(children ?? []).map((child) => (
                  <li key={child.id} className="rounded-md border border-zinc-200 p-3">
                    <div className="font-medium">{child.full_name}</div>
                    <div className="text-zinc-500">
                      {child.student_code} · school {child.school_id}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {context.pendingParentInvites.length > 0 ? (
              <div>
                <p className="font-medium">Pending invitations</p>
                <ul className="mt-2 space-y-3">
                  {context.pendingParentInvites.map((invite) => (
                    <li key={invite.id} className="rounded-md border border-zinc-200 p-3">
                      <p className="mb-2 text-zinc-600">
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
              </div>
            ) : null}
          </CardContent>
        </Card>
      </main>
    </>
  );
}

import { AppHeader } from "@/components/layout/app-header";
import { FoundationForm } from "@/components/forms/foundation-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth/session";
import { getActiveSchoolId } from "@/lib/auth/workspace";
import { acceptInviteAction } from "@/features/parent/actions";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const context = await requireAuth();
  const activeSchoolId = await getActiveSchoolId(context);

  return (
    <>
      <AppHeader context={context} activeSchoolId={activeSchoolId} />
      <main className="mx-auto max-w-md px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Confirm parent relationship</CardTitle>
            <CardDescription>
              This uses a secure invitation token, not a student ID. Confirming
              attaches this account to the student the school invited.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FoundationForm action={acceptInviteAction} submitLabel="Accept invitation">
              <input type="hidden" name="token" value={token} />
            </FoundationForm>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

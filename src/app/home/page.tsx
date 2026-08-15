import { redirect } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { defaultHomePath, requireAuth } from "@/lib/auth/session";
import { getActiveSchoolId } from "@/lib/auth/workspace";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function SignedInHomePage() {
  const context = await requireAuth();
  const destination = defaultHomePath(context);
  if (destination !== "/home") {
    redirect(destination);
  }

  const activeSchoolId = await getActiveSchoolId(context);

  return (
    <>
      <AppHeader context={context} activeSchoolId={activeSchoolId} />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>No workspace yet</CardTitle>
            <CardDescription>
              Your account exists, but it is not a Super Admin, school staff
              member, or accepted parent. Ask a Super Admin to assign a school
              role, or wait for a school invitation and open the invite link.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-zinc-600">
            Signed in as {context.email}
          </CardContent>
        </Card>
      </main>
    </>
  );
}

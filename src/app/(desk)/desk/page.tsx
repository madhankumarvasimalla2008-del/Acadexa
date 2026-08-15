import { AppHeader } from "@/components/layout/app-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getActiveSchoolId, requireDeskAccess } from "@/lib/auth/workspace";

export default async function DeskPage() {
  const { context, schoolId } = await requireDeskAccess();
  const activeSchoolId = await getActiveSchoolId(context);
  const schoolName =
    context.memberships.find((m) => m.school_id === schoolId)?.schools?.name ??
    "School";
  const roles = context.memberships
    .filter((m) => m.school_id === schoolId)
    .map((m) => m.role)
    .join(", ");

  return (
    <>
      <AppHeader context={context} activeSchoolId={activeSchoolId} />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Distribution desk</CardTitle>
            <CardDescription>
              Route is protected for School Admins and Distribution Staff of{" "}
              {schoolName}. QR scan, receipt lookup, and handover UI are not in
              Phase 0.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-zinc-600">
            Active roles at this school: {roles || "none"}
          </CardContent>
        </Card>
      </main>
    </>
  );
}

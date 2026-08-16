import type { ReactNode } from "react";
import { requireSchoolAdmin } from "@/lib/auth/workspace";
import { availableWorkspaces } from "@/lib/auth/workspaces";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SchoolShell } from "@/components/school/school-shell";

export const dynamic = "force-dynamic";

export default async function SchoolLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { context, schoolId } = await requireSchoolAdmin();
  const supabase = await createServerSupabaseClient();
  const { data: currentYear } = await supabase
    .from("academic_years")
    .select("name")
    .eq("school_id", schoolId)
    .eq("is_current", true)
    .maybeSingle();

  const schools = [
    ...new Map(
      context.memberships.map((membership) => [
        membership.school_id,
        membership.schools?.name ?? membership.school_id,
      ]),
    ).entries(),
  ].map(([id, name]) => ({ id, name }));

  const schoolName =
    context.memberships.find((membership) => membership.school_id === schoolId)?.schools
      ?.name ?? "School";

  return (
    <SchoolShell
      schoolName={schoolName}
      academicYearName={currentYear?.name ?? null}
      adminName={context.profile?.full_name ?? ""}
      adminEmail={context.email}
      activeSchoolId={schoolId}
      schools={schools}
      workspaces={availableWorkspaces(context)}
    >
      {children}
    </SchoolShell>
  );
}

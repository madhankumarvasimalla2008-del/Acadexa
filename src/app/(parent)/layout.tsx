import type { ReactNode } from "react";
import { ParentShell } from "@/components/parent/parent-shell";
import {
  getActiveStudentId,
  requireParentWorkspace,
} from "@/lib/auth/workspace";
import { availableWorkspaces } from "@/lib/auth/workspaces";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ParentLayout({ children }: { children: ReactNode }) {
  const { context } = await requireParentWorkspace();
  const activeStudentId = await getActiveStudentId(context);
  const acceptedIds = context.acceptedParentLinks.map((link) => link.student_id);
  const supabase = await createServerSupabaseClient();

  const { data: students } =
    acceptedIds.length > 0
      ? await supabase
          .from("students")
          .select("id, full_name, student_code, school_id")
          .in("id", acceptedIds)
      : { data: [] };

  const allowedStudents = (students ?? []).filter((row) => acceptedIds.includes(row.id));
  const schoolIds = [...new Set(allowedStudents.map((row) => row.school_id))];
  const { data: schools } =
    schoolIds.length > 0
      ? await supabase.from("schools").select("id, name").in("id", schoolIds)
      : { data: [] };
  const schoolNameById = new Map((schools ?? []).map((school) => [school.id, school.name]));

  const childrenList = allowedStudents.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    studentCode: row.student_code,
    schoolName: schoolNameById.get(row.school_id) ?? "School",
  }));

  return (
    <ParentShell
      parentName={context.profile?.full_name ?? ""}
      parentEmail={context.email}
      childrenList={childrenList}
      activeStudentId={activeStudentId}
      workspaces={availableWorkspaces(context)}
    >
      {children}
    </ParentShell>
  );
}

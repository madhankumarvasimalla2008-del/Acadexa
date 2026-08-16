import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AuthContext, SchoolRole } from "@/types/auth";
import { requireAuth } from "@/lib/auth/session";

export const ACTIVE_SCHOOL_COOKIE = "acadexa_active_school";
export const ACTIVE_STUDENT_COOKIE = "acadexa_active_student";

export async function getActiveSchoolId(context: AuthContext): Promise<string | null> {
  const cookieStore = await cookies();
  const requested = cookieStore.get(ACTIVE_SCHOOL_COOKIE)?.value;
  const schoolIds = [...new Set(context.memberships.map((m) => m.school_id))];

  if (requested && schoolIds.includes(requested)) {
    return requested;
  }

  return schoolIds[0] ?? null;
}

export function membershipsForSchool(context: AuthContext, schoolId: string) {
  return context.memberships.filter((m) => m.school_id === schoolId);
}

export function hasSchoolRole(
  context: AuthContext,
  schoolId: string,
  roles: SchoolRole[],
) {
  return context.memberships.some(
    (m) => m.school_id === schoolId && roles.includes(m.role),
  );
}

export async function requireSuperAdmin() {
  const context = await requireAuth();
  if (!context.isSuperAdmin) {
    redirect("/unauthorized");
  }
  return context;
}

export async function requireSchoolAdmin() {
  const context = await requireAuth();
  const schoolId = await getActiveSchoolId(context);
  if (!schoolId || !hasSchoolRole(context, schoolId, ["school_admin"])) {
    redirect("/unauthorized");
  }
  return { context, schoolId };
}

export async function requireDeskAccess() {
  const context = await requireAuth();
  const schoolId = await getActiveSchoolId(context);
  if (
    !schoolId ||
    !hasSchoolRole(context, schoolId, ["school_admin", "distribution_staff"])
  ) {
    redirect("/unauthorized");
  }
  return { context, schoolId };
}

export async function getActiveStudentId(context: AuthContext): Promise<string | null> {
  const cookieStore = await cookies();
  const requested = cookieStore.get(ACTIVE_STUDENT_COOKIE)?.value;
  const allowed = context.acceptedParentLinks.map((link) => link.student_id);

  if (requested && allowed.includes(requested)) {
    return requested;
  }

  return allowed[0] ?? null;
}

export function isAcceptedParentChild(context: AuthContext, studentId: string) {
  return context.acceptedParentLinks.some((link) => link.student_id === studentId);
}

export async function requireParentWorkspace() {
  const context = await requireAuth();
  return { context };
}

export async function requireParentChild(studentId: string) {
  const context = await requireAuth();
  const link = context.acceptedParentLinks.find((row) => row.student_id === studentId);
  if (!link) {
    redirect("/unauthorized");
  }
  return { context, studentId, schoolId: link.school_id };
}

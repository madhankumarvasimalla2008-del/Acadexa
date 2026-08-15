import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AuthContext, SchoolRole } from "@/types/auth";
import { requireAuth } from "@/lib/auth/session";

export const ACTIVE_SCHOOL_COOKIE = "acadexa_active_school";

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

export async function requireParentWorkspace() {
  const context = await requireAuth();
  if (
    context.acceptedParentLinks.length === 0 &&
    context.pendingParentInvites.length === 0 &&
    !context.isSuperAdmin
  ) {
    // Still allow an authenticated parent account with no links yet.
    return { context };
  }
  return { context };
}

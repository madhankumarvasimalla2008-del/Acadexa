import { redirect } from "next/navigation";
import { getSuperAdminEmail, isSupabaseConfigured } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type {
  AuthContext,
  ParentStudentLink,
  SchoolMembership,
} from "@/types/auth";

export async function getAuthContext(): Promise<AuthContext | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  await maybeBootstrapSuperAdmin(user.id, user.email);

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("id", user.id)
    .maybeSingle();

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const { data: membershipRows } = await supabase
    .from("school_memberships")
    .select("id, school_id, user_id, role, schools ( id, name, code, status )")
    .eq("user_id", user.id);

  const memberships: SchoolMembership[] = (membershipRows ?? []).map((row) => {
    const raw = row as SchoolMembership & { schools: SchoolMembership["schools"] | SchoolMembership["schools"][] };
    const school = Array.isArray(raw.schools) ? (raw.schools[0] ?? null) : raw.schools;
    return {
      id: raw.id,
      school_id: raw.school_id,
      user_id: raw.user_id,
      role: raw.role,
      schools: school,
    };
  });

  const byParent = await supabase
    .from("parent_students")
    .select("id, school_id, student_id, parent_id, status")
    .eq("parent_id", user.id)
    .in("status", ["invited", "accepted"]);

  const links = (byParent.data ?? []) as ParentStudentLink[];

  return {
    userId: user.id,
    email: user.email ?? null,
    profile: {
      id: profile?.id ?? user.id,
      full_name: profile?.full_name ?? "",
      email: user.email ?? null,
      phone: user.phone ?? null,
    },
    isSuperAdmin: (roles ?? []).some((row) => row.role === "super_admin"),
    memberships,
    acceptedParentLinks: links.filter((link) => link.status === "accepted"),
    pendingParentInvites: links.filter((link) => link.status === "invited"),
  };
}

async function maybeBootstrapSuperAdmin(userId: string, email: string | undefined) {
  const configured = getSuperAdminEmail();
  if (!configured || !email || email.toLowerCase() !== configured) {
    return;
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return;
  }

  const admin = createServiceRoleClient();
  await admin.from("user_roles").upsert(
    { user_id: userId, role: "super_admin" },
    { onConflict: "user_id,role" },
  );
}

export async function requireAuth(): Promise<AuthContext> {
  const context = await getAuthContext();
  if (!context) {
    redirect("/login");
  }
  return context;
}

export function defaultHomePath(context: AuthContext): string {
  if (context.isSuperAdmin) {
    return "/platform";
  }
  if (context.memberships.some((m) => m.role === "school_admin")) {
    return "/school";
  }
  if (context.memberships.some((m) => m.role === "distribution_staff")) {
    return "/desk";
  }
  if (context.acceptedParentLinks.length > 0 || context.pendingParentInvites.length > 0) {
    return "/parent";
  }
  return "/home";
}

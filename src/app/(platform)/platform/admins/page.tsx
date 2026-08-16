import Link from "next/link";
import { FoundationForm } from "@/components/forms/foundation-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireSuperAdmin } from "@/lib/auth/workspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assignSchoolMembershipAction } from "@/features/platform/actions";

function schoolLabel(value: unknown): string {
  if (!value || typeof value !== "object") {
    return "School";
  }
  const row = (Array.isArray(value) ? value[0] : value) as { name?: string; code?: string };
  if (row?.name && row?.code) {
    return `${row.name} (${row.code})`;
  }
  return row?.name ?? "School";
}

export default async function PlatformAdminsPage() {
  await requireSuperAdmin();
  const supabase = await createServerSupabaseClient();

  const [{ data: schools }, { data: memberships }] = await Promise.all([
    supabase.from("schools").select("id, name, code, status").order("name"),
    supabase
      .from("school_memberships")
      .select("id, role, user_id, school_id, created_at, schools ( name, code )")
      .eq("role", "school_admin")
      .order("created_at", { ascending: false }),
  ]);

  const userIds = [...new Set((memberships ?? []).map((row) => row.user_id))];
  const { data: profiles } =
    userIds.length > 0
      ? await supabase.from("profiles").select("id, full_name, email").in("id", userIds)
      : { data: [] };
  const profileById = new Map((profiles ?? []).map((row) => [row.id, row]));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">School admins</h1>
        <p className="mt-1 text-sm text-zinc-600">
          The user must already have an Acadexa account. Roles stay school-scoped.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assigned school admins</CardTitle>
          <CardDescription>
            Distribution staff can be assigned from a school record. Names appear
            when profile access allows it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {(memberships ?? []).length === 0 ? (
              <li className="text-zinc-500">No school admins assigned yet.</li>
            ) : (
              (memberships ?? []).map((row) => {
                const profile = profileById.get(row.user_id);
                return (
                  <li key={row.id} className="rounded-md border border-zinc-200 p-3">
                    <div className="font-medium">
                      {profile?.full_name || profile?.email || `User ${row.user_id.slice(0, 8)}…`}
                    </div>
                    <div className="text-zinc-500">
                      {schoolLabel(row.schools)}
                      {profile?.email ? ` · ${profile.email}` : ""}
                    </div>
                    <Link
                      href={`/platform/schools/${row.school_id}`}
                      className="mt-2 inline-block text-sm underline"
                    >
                      Open school
                    </Link>
                  </li>
                );
              })
            )}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assign school role</CardTitle>
          <CardDescription>Look up an existing account by email.</CardDescription>
        </CardHeader>
        <CardContent>
          <FoundationForm action={assignSchoolMembershipAction} submitLabel="Assign">
            <div className="space-y-1">
              <Label htmlFor="schoolId">School</Label>
              <select
                id="schoolId"
                name="schoolId"
                required
                className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
              >
                <option value="">Select…</option>
                {(schools ?? []).map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name} ({school.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">User email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                name="role"
                required
                className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
              >
                <option value="school_admin">School Admin</option>
                <option value="distribution_staff">Distribution Staff</option>
              </select>
            </div>
          </FoundationForm>
        </CardContent>
      </Card>
    </div>
  );
}

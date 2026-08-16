import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { FoundationForm } from "@/components/forms/foundation-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireSuperAdmin } from "@/lib/auth/workspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  assignSchoolMembershipAction,
  removeSchoolMembershipAction,
  updateSchoolStatusAction,
} from "@/features/platform/actions";

export default async function PlatformSchoolDetailPage({
  params,
}: {
  params: Promise<{ schoolId: string }>;
}) {
  await requireSuperAdmin();
  const { schoolId: rawId } = await params;
  const parsedId = z.string().uuid().safeParse(rawId);
  if (!parsedId.success) {
    redirect("/unauthorized");
  }
  const schoolId = parsedId.data;
  const supabase = await createServerSupabaseClient();

  const [{ data: school }, { data: memberships }] = await Promise.all([
    supabase
      .from("schools")
      .select("id, name, code, status, contact_email, contact_phone, created_at")
      .eq("id", schoolId)
      .maybeSingle(),
    supabase
      .from("school_memberships")
      .select("id, role, user_id, created_at")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false }),
  ]);

  if (!school) {
    redirect("/unauthorized");
  }

  const userIds = [...new Set((memberships ?? []).map((row) => row.user_id))];
  const { data: profiles } =
    userIds.length > 0
      ? await supabase.from("profiles").select("id, full_name, email").in("id", userIds)
      : { data: [] };
  const profileById = new Map((profiles ?? []).map((row) => [row.id, row]));
  const nextStatus = school.status === "active" ? "suspended" : "active";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-sm text-zinc-500">
          <Link href="/platform/schools" className="underline">
            Schools
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{school.name}</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {school.code} · {school.status}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>School record</CardTitle>
          <CardDescription>
            Status is stored on the school row. Super Admin may suspend or reactivate.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {school.contact_email ? <p>Contact email: {school.contact_email}</p> : null}
          {school.contact_phone ? <p>Contact phone: {school.contact_phone}</p> : null}
          <FoundationForm
            action={updateSchoolStatusAction}
            submitLabel={school.status === "active" ? "Suspend school" : "Set school active"}
          >
            <input type="hidden" name="schoolId" value={school.id} />
            <input type="hidden" name="status" value={nextStatus} />
          </FoundationForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assigned roles</CardTitle>
          <CardDescription>
            School-scoped memberships only. Names appear when profile access allows it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2 text-sm">
            {(memberships ?? []).length === 0 ? (
              <li className="text-zinc-500">No roles assigned yet.</li>
            ) : (
              (memberships ?? []).map((row) => {
                const profile = profileById.get(row.user_id);
                return (
                  <li key={row.id} className="rounded-md border border-zinc-200 p-3">
                    <div className="font-medium">
                      {profile?.full_name || profile?.email || `User ${row.user_id.slice(0, 8)}…`}
                    </div>
                    <div className="text-zinc-500">
                      {row.role.replaceAll("_", " ")}
                      {profile?.email ? ` · ${profile.email}` : ""}
                    </div>
                    <FoundationForm
                      action={removeSchoolMembershipAction}
                      submitLabel="Remove role"
                    >
                      <input type="hidden" name="membershipId" value={row.id} />
                      <input type="hidden" name="schoolId" value={schoolId} />
                    </FoundationForm>
                  </li>
                );
              })
            )}
          </ul>
          <FoundationForm action={assignSchoolMembershipAction} submitLabel="Assign role">
            <input type="hidden" name="schoolId" value={schoolId} />
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

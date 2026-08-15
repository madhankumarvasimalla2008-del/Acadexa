import { AppHeader } from "@/components/layout/app-header";
import { FoundationForm } from "@/components/forms/foundation-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireSuperAdmin } from "@/lib/auth/workspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  assignSchoolMembershipAction,
  createSchoolAction,
} from "@/features/platform/actions";

export default async function PlatformPage() {
  const context = await requireSuperAdmin();
  const supabase = await createServerSupabaseClient();
  const { data: schools } = await supabase
    .from("schools")
    .select("id, name, code, status")
    .order("created_at", { ascending: false });

  return (
    <>
      <AppHeader context={context} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold">Platform</h1>
          <p className="text-sm text-zinc-600">
            Super Admin foundation only. No operational school dashboards here.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Schools</CardTitle>
              <CardDescription>Tenant records. Isolation is by school_id + RLS.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm">
                {(schools ?? []).length === 0 ? <li>No schools yet.</li> : null}
                {(schools ?? []).map((school) => (
                  <li key={school.id} className="rounded-md border border-zinc-200 p-3">
                    <div className="font-medium">{school.name}</div>
                    <div className="text-zinc-500">
                      {school.code} · {school.status} · {school.id}
                    </div>
                  </li>
                ))}
              </ul>
              <FoundationForm action={createSchoolAction} submitLabel="Create school">
                <div className="space-y-1">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="code">Code</Label>
                  <Input id="code" name="code" required />
                </div>
              </FoundationForm>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Assign school role</CardTitle>
              <CardDescription>
                The user must already have an Acadexa account. Roles stay school-scoped.
              </CardDescription>
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
                        {school.name}
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
      </main>
    </>
  );
}

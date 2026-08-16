import Link from "next/link";
import { FoundationForm } from "@/components/forms/foundation-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { requireSuperAdmin } from "@/lib/auth/workspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSchoolAction } from "@/features/platform/actions";

export default async function PlatformSchoolsPage() {
  await requireSuperAdmin();
  const supabase = await createServerSupabaseClient();
  const { data: schools } = await supabase
    .from("schools")
    .select("id, name, code, status, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Schools</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Tenant records. Isolation is by school_id and access policies.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All schools</CardTitle>
          <CardDescription>Open a school to see status and assigned roles.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2 text-sm">
            {(schools ?? []).length === 0 ? (
              <li className="text-zinc-500">No schools yet.</li>
            ) : (
              (schools ?? []).map((school) => (
                <li key={school.id} className="rounded-md border border-zinc-200 p-3">
                  <div className="font-medium">{school.name}</div>
                  <div className="text-zinc-500">
                    {school.code} · {school.status}
                  </div>
                  <Button asChild size="sm" className="mt-3">
                    <Link href={`/platform/schools/${school.id}`}>Open school</Link>
                  </Button>
                </li>
              ))
            )}
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
    </div>
  );
}

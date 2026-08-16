import { FoundationForm } from "@/components/forms/foundation-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireSchoolAdmin } from "@/lib/auth/workspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createClassAction } from "@/features/school/actions";

export default async function ClassesPage() {
  const { schoolId } = await requireSchoolAdmin();
  const supabase = await createServerSupabaseClient();
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, section")
    .eq("school_id", schoolId)
    .order("name");

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Classes</h1>
      <Card>
        <CardHeader>
          <CardTitle>Classes</CardTitle>
          <CardDescription>Reusable across years via enrollments.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="text-sm">
            {(classes ?? []).length === 0 ? (
              <li className="text-zinc-500">No classes yet.</li>
            ) : (
              (classes ?? []).map((klass) => (
                <li key={klass.id} className="border-b border-zinc-100 py-2 last:border-0">
                  {klass.name}
                  {klass.section ? ` · ${klass.section}` : ""}
                </li>
              ))
            )}
          </ul>
          <FoundationForm action={createClassAction} submitLabel="Add class">
            <Label htmlFor="className">Name</Label>
            <Input id="className" name="name" required />
            <Label htmlFor="section">Section</Label>
            <Input id="section" name="section" />
          </FoundationForm>
        </CardContent>
      </Card>
    </div>
  );
}

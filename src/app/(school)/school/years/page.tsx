import { FoundationForm } from "@/components/forms/foundation-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireSchoolAdmin } from "@/lib/auth/workspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAcademicYearAction } from "@/features/school/actions";

export default async function AcademicYearsPage() {
  const { schoolId } = await requireSchoolAdmin();
  const supabase = await createServerSupabaseClient();
  const { data: years } = await supabase
    .from("academic_years")
    .select("id, name, starts_on, ends_on, is_current")
    .eq("school_id", schoolId)
    .order("starts_on", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Academic Years</h1>
      <Card>
        <CardHeader>
          <CardTitle>Years</CardTitle>
          <CardDescription>
            Historical years stay as rows. Do not overwrite a year in place.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="text-sm">
            {(years ?? []).length === 0 ? (
              <li className="text-zinc-500">No academic years yet.</li>
            ) : (
              (years ?? []).map((year) => (
                <li key={year.id} className="border-b border-zinc-100 py-2 last:border-0">
                  {year.name} ({year.starts_on} → {year.ends_on})
                  {year.is_current ? " · current" : ""}
                </li>
              ))
            )}
          </ul>
          <FoundationForm action={createAcademicYearAction} submitLabel="Add year">
            <Label htmlFor="name">Label</Label>
            <Input id="name" name="name" placeholder="2026-27" required />
            <Label htmlFor="startsOn">Starts</Label>
            <Input id="startsOn" name="startsOn" type="date" required />
            <Label htmlFor="endsOn">Ends</Label>
            <Input id="endsOn" name="endsOn" type="date" required />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isCurrent" /> Current year
            </label>
          </FoundationForm>
        </CardContent>
      </Card>
    </div>
  );
}

import AbpsOrnament from "@/components/brand/abps-ornament";
import { EmptyState } from "@/components/brand/empty-state";
import { FoundationForm } from "@/components/forms/foundation-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireSchoolAdmin } from "@/lib/auth/workspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  createClassAction,
  deleteClassAction,
  updateClassAction,
} from "@/features/school/actions";

const fieldClass =
  "border-[#6b1d2a]/20 text-base text-[#6b1d2a] focus-visible:ring-[#6b1d2a] sm:text-sm";
const selectClassName =
  "h-10 w-full rounded-md border border-[#6b1d2a]/20 bg-white px-3 text-base text-[#6b1d2a] sm:text-sm";
const schoolSubmitClass =
  "bg-[#6b1d2a] text-[#f7e0a3] hover:bg-[#4a121c] focus-visible:ring-[#6b1d2a]";

const CLASS_NAMES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"] as const;

export default async function ClassesPage() {
  const { schoolId } = await requireSchoolAdmin();
  const supabase = await createServerSupabaseClient();
  const { data: classes, error } = await supabase
    .from("classes")
    .select("id, name, section, sort_order")
    .eq("school_id", schoolId)
    .order("sort_order")
    .order("name");

  const rows = classes ?? [];

  return (
    <div className="acadexa-anim-fade-up mx-auto max-w-6xl space-y-7 sm:space-y-10">
      <div className="border-b border-[#c9a227]/30 pb-5 sm:pb-6">
        <p className="acadexa-kicker text-[#c9a227]">School administration</p>
        <h1 className="acadexa-display mt-2 text-[1.65rem] text-[#6b1d2a] sm:text-3xl">
          Classes
        </h1>
        <AbpsOrnament className="mt-2.5 h-3.5 w-36" />
        <p className="acadexa-lede mt-2 max-w-2xl text-zinc-600">
          Classes belong to this school and are reused across academic years. A student&apos;s
          year and class together live on enrollments.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          Could not load classes. Try again.
        </p>
      ) : null}

      <Card className="acadexa-anim-fade-up acadexa-card-premium border-[#c9a227]/30">
        <CardHeader className="border-[#c9a227]/20">
          <CardTitle className="text-[#6b1d2a]">Add class</CardTitle>
          <CardDescription>
            Classes 1–12 with an optional section (A, B, …). Duplicate name + section is blocked.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FoundationForm
            action={createClassAction}
            submitLabel="Add class"
            submitClassName={schoolSubmitClass}
          >
            <Label htmlFor="name">Class</Label>
            <select id="name" name="name" required className={selectClassName} defaultValue="1">
              {CLASS_NAMES.map((value) => (
                <option key={value} value={value}>
                  Class {value}
                </option>
              ))}
            </select>
            <Label htmlFor="section">Section (optional)</Label>
            <Input
              id="section"
              name="section"
              placeholder="A"
              className={fieldClass}
            />
          </FoundationForm>
        </CardContent>
      </Card>

      <Card className="acadexa-anim-fade-up acadexa-card-premium acadexa-delay-1 border-[#c9a227]/30">
        <CardHeader className="border-[#c9a227]/20">
          <CardTitle className="text-[#6b1d2a]">Classes</CardTitle>
          <CardDescription>
            Edit name or section. Remove only if no enrollments use the class.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 && !error ? (
            <EmptyState
              kind="classes"
              title="No classes yet"
              description="Add Class 1–12 and a section if your school uses them. They stay available for every academic year."
            />
          ) : (
            <ul className="space-y-4">
              {rows.map((klass) => (
                <li
                  key={klass.id}
                  className="rounded-xl border border-[#c9a227]/25 bg-white/80 p-4 shadow-sm"
                >
                  <p className="mb-3 font-medium text-[#6b1d2a]">
                    Class {klass.name}
                    {klass.section ? ` · ${klass.section}` : ""}
                  </p>
                  <FoundationForm
                    action={updateClassAction}
                    submitLabel="Save class"
                    submitClassName={schoolSubmitClass}
                  >
                    <input type="hidden" name="id" value={klass.id} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`name-${klass.id}`}>Name</Label>
                        <Input
                          id={`name-${klass.id}`}
                          name="name"
                          defaultValue={klass.name}
                          required
                          className={fieldClass}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`section-${klass.id}`}>Section</Label>
                        <Input
                          id={`section-${klass.id}`}
                          name="section"
                          defaultValue={klass.section ?? ""}
                          className={fieldClass}
                        />
                      </div>
                    </div>
                  </FoundationForm>
                  <div className="mt-3">
                    <FoundationForm
                      action={deleteClassAction}
                      submitLabel="Remove"
                      submitVariant="destructive"
                    >
                      <input type="hidden" name="id" value={klass.id} />
                    </FoundationForm>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

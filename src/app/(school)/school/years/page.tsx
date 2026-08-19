import AbpsOrnament from "@/components/brand/abps-ornament";
import { EmptyState } from "@/components/brand/empty-state";
import { FoundationForm } from "@/components/forms/foundation-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireSchoolAdmin } from "@/lib/auth/workspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  createAcademicYearAction,
  deleteAcademicYearAction,
  setCurrentAcademicYearAction,
  updateAcademicYearAction,
} from "@/features/school/actions";

const fieldClass =
  "border-[#6b1d2a]/20 text-base text-[#6b1d2a] focus-visible:ring-[#6b1d2a] sm:text-sm";
const schoolSubmitClass =
  "bg-[#6b1d2a] text-[#f7e0a3] hover:bg-[#4a121c] focus-visible:ring-[#6b1d2a]";

export default async function AcademicYearsPage() {
  const { schoolId } = await requireSchoolAdmin();
  const supabase = await createServerSupabaseClient();
  const { data: years, error } = await supabase
    .from("academic_years")
    .select("id, name, starts_on, ends_on, is_current")
    .eq("school_id", schoolId)
    .order("starts_on", { ascending: false });

  const rows = years ?? [];

  return (
    <div className="acadexa-anim-fade-up mx-auto max-w-6xl space-y-7 sm:space-y-10">
      <div className="border-b border-[#c9a227]/30 pb-5 sm:pb-6">
        <p className="acadexa-kicker text-[#c9a227]">School administration</p>
        <h1 className="acadexa-display mt-2 text-[1.65rem] text-[#6b1d2a] sm:text-3xl">
          Academic Years
        </h1>
        <AbpsOrnament className="mt-2.5 h-3.5 w-36" />
        <p className="acadexa-lede mt-2 max-w-2xl text-zinc-600">
          Years belong to this school. Keep historical years as separate rows — do not
          overwrite a year in place. One year can be current.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          Could not load academic years. Try again.
        </p>
      ) : null}

      <Card className="acadexa-anim-fade-up acadexa-card-premium border-[#c9a227]/30">
        <CardHeader className="border-[#c9a227]/20">
          <CardTitle className="text-[#6b1d2a]">Add year</CardTitle>
          <CardDescription>
            Example label: 2026–27. Dates must have an end after the start.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FoundationForm
            action={createAcademicYearAction}
            submitLabel="Add year"
            submitClassName={schoolSubmitClass}
          >
            <Label htmlFor="name">Label</Label>
            <Input
              id="name"
              name="name"
              placeholder="2026-27"
              required
              className={fieldClass}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startsOn">Starts</Label>
                <Input
                  id="startsOn"
                  name="startsOn"
                  type="date"
                  required
                  className={fieldClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endsOn">Ends</Label>
                <Input
                  id="endsOn"
                  name="endsOn"
                  type="date"
                  required
                  className={fieldClass}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-[#6b1d2a]">
              <input type="checkbox" name="isCurrent" className="h-4 w-4 accent-[#6b1d2a]" />
              Set as current year
            </label>
          </FoundationForm>
        </CardContent>
      </Card>

      <Card className="acadexa-anim-fade-up acadexa-card-premium acadexa-delay-1 border-[#c9a227]/30">
        <CardHeader className="border-[#c9a227]/20">
          <CardTitle className="text-[#6b1d2a]">Years</CardTitle>
          <CardDescription>
            Mark a year historical to clear current without deleting it. Remove only unused
            years.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 && !error ? (
            <EmptyState
              kind="years"
              title="No academic years yet"
              description="Add 2026–27 or another label below the header. Historical years stay on this list."
            />
          ) : (
            <ul className="space-y-4">
              {rows.map((year) => (
                <li
                  key={year.id}
                  className="rounded-xl border border-[#c9a227]/25 bg-white/80 p-4 shadow-sm"
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <p className="font-medium text-[#6b1d2a]">{year.name}</p>
                    {year.is_current ? (
                      <span className="rounded-full bg-[#faf6ef] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[#6b1d2a]">
                        Current
                      </span>
                    ) : (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-zinc-600">
                        Historical
                      </span>
                    )}
                  </div>
                  <FoundationForm
                    action={updateAcademicYearAction}
                    submitLabel="Save year"
                    submitClassName={schoolSubmitClass}
                  >
                    <input type="hidden" name="id" value={year.id} />
                    <Label htmlFor={`name-${year.id}`}>Label</Label>
                    <Input
                      id={`name-${year.id}`}
                      name="name"
                      defaultValue={year.name}
                      required
                      className={fieldClass}
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`startsOn-${year.id}`}>Starts</Label>
                        <Input
                          id={`startsOn-${year.id}`}
                          name="startsOn"
                          type="date"
                          defaultValue={year.starts_on}
                          required
                          className={fieldClass}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`endsOn-${year.id}`}>Ends</Label>
                        <Input
                          id={`endsOn-${year.id}`}
                          name="endsOn"
                          type="date"
                          defaultValue={year.ends_on}
                          required
                          className={fieldClass}
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-[#6b1d2a]">
                      <input
                        type="checkbox"
                        name="isCurrent"
                        defaultChecked={year.is_current}
                        className="h-4 w-4 accent-[#6b1d2a]"
                      />
                      Current year
                    </label>
                  </FoundationForm>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    {year.is_current ? (
                      <FoundationForm
                        action={setCurrentAcademicYearAction}
                        submitLabel="Mark historical"
                        submitVariant="outline"
                      >
                        <input type="hidden" name="id" value={year.id} />
                      </FoundationForm>
                    ) : (
                      <FoundationForm
                        action={setCurrentAcademicYearAction}
                        submitLabel="Set as current"
                        submitVariant="outline"
                      >
                        <input type="hidden" name="id" value={year.id} />
                        <input type="hidden" name="isCurrent" value="on" />
                      </FoundationForm>
                    )}
                    <FoundationForm
                      action={deleteAcademicYearAction}
                      submitLabel="Remove"
                      submitVariant="destructive"
                    >
                      <input type="hidden" name="id" value={year.id} />
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

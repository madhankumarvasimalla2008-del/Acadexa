import Link from "next/link";
import { StudentImportForm } from "@/components/school/student-import-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSchoolAdmin } from "@/lib/auth/workspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function StudentImportPage() {
  const { schoolId } = await requireSchoolAdmin();
  const supabase = await createServerSupabaseClient();

  const { data: jobs } = await supabase
    .from("student_import_jobs")
    .select(
      "id, filename, status, total_rows, inserted_count, failed_count, skipped_count, error_summary, created_at, completed_at",
    )
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(10);

  const latestJobId = jobs?.[0]?.id;
  const { data: latestRows } = latestJobId
    ? await supabase
        .from("student_import_job_rows")
        .select("row_number, status, student_code, message")
        .eq("job_id", latestJobId)
        .eq("school_id", schoolId)
        .order("row_number")
        .limit(200)
    : { data: [] };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-sm text-zinc-500">
          <Link href="/school/students" className="underline">
            Students
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Import students</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Required columns: <code>student_code</code> and <code>full_name</code>.
          School is taken from your membership, not the file. Enroll students in a
          year and class separately.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload file</CardTitle>
          <CardDescription>
            CSV UTF-8 or Excel (.xlsx), first sheet. Maximum 2 MB and 2000 rows.
            Existing codes are not overwritten.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StudentImportForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent imports</CardTitle>
          <CardDescription>Jobs for this school only.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {(jobs ?? []).length === 0 ? (
              <li className="text-zinc-500">No import jobs yet.</li>
            ) : (
              (jobs ?? []).map((job) => (
                <li key={job.id} className="rounded-md border border-zinc-200 p-3">
                  <div className="font-medium">{job.filename}</div>
                  <div className="text-zinc-500">
                    {job.status} · inserted {job.inserted_count} · failed{" "}
                    {job.failed_count} · skipped {job.skipped_count}
                    {job.error_summary ? ` · ${job.error_summary}` : ""}
                  </div>
                </li>
              ))
            )}
          </ul>
        </CardContent>
      </Card>

      {latestJobId && (latestRows ?? []).length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Latest job rows</CardTitle>
            <CardDescription>Row-level report for the most recent import.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="max-h-80 space-y-1 overflow-auto text-sm">
              {(latestRows ?? []).map((row) => (
                <li key={`${row.row_number}-${row.status}`}>
                  Row {row.row_number}: {row.status}
                  {row.student_code ? ` · ${row.student_code}` : ""}
                  {row.message ? ` · ${row.message}` : ""}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

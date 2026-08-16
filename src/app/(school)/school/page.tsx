import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireSchoolAdmin } from "@/lib/auth/workspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function formatActivity(action: string, entityType: string, createdAt: string) {
  const when = new Date(createdAt).toLocaleString();
  return `${action.replaceAll("_", " ")} · ${entityType.replaceAll("_", " ")} · ${when}`;
}

export default async function SchoolDashboardPage() {
  const { schoolId } = await requireSchoolAdmin();
  const supabase = await createServerSupabaseClient();

  const [
    studentsCount,
    classesCount,
    pendingCount,
    acceptedParents,
    currentYear,
    activity,
  ] = await Promise.all([
    supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId),
    supabase
      .from("classes")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId),
    supabase
      .from("parent_students")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("status", "invited"),
    supabase
      .from("parent_students")
      .select("parent_id")
      .eq("school_id", schoolId)
      .eq("status", "accepted")
      .not("parent_id", "is", null),
    supabase
      .from("academic_years")
      .select("name")
      .eq("school_id", schoolId)
      .eq("is_current", true)
      .maybeSingle(),
    supabase
      .from("audit_logs")
      .select("id, action, entity_type, created_at")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const parentIds = new Set(
    (acceptedParents.data ?? [])
      .map((row) => row.parent_id)
      .filter((id): id is string => Boolean(id)),
  );

  const cards = [
    { label: "Total Students", value: studentsCount.count ?? 0 },
    { label: "Total Classes", value: classesCount.count ?? 0 },
    { label: "Total Parents", value: parentIds.size },
    { label: "Pending Parent Invitations", value: pendingCount.count ?? 0 },
    {
      label: "Current Academic Year",
      value: currentYear.data?.name ?? "Not set",
    },
  ];

  const logs = activity.data ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Overview for this school. Counts are limited to your school by access
          policies.
        </p>
      </div>

      <section aria-label="Overview">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {cards.map((card) => (
            <Card key={card.label}>
              <CardHeader className="border-0 p-4 pb-0">
                <CardDescription>{card.label}</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <p className="text-2xl font-semibold tabular-nums text-zinc-900">
                  {card.value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section aria-label="Quick actions">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Jump to common school admin tasks.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href="/school/students">Add Student</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/school/classes">Add Class</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/school/parents">Invite Parent</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/school/requirements">Manage Requirements</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section aria-label="Recent activity">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              School audit events only. Nothing is invented when the log is empty.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-sm text-zinc-500">No recent school activity yet.</p>
            ) : (
              <ul className="divide-y divide-zinc-100 text-sm">
                {logs.map((row) => (
                  <li key={row.id} className="py-2 capitalize text-zinc-700">
                    {formatActivity(row.action, row.entity_type, row.created_at)}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

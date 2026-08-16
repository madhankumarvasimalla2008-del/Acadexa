import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireSuperAdmin } from "@/lib/auth/workspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function formatActivity(action: string, entityType: string, createdAt: string) {
  const when = new Date(createdAt).toLocaleString();
  return `${action.replaceAll("_", " ")} · ${entityType.replaceAll("_", " ")} · ${when}`;
}

export default async function PlatformDashboardPage() {
  await requireSuperAdmin();
  const supabase = await createServerSupabaseClient();

  const [schools, activeSchools, suspendedSchools, admins, staff, activity] = await Promise.all([
    supabase.from("schools").select("id", { count: "exact", head: true }),
    supabase.from("schools").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("schools").select("id", { count: "exact", head: true }).eq("status", "suspended"),
    supabase
      .from("school_memberships")
      .select("id", { count: "exact", head: true })
      .eq("role", "school_admin"),
    supabase
      .from("school_memberships")
      .select("id", { count: "exact", head: true })
      .eq("role", "distribution_staff"),
    supabase
      .from("audit_logs")
      .select("id, action, entity_type, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const cards = [
    { label: "Schools", value: schools.count ?? 0 },
    { label: "Active schools", value: activeSchools.count ?? 0 },
    { label: "Suspended schools", value: suspendedSchools.count ?? 0 },
    { label: "School admins", value: admins.count ?? 0 },
    { label: "Distribution staff", value: staff.count ?? 0 },
  ];

  const logs = activity.data ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Platform</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Super Admin overview. This is not an operational school dashboard.
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
                <p className="text-2xl font-semibold tabular-nums text-zinc-900">{card.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section aria-label="Quick actions">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Create tenants and assign school-scoped roles.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href="/platform/schools">Create school</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/platform/admins">Assign school admin</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/platform/audit">View audit</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section aria-label="Recent activity">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Platform audit events. Nothing is invented when the log is empty.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-sm text-zinc-500">No platform activity yet.</p>
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

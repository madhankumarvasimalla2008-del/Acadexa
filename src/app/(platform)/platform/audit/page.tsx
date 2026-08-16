import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSuperAdmin } from "@/lib/auth/workspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function PlatformAuditPage() {
  await requireSuperAdmin();
  const supabase = await createServerSupabaseClient();
  const { data: logs } = await supabase
    .from("audit_logs")
    .select("id, action, entity_type, school_id, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Audit</h1>
      <Card>
        <CardHeader>
          <CardTitle>Recent audit events</CardTitle>
          <CardDescription>
            Super Admin can read platform and school audit rows. Empty means none
            have been written yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(logs ?? []).length === 0 ? (
            <p className="text-sm text-zinc-500">No audit events yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 text-sm">
              {(logs ?? []).map((row) => (
                <li key={row.id} className="py-2 text-zinc-700">
                  <span className="capitalize">{row.action.replaceAll("_", " ")}</span>
                  {" · "}
                  <span className="capitalize">{row.entity_type.replaceAll("_", " ")}</span>
                  {row.school_id ? ` · school ${row.school_id.slice(0, 8)}…` : " · platform"}
                  {" · "}
                  {new Date(row.created_at).toLocaleString()}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

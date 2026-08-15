import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function writeAuditLog(input: {
  schoolId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = await createServerSupabaseClient();
  await supabase.rpc("write_audit_log", {
    p_school_id: input.schoolId ?? null,
    p_action: input.action,
    p_entity_type: input.entityType,
    p_entity_id: input.entityId ?? null,
    p_metadata: input.metadata ?? {},
  });
}

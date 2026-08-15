"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { requireSuperAdmin } from "@/lib/auth/workspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { membershipSchema, schoolCreateSchema } from "@/lib/validations/phase0";
import type { ActionState } from "@/features/auth/actions";

export async function createSchoolAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSuperAdmin();

  const parsed = schoolCreateSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid school." };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("schools")
    .insert({
      name: parsed.data.name,
      code: parsed.data.code.toUpperCase(),
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  await writeAuditLog({
    action: "school.create",
    entityType: "schools",
    entityId: data.id,
    metadata: { code: parsed.data.code },
  });

  revalidatePath("/platform");
  return { success: "School created." };
}

export async function assignSchoolMembershipAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSuperAdmin();

  const parsed = membershipSchema.safeParse({
    schoolId: formData.get("schoolId"),
    email: formData.get("email"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid membership." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: matches, error: lookupError } = await supabase.rpc(
    "find_profile_by_contact",
    {
      p_email: parsed.data.email,
      p_phone: null,
      p_school_id: null,
    },
  );

  if (lookupError) {
    return { error: lookupError.message };
  }

  const profile = (matches ?? [])[0] as { id: string } | undefined;
  if (!profile) {
    return {
      error: "No account found for that email. The person must register first.",
    };
  }

  const { error } = await supabase.from("school_memberships").insert({
    school_id: parsed.data.schoolId,
    user_id: profile.id,
    role: parsed.data.role,
  });

  if (error) {
    return { error: error.message };
  }

  await writeAuditLog({
    schoolId: parsed.data.schoolId,
    action: "membership.assign",
    entityType: "school_memberships",
    metadata: { userId: profile.id, role: parsed.data.role },
  });

  revalidatePath("/platform");
  return { success: "Membership assigned." };
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { inviteTokenSchema } from "@/lib/validations/phase0";
import type { ActionState } from "@/features/auth/actions";

export async function acceptInviteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAuth();

  const parsed = inviteTokenSchema.safeParse({
    token: formData.get("token"),
  });
  if (!parsed.success) {
    return { error: "Invalid invitation token." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("accept_parent_student_invite", {
    p_token: parsed.data.token,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/parent");
  revalidatePath("/home");
  redirect("/parent");
}

export async function acceptOwnInviteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAuth();

  const parsed = z.object({ inviteId: z.string().uuid() }).safeParse({
    inviteId: formData.get("inviteId"),
  });
  if (!parsed.success) {
    return { error: "Invalid invitation." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("accept_own_parent_student_invite", {
    p_id: parsed.data.inviteId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/parent");
  return { success: "Relationship confirmed. You can now view this child." };
}

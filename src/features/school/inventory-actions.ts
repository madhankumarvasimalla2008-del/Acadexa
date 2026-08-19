"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/features/auth/actions";
import { writeAuditLog } from "@/lib/audit";
import { requireSchoolAdmin } from "@/lib/auth/workspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { inventoryMovementSchema } from "@/lib/validations/inventory";

function revalidateInventory() {
  revalidatePath("/school/inventory");
  revalidatePath("/school/distribution");
}

export async function recordInventoryMovementAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { schoolId, context } = await requireSchoolAdmin();
  const parsed = inventoryMovementSchema.safeParse({
    variantId: formData.get("variantId"),
    reason: formData.get("reason"),
    quantity: formData.get("quantity"),
    note: formData.get("note"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid stock movement." };
  }

  const delta = Number(parsed.data.quantity);
  if (parsed.data.reason === "stock_in" && delta <= 0) {
    return { error: "Stock in must be a positive quantity." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: variant, error: variantError } = await supabase
    .from("product_variants")
    .select("id")
    .eq("id", parsed.data.variantId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (variantError || !variant) {
    return { error: "That item is not in this school’s catalog." };
  }

  const { error } = await supabase.from("inventory_transactions").insert({
    school_id: schoolId,
    product_variant_id: variant.id,
    reason: parsed.data.reason,
    on_hand_delta: delta,
    note: parsed.data.note || null,
    created_by: context.userId,
  });

  if (error) {
    if (/below zero|cannot go below/i.test(error.message)) {
      return { error: "Stock cannot go below zero." };
    }
    if (/distributed quantity cannot exceed/i.test(error.message)) {
      return { error: "Distributed quantity cannot exceed available stock." };
    }
    return { error: error.message || "Could not record the stock movement." };
  }

  await writeAuditLog({
    schoolId,
    action:
      parsed.data.reason === "stock_in" ? "inventory.stock_in" : "inventory.adjustment",
    entityType: "inventory_transactions",
    entityId: variant.id,
    metadata: { delta, reason: parsed.data.reason },
  });
  revalidateInventory();
  return {
    success:
      parsed.data.reason === "stock_in" ? "Stock added." : "Stock adjustment recorded.",
  };
}

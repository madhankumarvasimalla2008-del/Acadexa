"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/features/auth/actions";
import { writeAuditLog } from "@/lib/audit";
import { requireSchoolAdmin } from "@/lib/auth/workspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { recordDistributionSchema } from "@/lib/validations/distribution";

function revalidateDistribution() {
  revalidatePath("/school/distribution");
  revalidatePath("/school/inventory");
}

function mapDistributionError(message: string) {
  if (/only successfully paid/i.test(message)) {
    return "Only successfully paid orders can be distributed.";
  }
  if (/cannot exceed the paid quantity/i.test(message)) {
    return "Distributed quantity cannot exceed the paid quantity.";
  }
  if (/cannot exceed available inventory/i.test(message) || /cannot exceed available stock/i.test(message)) {
    return "Distributed quantity cannot exceed available inventory.";
  }
  if (/negative quantity/i.test(message) || /below zero/i.test(message)) {
    return "Cannot distribute a negative quantity.";
  }
  if (/not on this paid order/i.test(message) || /not found for this school/i.test(message)) {
    return "That pack is not available to distribute at this school.";
  }
  return message || "Could not record distribution.";
}

export async function recordDistributionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { schoolId, context } = await requireSchoolAdmin();
  const itemEntries: Array<{ orderItemId: string; quantity: number }> = [];

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("qty:") || typeof value !== "string") {
      continue;
    }
    const orderItemId = key.slice(4);
    const quantity = Number(value);
    if (!Number.isInteger(quantity)) {
      return { error: "Enter a whole number for each quantity." };
    }
    if (quantity < 0) {
      return { error: "Cannot distribute a negative quantity." };
    }
    if (quantity === 0) {
      continue;
    }
    itemEntries.push({ orderItemId, quantity });
  }

  const parsed = recordDistributionSchema.safeParse({
    orderId: formData.get("orderId"),
    note: formData.get("note"),
    items: itemEntries,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid distribution." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, payment_status")
    .eq("id", parsed.data.orderId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (orderError || !order) {
    return { error: "That pack is not available to distribute at this school." };
  }
  if (order.payment_status !== "successful") {
    return { error: "Only successfully paid orders can be distributed." };
  }

  const { data: orderItems, error: itemsError } = await supabase
    .from("order_items")
    .select("id, product_variant_id, quantity")
    .eq("order_id", order.id)
    .eq("school_id", schoolId);

  if (itemsError || !orderItems?.length) {
    return { error: "This paid pack has no items to distribute." };
  }

  const itemsById = new Map(orderItems.map((item) => [item.id, item]));
  const { data: existingEvents, error: eventsError } = await supabase
    .from("distribution_events")
    .select("order_item_id, quantity")
    .eq("order_id", order.id)
    .eq("school_id", schoolId);

  if (eventsError) {
    return { error: "Could not load existing distribution records." };
  }

  const alreadyByItem = new Map<string, number>();
  for (const event of existingEvents ?? []) {
    alreadyByItem.set(
      event.order_item_id,
      (alreadyByItem.get(event.order_item_id) ?? 0) + Number(event.quantity ?? 0),
    );
  }

  const variantIds = [...new Set(orderItems.map((item) => item.product_variant_id))];
  const { data: balances, error: balanceError } = await supabase
    .from("inventory_balances")
    .select("product_variant_id, on_hand, distributed")
    .eq("school_id", schoolId)
    .in("product_variant_id", variantIds);

  if (balanceError) {
    return { error: "Could not load available inventory." };
  }

  const availableByVariant = new Map<string, number>();
  for (const row of balances ?? []) {
    availableByVariant.set(row.product_variant_id, row.on_hand - row.distributed);
  }

  const rows: Array<{
    school_id: string;
    order_id: string;
    order_item_id: string;
    product_variant_id: string;
    quantity: number;
    note: string | null;
    created_by: string;
  }> = [];

  const issuingByVariant = new Map<string, number>();

  for (const entry of parsed.data.items) {
    const item = itemsById.get(entry.orderItemId);
    if (!item) {
      return { error: "That item is not on this paid order." };
    }
    const already = alreadyByItem.get(item.id) ?? 0;
    const remainingPaid = Number(item.quantity) - already;
    if (entry.quantity > remainingPaid) {
      return { error: "Distributed quantity cannot exceed the paid quantity." };
    }
    const issuing = (issuingByVariant.get(item.product_variant_id) ?? 0) + entry.quantity;
    issuingByVariant.set(item.product_variant_id, issuing);
    const available = availableByVariant.get(item.product_variant_id) ?? 0;
    if (issuing > available) {
      return { error: "Distributed quantity cannot exceed available inventory." };
    }
    rows.push({
      school_id: schoolId,
      order_id: order.id,
      order_item_id: item.id,
      product_variant_id: item.product_variant_id,
      quantity: entry.quantity,
      note: parsed.data.note || null,
      created_by: context.userId,
    });
  }

  const { error } = await supabase.from("distribution_events").insert(rows);
  if (error) {
    return { error: mapDistributionError(error.message) };
  }

  await writeAuditLog({
    schoolId,
    action: "distribution.record",
    entityType: "distribution_events",
    entityId: order.id,
    metadata: {
      itemCount: rows.length,
      quantities: rows.map((row) => ({
        orderItemId: row.order_item_id,
        quantity: row.quantity,
      })),
    },
  });
  revalidateDistribution();
  return { success: "Distribution recorded." };
}

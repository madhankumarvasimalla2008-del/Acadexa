"use server";

import { revalidatePath } from "next/cache";
import { checkoutPackSchema } from "@/lib/validations/payments";
import type { ActionState } from "@/features/auth/actions";
import { writeAuditLog } from "@/lib/audit";
import { requireParentChild } from "@/lib/auth/workspace";
import { settleSandboxAttempt } from "@/lib/payments/sandbox";
import { toAmount } from "@/lib/payments/display";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ProductInfo = { name: string };
type VariantInfo = {
  id: string;
  unit_price_amount: number | string | null;
  products: ProductInfo | ProductInfo[] | null;
};

function asRelated<T extends object>(value: unknown): T | null {
  if (!value) {
    return null;
  }
  if (Array.isArray(value)) {
    return (value[0] as T | undefined) ?? null;
  }
  return value as T;
}

function classLabel(name: string, section: string | null) {
  return section ? `Class ${name} · ${section}` : `Class ${name}`;
}

function revalidateCheckout(studentId: string) {
  revalidatePath("/school/payments");
  revalidatePath(`/parent/children/${studentId}`);
  revalidatePath(`/parent/children/${studentId}/packs`);
  revalidatePath(`/parent/children/${studentId}/packs`, "layout");
}

async function prepareCheckout(formData: FormData) {
  const parsed = checkoutPackSchema.safeParse({
    studentId: formData.get("studentId"),
    packId: formData.get("packId"),
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid checkout." };
  }

  const { studentId, schoolId, context } = await requireParentChild(parsed.data.studentId);
  const parentId = context.userId;
  const supabase = await createServerSupabaseClient();

  const [{ data: student }, { data: pack }, { data: school }] = await Promise.all([
    supabase
      .from("students")
      .select("id, full_name, school_id")
      .eq("id", studentId)
      .eq("school_id", schoolId)
      .maybeSingle(),
    supabase
      .from("packs")
      .select(
        "id, name, pack_type, price_amount, is_active, school_id, academic_year_id, class_id, allows_repeat_purchase",
      )
      .eq("id", parsed.data.packId)
      .eq("school_id", schoolId)
      .maybeSingle(),
    supabase.from("schools").select("id, name").eq("id", schoolId).maybeSingle(),
  ]);

  if (!student || !pack || !school) {
    return { ok: false as const, error: "That pack is not available for this child." };
  }
  if (!pack.is_active) {
    return { ok: false as const, error: "This pack is not currently available." };
  }

  const [{ data: enrollment }, { data: year }, { data: klass }, { data: items }, { data: existing }] =
    await Promise.all([
      supabase
        .from("student_enrollments")
        .select("id")
        .eq("student_id", studentId)
        .eq("school_id", schoolId)
        .eq("academic_year_id", pack.academic_year_id)
        .eq("class_id", pack.class_id)
        .maybeSingle(),
      supabase
        .from("academic_years")
        .select("id, name")
        .eq("id", pack.academic_year_id)
        .eq("school_id", schoolId)
        .maybeSingle(),
      supabase
        .from("classes")
        .select("id, name, section")
        .eq("id", pack.class_id)
        .eq("school_id", schoolId)
        .maybeSingle(),
      supabase
        .from("pack_items")
        .select(
          "id, quantity, product_variant_id, product_variants ( id, unit_price_amount, products ( name ) )",
        )
        .eq("pack_id", pack.id)
        .eq("school_id", schoolId),
      supabase
        .from("orders")
        .select("id, payment_status")
        .eq("student_id", studentId)
        .eq("pack_id", pack.id)
        .eq("school_id", schoolId)
        .in("payment_status", ["pending", "successful", "failed"]),
    ]);

  if (!enrollment || !year || !klass) {
    return { ok: false as const, error: "This pack does not match the child’s year and class." };
  }

  const blocking = (existing ?? []).find((row) => row.payment_status === "successful");
  if (blocking && !pack.allows_repeat_purchase) {
    return { ok: false as const, error: "This pack is already paid for this student." };
  }

  const reusable =
    (existing ?? []).find((row) => row.payment_status === "pending") ??
    (existing ?? []).find((row) => row.payment_status === "failed") ??
    null;

  return {
    ok: true as const,
    supabase,
    parentId,
    studentId,
    schoolId,
    student,
    pack,
    school,
    year,
    klass,
    items: items ?? [],
    reusable,
  };
}

async function createPendingAttempt(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  input: {
    parentId: string;
    studentId: string;
    schoolId: string;
    student: { full_name: string };
    pack: {
      id: string;
      name: string;
      pack_type: string;
      price_amount: number | string;
      academic_year_id: string;
      class_id: string;
    };
    school: { name: string };
    year: { name: string };
    klass: { name: string; section: string | null };
    items: Array<{
      quantity: number;
      product_variant_id: string;
      product_variants?: unknown;
    }>;
    reusable: { id: string; payment_status: string } | null;
  },
): Promise<{ error: string } | { orderId: string; transactionId: string; schoolId: string }> {
  const amount = toAmount(input.pack.price_amount);
  let orderId = input.reusable?.id ?? null;

  if (!orderId) {
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        school_id: input.schoolId,
        academic_year_id: input.pack.academic_year_id,
        class_id: input.pack.class_id,
        student_id: input.studentId,
        parent_id: input.parentId,
        pack_id: input.pack.id,
        amount_snapshot: amount,
        currency: "INR",
        payment_status: "pending",
        pack_name_snapshot: input.pack.name,
        pack_type_snapshot: input.pack.pack_type,
        pack_price_snapshot: amount,
        student_name_snapshot: input.student.full_name,
        school_name_snapshot: input.school.name,
        academic_year_name_snapshot: input.year.name,
        class_name_snapshot: classLabel(input.klass.name, input.klass.section),
      })
      .select("id")
      .single();

    if (orderError || !order) {
      if (orderError?.code === "23505") {
        return { error: "A checkout for this pack is already in progress." };
      }
      return { error: orderError?.message ?? "Could not start checkout." };
    }

    orderId = order.id;
    const lines = input.items.map((item) => {
      const variant = asRelated<VariantInfo>(item.product_variants);
      const product = asRelated<ProductInfo>(variant?.products);
      return {
        school_id: input.schoolId,
        order_id: orderId!,
        product_variant_id: item.product_variant_id,
        name_snapshot: product?.name ?? "Item",
        quantity: item.quantity,
        unit_price_snapshot: variant ? toAmount(variant.unit_price_amount) : null,
      };
    });
    if (lines.length > 0) {
      const { error: itemsError } = await supabase.from("order_items").insert(lines);
      if (itemsError) {
        return { error: itemsError.message };
      }
    }
  }

  if (!orderId) {
    return { error: "Could not start checkout." };
  }

  const { data: attempt, error: attemptError } = await supabase
    .from("payment_transactions")
    .insert({
      school_id: input.schoolId,
      order_id: orderId,
      parent_id: input.parentId,
      provider: "sandbox",
      status: "pending",
      amount,
      currency: "INR",
    })
    .select("id")
    .single();

  if (attemptError || !attempt) {
    return { error: attemptError?.message ?? "Could not start payment." };
  }

  return { orderId, transactionId: attempt.id, schoolId: input.schoolId };
}

export async function payPackAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const prepared = await prepareCheckout(formData);
  if (!prepared.ok) {
    return { error: prepared.error };
  }

  const started = await createPendingAttempt(prepared.supabase, prepared);
  if ("error" in started) {
    return { error: started.error };
  }

  const settled = await settleSandboxAttempt({
    transactionId: started.transactionId,
    orderId: started.orderId,
    schoolId: started.schoolId,
    result: "successful",
  });
  if (settled.error) {
    return { error: settled.error };
  }

  await writeAuditLog({
    schoolId: prepared.schoolId,
    action: "payment.successful",
    entityType: "orders",
    entityId: started.orderId,
    metadata: { packId: prepared.pack.id, provider: "sandbox" },
  });
  revalidateCheckout(prepared.studentId);
  return { success: "Payment successful." };
}

export async function failPackPaymentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const prepared = await prepareCheckout(formData);
  if (!prepared.ok) {
    return { error: prepared.error };
  }

  const started = await createPendingAttempt(prepared.supabase, prepared);
  if ("error" in started) {
    return { error: started.error };
  }

  const settled = await settleSandboxAttempt({
    transactionId: started.transactionId,
    orderId: started.orderId,
    schoolId: started.schoolId,
    result: "failed",
    failureReason: "Sandbox payment declined.",
  });
  if (settled.error) {
    return { error: settled.error };
  }

  await writeAuditLog({
    schoolId: prepared.schoolId,
    action: "payment.failed",
    entityType: "orders",
    entityId: started.orderId,
    metadata: { packId: prepared.pack.id, provider: "sandbox" },
  });
  revalidateCheckout(prepared.studentId);
  return { error: "Payment failed. You can retry checkout for this pack." };
}

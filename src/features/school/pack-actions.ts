"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { requireSchoolAdmin } from "@/lib/auth/workspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  packCreateSchema,
  packIdSchema,
  packItemAddSchema,
  packItemIdSchema,
  packItemUpdateSchema,
  packUpdateSchema,
} from "@/lib/validations/packs";
import type { ActionState } from "@/features/auth/actions";

function revalidatePackPaths() {
  revalidatePath("/school");
  revalidatePath("/school/packs");
}

function mapPackError(error: { code?: string; message: string }): string {
  const code = error.code ?? "";
  const message = error.message ?? "";
  if (code === "23505" || /duplicate key|unique constraint/i.test(message)) {
    return "A pack with this name already exists for the selected year and class.";
  }
  if (code === "23503" || /foreign key|violates foreign key/i.test(message)) {
    return "The selected year, class, or item is not valid for this school.";
  }
  if (code === "23514" || /check constraint/i.test(message)) {
    return "Price must be zero or more, and quantities must be greater than zero.";
  }
  return message || "Could not save the pack.";
}

function parsePrice(value: string): number {
  return Number(value);
}

async function loadOwnedPack(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  schoolId: string,
  packId: string,
) {
  return supabase
    .from("packs")
    .select("id, school_id, academic_year_id, class_id")
    .eq("id", packId)
    .eq("school_id", schoolId)
    .maybeSingle();
}

export async function createPackAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { schoolId } = await requireSchoolAdmin();
  const parsed = packCreateSchema.safeParse({
    academicYearId: formData.get("academicYearId"),
    classId: formData.get("classId"),
    name: formData.get("name"),
    packType: formData.get("packType"),
    price: formData.get("price"),
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid pack." };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("packs")
    .insert({
      school_id: schoolId,
      academic_year_id: parsed.data.academicYearId,
      class_id: parsed.data.classId,
      name: parsed.data.name,
      pack_type: parsed.data.packType,
      price_amount: parsePrice(parsed.data.price),
      currency: "INR",
      is_active: parsed.data.isActive ?? true,
    })
    .select("id")
    .single();

  if (error) {
    return { error: mapPackError(error) };
  }

  await writeAuditLog({
    schoolId,
    action: "pack.create",
    entityType: "packs",
    entityId: data.id,
  });
  revalidatePackPaths();
  return { success: "Pack created." };
}

export async function updatePackAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { schoolId } = await requireSchoolAdmin();
  const parsed = packUpdateSchema.safeParse({
    id: formData.get("id"),
    academicYearId: formData.get("academicYearId"),
    classId: formData.get("classId"),
    name: formData.get("name"),
    packType: formData.get("packType"),
    price: formData.get("price"),
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid pack." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("packs")
    .update({
      academic_year_id: parsed.data.academicYearId,
      class_id: parsed.data.classId,
      name: parsed.data.name,
      pack_type: parsed.data.packType,
      price_amount: parsePrice(parsed.data.price),
      is_active: parsed.data.isActive ?? false,
    })
    .eq("id", parsed.data.id)
    .eq("school_id", schoolId);

  if (error) {
    return { error: mapPackError(error) };
  }

  await writeAuditLog({
    schoolId,
    action: "pack.update",
    entityType: "packs",
    entityId: parsed.data.id,
  });
  revalidatePackPaths();
  return { success: "Pack updated." };
}

export async function deletePackAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { schoolId } = await requireSchoolAdmin();
  const parsed = packIdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) {
    return { error: "Invalid pack." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("packs")
    .delete()
    .eq("id", parsed.data.id)
    .eq("school_id", schoolId);

  if (error) {
    return { error: mapPackError(error) };
  }

  await writeAuditLog({
    schoolId,
    action: "pack.delete",
    entityType: "packs",
    entityId: parsed.data.id,
  });
  revalidatePackPaths();
  return { success: "Pack removed." };
}

export async function addPackItemAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { schoolId } = await requireSchoolAdmin();
  const parsed = packItemAddSchema.safeParse({
    packId: formData.get("packId"),
    requirementId: formData.get("requirementId"),
    quantity: formData.get("quantity"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid pack item." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: pack, error: packError } = await loadOwnedPack(
    supabase,
    schoolId,
    parsed.data.packId,
  );
  if (packError || !pack) {
    return { error: "Pack not found for this school." };
  }

  const { data: requirement, error: requirementError } = await supabase
    .from("school_requirements")
    .select("id, product_variant_id, academic_year_id, class_id, school_id")
    .eq("id", parsed.data.requirementId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (requirementError || !requirement) {
    return { error: "That requirement is not available for this school." };
  }
  if (
    requirement.academic_year_id !== pack.academic_year_id ||
    requirement.class_id !== pack.class_id
  ) {
    return { error: "Packs can only include requirements for the same year and class." };
  }

  const { error } = await supabase.from("pack_items").insert({
    school_id: schoolId,
    pack_id: pack.id,
    product_variant_id: requirement.product_variant_id,
    quantity: parsed.data.quantity,
  });

  if (error) {
    if (error.code === "23505" || /duplicate key|unique constraint/i.test(error.message)) {
      return { error: "That item is already in this pack." };
    }
    return { error: mapPackError(error) };
  }

  await writeAuditLog({
    schoolId,
    action: "pack_item.create",
    entityType: "pack_items",
    entityId: pack.id,
    metadata: { requirementId: parsed.data.requirementId },
  });
  revalidatePackPaths();
  return { success: "Item added to pack." };
}

export async function updatePackItemAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { schoolId } = await requireSchoolAdmin();
  const parsed = packItemUpdateSchema.safeParse({
    id: formData.get("id"),
    packId: formData.get("packId"),
    quantity: formData.get("quantity"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid pack item." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: pack } = await loadOwnedPack(supabase, schoolId, parsed.data.packId);
  if (!pack) {
    return { error: "Pack not found for this school." };
  }

  const { error } = await supabase
    .from("pack_items")
    .update({ quantity: parsed.data.quantity })
    .eq("id", parsed.data.id)
    .eq("pack_id", pack.id)
    .eq("school_id", schoolId);

  if (error) {
    return { error: mapPackError(error) };
  }

  await writeAuditLog({
    schoolId,
    action: "pack_item.update",
    entityType: "pack_items",
    entityId: parsed.data.id,
  });
  revalidatePackPaths();
  return { success: "Item quantity updated." };
}

export async function deletePackItemAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { schoolId } = await requireSchoolAdmin();
  const parsed = packItemIdSchema.safeParse({
    id: formData.get("id"),
    packId: formData.get("packId"),
  });
  if (!parsed.success) {
    return { error: "Invalid pack item." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("pack_items")
    .delete()
    .eq("id", parsed.data.id)
    .eq("pack_id", parsed.data.packId)
    .eq("school_id", schoolId);

  if (error) {
    return { error: mapPackError(error) };
  }

  await writeAuditLog({
    schoolId,
    action: "pack_item.delete",
    entityType: "pack_items",
    entityId: parsed.data.id,
  });
  revalidatePackPaths();
  return { success: "Item removed from pack." };
}

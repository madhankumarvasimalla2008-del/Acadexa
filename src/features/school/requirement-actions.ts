"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { requireSchoolAdmin } from "@/lib/auth/workspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  requirementCreateSchema,
  requirementIdSchema,
  requirementUpdateSchema,
} from "@/lib/validations/requirements";
import type { ActionState } from "@/features/auth/actions";

function revalidateRequirementPaths() {
  revalidatePath("/school");
  revalidatePath("/school/requirements");
}

function mapRequirementError(error: { code?: string; message: string }): string {
  const code = error.code ?? "";
  const message = error.message ?? "";
  if (code === "23505" || /duplicate key|unique constraint/i.test(message)) {
    return "This item is already required for the selected year and class.";
  }
  if (code === "23503" || /foreign key|violates foreign key/i.test(message)) {
    return "The selected year or class is not valid for this school.";
  }
  if (code === "23514" || /check constraint/i.test(message)) {
    return "Quantity must be greater than zero.";
  }
  return message || "Could not save the requirement.";
}

function parseUnitPrice(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function subjectValue(value: string | undefined): string | null {
  return value ? value : null;
}

async function ensureVariant(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  input: {
    schoolId: string;
    kind: "book" | "uniform" | "other";
    name: string;
    subject: string | null;
    unitPrice: number | null;
  },
): Promise<{ variantId: string } | { error: string }> {
  const subject = input.subject;

  const findProduct = () => {
    let query = supabase
      .from("products")
      .select("id")
      .eq("school_id", input.schoolId)
      .eq("kind", input.kind)
      .eq("name", input.name);
    query = subject
      ? query.eq("subject", subject)
      : query.is("subject", null);
    return query.maybeSingle();
  };

  const { data: existingProduct, error: productLookupError } = await findProduct();
  if (productLookupError) {
    return { error: mapRequirementError(productLookupError) };
  }

  let productId = existingProduct?.id;
  if (!productId) {
    const { data: inserted, error } = await supabase
      .from("products")
      .insert({
        school_id: input.schoolId,
        kind: input.kind,
        name: input.name,
        subject,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        const retry = await findProduct();
        productId = retry.data?.id;
        if (!productId) {
          return { error: mapRequirementError(error) };
        }
      } else {
        return { error: mapRequirementError(error) };
      }
    } else {
      productId = inserted.id;
    }
  }

  const { data: existingVariant, error: variantLookupError } = await supabase
    .from("product_variants")
    .select("id")
    .eq("school_id", input.schoolId)
    .eq("product_id", productId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (variantLookupError) {
    return { error: mapRequirementError(variantLookupError) };
  }

  if (existingVariant?.id) {
    const { error: priceError } = await supabase
      .from("product_variants")
      .update({ unit_price_amount: input.unitPrice })
      .eq("id", existingVariant.id)
      .eq("school_id", input.schoolId);
    if (priceError) {
      return { error: mapRequirementError(priceError) };
    }
    return { variantId: existingVariant.id };
  }

  const { data: variant, error: variantError } = await supabase
    .from("product_variants")
    .insert({
      school_id: input.schoolId,
      product_id: productId,
      unit_price_amount: input.unitPrice,
      currency: "INR",
    })
    .select("id")
    .single();

  if (variantError || !variant) {
    return { error: mapRequirementError(variantError ?? { message: "Could not save item." }) };
  }

  return { variantId: variant.id };
}

export async function createRequirementAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { schoolId } = await requireSchoolAdmin();
  const parsed = requirementCreateSchema.safeParse({
    academicYearId: formData.get("academicYearId"),
    classId: formData.get("classId"),
    kind: formData.get("kind"),
    name: formData.get("name"),
    subject: formData.get("subject"),
    quantity: formData.get("quantity"),
    unitPrice: formData.get("unitPrice"),
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid requirement." };
  }

  const supabase = await createServerSupabaseClient();
  const variant = await ensureVariant(supabase, {
    schoolId,
    kind: parsed.data.kind,
    name: parsed.data.name,
    subject: subjectValue(parsed.data.subject),
    unitPrice: parseUnitPrice(parsed.data.unitPrice),
  });
  if ("error" in variant) {
    return { error: variant.error };
  }

  const { data, error } = await supabase
    .from("school_requirements")
    .insert({
      school_id: schoolId,
      academic_year_id: parsed.data.academicYearId,
      class_id: parsed.data.classId,
      product_variant_id: variant.variantId,
      required_quantity: parsed.data.quantity,
      is_active: parsed.data.isActive ?? true,
    })
    .select("id")
    .single();

  if (error) {
    return { error: mapRequirementError(error) };
  }

  await writeAuditLog({
    schoolId,
    action: "requirement.create",
    entityType: "school_requirements",
    entityId: data.id,
  });
  revalidateRequirementPaths();
  return { success: "Requirement added." };
}

export async function updateRequirementAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { schoolId } = await requireSchoolAdmin();
  const parsed = requirementUpdateSchema.safeParse({
    id: formData.get("id"),
    academicYearId: formData.get("academicYearId"),
    classId: formData.get("classId"),
    kind: formData.get("kind"),
    name: formData.get("name"),
    subject: formData.get("subject"),
    quantity: formData.get("quantity"),
    unitPrice: formData.get("unitPrice"),
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid requirement." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: existing, error: existingError } = await supabase
    .from("school_requirements")
    .select("id, product_variant_id")
    .eq("id", parsed.data.id)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (existingError || !existing) {
    return { error: "Requirement not found for this school." };
  }

  const variant = await ensureVariant(supabase, {
    schoolId,
    kind: parsed.data.kind,
    name: parsed.data.name,
    subject: subjectValue(parsed.data.subject),
    unitPrice: parseUnitPrice(parsed.data.unitPrice),
  });
  if ("error" in variant) {
    return { error: variant.error };
  }

  const { error } = await supabase
    .from("school_requirements")
    .update({
      academic_year_id: parsed.data.academicYearId,
      class_id: parsed.data.classId,
      product_variant_id: variant.variantId,
      required_quantity: parsed.data.quantity,
      is_active: parsed.data.isActive ?? false,
    })
    .eq("id", parsed.data.id)
    .eq("school_id", schoolId);

  if (error) {
    return { error: mapRequirementError(error) };
  }

  await writeAuditLog({
    schoolId,
    action: "requirement.update",
    entityType: "school_requirements",
    entityId: parsed.data.id,
  });
  revalidateRequirementPaths();
  return { success: "Requirement updated." };
}

export async function deleteRequirementAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { schoolId } = await requireSchoolAdmin();
  const parsed = requirementIdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) {
    return { error: "Invalid requirement." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("school_requirements")
    .delete()
    .eq("id", parsed.data.id)
    .eq("school_id", schoolId);

  if (error) {
    return { error: mapRequirementError(error) };
  }

  await writeAuditLog({
    schoolId,
    action: "requirement.delete",
    entityType: "school_requirements",
    entityId: parsed.data.id,
  });
  revalidateRequirementPaths();
  return { success: "Requirement removed." };
}

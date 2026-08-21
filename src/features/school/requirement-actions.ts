"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { requireSchoolAdmin } from "@/lib/auth/workspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_FILE_SIZE,
  productImageDeleteSchema,
  productImageUploadSchema,
  requirementCreateSchema,
  requirementIdSchema,
  requirementUpdateSchema,
} from "@/lib/validations/requirements";
import type { ActionState } from "@/features/auth/actions";

function revalidateRequirementPaths() {
  revalidatePath("/school");
  revalidatePath("/school/requirements");
  revalidatePath("/school/inventory");
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

function descriptionValue(value: string | undefined): string | null {
  return value ? value : null;
}

async function ensureVariant(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  input: {
    schoolId: string;
    kind: "book" | "uniform" | "other";
    name: string;
    subject: string | null;
    description?: string | null;
    unitPrice: number | null;
  },
): Promise<{ variantId: string; productId: string } | { error: string }> {
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
        description: input.description ?? null,
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
  } else if (input.description !== undefined) {
    const { error: updateDescError } = await supabase
      .from("products")
      .update({ description: input.description })
      .eq("id", productId)
      .eq("school_id", input.schoolId);
    if (updateDescError) {
      return { error: mapRequirementError(updateDescError) };
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
    return { variantId: existingVariant.id, productId };
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

  return { variantId: variant.id, productId };
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
    description: formData.get("description"),
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
    description: descriptionValue(parsed.data.description),
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
    description: formData.get("description"),
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
    description: descriptionValue(parsed.data.description),
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

export async function uploadProductImageAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { schoolId } = await requireSchoolAdmin();
  const rawProductId = formData.get("productId");
  const isPrimary = formData.get("isPrimary") === "true" || formData.get("isPrimary") === "on";
  const altText = (formData.get("altText") as string | null)?.trim() || null;
  const file = formData.get("file");

  const parsed = productImageUploadSchema.safeParse({
    productId: rawProductId,
    isPrimary,
    altText,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid image payload." };
  }

  if (!file || !(file instanceof File) || file.size === 0) {
    return { error: "Please select an image file to upload." };
  }

  if (file.size > MAX_IMAGE_FILE_SIZE) {
    return { error: "Image size must be 5 MB or less." };
  }

  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return { error: "Unsupported image format. Please upload a JPEG, PNG, or WebP image." };
  }

  const supabase = await createServerSupabaseClient();

  // Verify product belongs to this school
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, name")
    .eq("id", parsed.data.productId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (productError || !product) {
    return { error: "Product not found for this school." };
  }

  let finalIsPrimary = parsed.data.isPrimary ?? false;

  // Check if there are any existing images for this product
  const { count: existingImageCount } = await supabase
    .from("product_images")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .eq("product_id", parsed.data.productId);

  if (!existingImageCount || existingImageCount === 0) {
    finalIsPrimary = true;
  }

  if (finalIsPrimary) {
    await supabase
      .from("product_images")
      .update({ is_primary: false })
      .eq("school_id", schoolId)
      .eq("product_id", parsed.data.productId);
  }

  const rawExt = file.name.split(".").pop()?.toLowerCase();
  const fileExt = rawExt && ["jpg", "jpeg", "png", "webp"].includes(rawExt)
    ? rawExt
    : file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";

  const uniqueId = crypto.randomUUID();
  const storagePath = `${schoolId}/${parsed.data.productId}/${uniqueId}.${fileExt}`;

  const fileBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from("product-images")
    .upload(storagePath, fileBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return { error: `Failed to upload image: ${uploadError.message}` };
  }

  const { data: insertedImage, error: dbError } = await supabase
    .from("product_images")
    .insert({
      school_id: schoolId,
      product_id: parsed.data.productId,
      storage_path: storagePath,
      is_primary: finalIsPrimary,
      alt_text: parsed.data.altText ?? null,
    })
    .select("id")
    .single();

  if (dbError || !insertedImage) {
    await supabase.storage.from("product-images").remove([storagePath]);
    return { error: dbError?.message || "Failed to record image in database." };
  }

  await writeAuditLog({
    schoolId,
    action: "product_image.upload",
    entityType: "product_images",
    entityId: insertedImage.id,
  });

  revalidateRequirementPaths();
  return { success: "Image uploaded successfully." };
}

export async function deleteProductImageAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { schoolId } = await requireSchoolAdmin();
  const parsed = productImageDeleteSchema.safeParse({
    imageId: formData.get("imageId"),
  });

  if (!parsed.success) {
    return { error: "Invalid image ID." };
  }

  const supabase = await createServerSupabaseClient();

  const { data: image, error: findError } = await supabase
    .from("product_images")
    .select("id, storage_path, product_id, is_primary")
    .eq("id", parsed.data.imageId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (findError || !image) {
    return { error: "Image not found." };
  }

  if (image.storage_path) {
    await supabase.storage.from("product-images").remove([image.storage_path]);
  }

  const { error: deleteError } = await supabase
    .from("product_images")
    .delete()
    .eq("id", parsed.data.imageId)
    .eq("school_id", schoolId);

  if (deleteError) {
    return { error: deleteError.message };
  }

  if (image.is_primary) {
    const { data: nextImage } = await supabase
      .from("product_images")
      .select("id")
      .eq("school_id", schoolId)
      .eq("product_id", image.product_id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextImage) {
      await supabase
        .from("product_images")
        .update({ is_primary: true })
        .eq("id", nextImage.id)
        .eq("school_id", schoolId);
    }
  }

  await writeAuditLog({
    schoolId,
    action: "product_image.delete",
    entityType: "product_images",
    entityId: parsed.data.imageId,
  });

  revalidateRequirementPaths();
  return { success: "Image deleted successfully." };
}


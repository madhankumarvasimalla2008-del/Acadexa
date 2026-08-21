import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type AvailabilityStatus = "in_stock" | "low_stock" | "out_of_stock";

export type ProductImage = {
  id: string;
  storage_path: string;
  is_primary: boolean;
  sort_order: number;
  alt_text: string | null;
};

export type CatalogProduct = {
  id: string;
  name: string;
  kind: "book" | "uniform" | "other";
  subject: string | null;
  description: string | null;
  primaryImageUrl: string | null;
  availability: AvailabilityStatus;
  variantId: string | null;
};

export type ProductDetail = {
  id: string;
  name: string;
  kind: "book" | "uniform" | "other";
  subject: string | null;
  description: string | null;
  images: Array<{ url: string; alt: string | null; isPrimary: boolean }>;
  variants: Array<{
    id: string;
    unit_price_amount: number | string | null;
    sku: string | null;
    size: string | null;
    edition: string | null;
    availability: AvailabilityStatus;
  }>;
  packs: Array<{
    id: string;
    name: string;
    pack_type: string;
    price_amount: number | string;
  }>;
};

export type RequirementItem = {
  id: string;
  required_quantity: number;
  productName: string;
  productKind: "book" | "uniform" | "other";
  subject: string | null;
  unitPrice: number | string | null;
  primaryImageUrl: string | null;
  availability: AvailabilityStatus;
  productId: string;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function asRelated<T extends object>(value: unknown): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null;
  return value as T;
}

function supabaseStorageUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return "";
  return `${base}/storage/v1/object/public/product-images/${path}`;
}

export async function getVariantAvailability(
  schoolId: string,
  variantId: string,
): Promise<AvailabilityStatus> {
  const admin = createServiceRoleClient();
  const { data } = await admin.rpc("product_variant_availability", {
    p_school_id: schoolId,
    p_variant_id: variantId,
  });
  if (!data) return "out_of_stock";
  return data as AvailabilityStatus;
}

async function getVariantAvailabilityBatch(
  schoolId: string,
  variantIds: string[],
): Promise<Map<string, AvailabilityStatus>> {
  if (variantIds.length === 0) return new Map();
  const admin = createServiceRoleClient();
  const results = await Promise.all(
    variantIds.map(async (vid) => {
      const { data } = await admin.rpc("product_variant_availability", {
        p_school_id: schoolId,
        p_variant_id: vid,
      });
      return [vid, (data as AvailabilityStatus) ?? "out_of_stock"] as const;
    }),
  );
  return new Map(results);
}

/* ------------------------------------------------------------------ */
/*  Queries                                                            */
/* ------------------------------------------------------------------ */

/**
 * Requirements for a child's current enrollment (year + class).
 * Uses the user JWT (RLS-enforced).
 */
export async function getChildRequirements(
  schoolId: string,
  academicYearId: string,
  classId: string,
): Promise<RequirementItem[]> {
  const supabase = await createServerSupabaseClient();

  const { data: requirements } = await supabase
    .from("school_requirements")
    .select(
      "id, required_quantity, product_variant_id, product_variants ( id, unit_price_amount, product_id, products ( id, name, kind, subject ) )",
    )
    .eq("school_id", schoolId)
    .eq("academic_year_id", academicYearId)
    .eq("class_id", classId)
    .eq("is_active", true);

  if (!requirements || requirements.length === 0) return [];

  type VariantRow = {
    id: string;
    unit_price_amount: number | string | null;
    product_id: string;
    products: { id: string; name: string; kind: string; subject: string | null } | Array<{ id: string; name: string; kind: string; subject: string | null }> | null;
  };

  const variantIds = requirements
    .map((r) => r.product_variant_id)
    .filter(Boolean) as string[];
  const productIds = requirements
    .map((r) => {
      const v = asRelated<VariantRow>(r.product_variants);
      return v?.product_id;
    })
    .filter(Boolean) as string[];

  const [availMap, { data: images }] = await Promise.all([
    getVariantAvailabilityBatch(schoolId, variantIds),
    productIds.length > 0
      ? supabase
          .from("product_images")
          .select("product_id, storage_path, alt_text")
          .eq("school_id", schoolId)
          .in("product_id", productIds)
          .eq("is_primary", true)
      : Promise.resolve({ data: [] as { product_id: string; storage_path: string; alt_text: string | null }[] }),
  ]);

  const primaryByProduct = new Map(
    (images ?? []).map((img) => [img.product_id, img]),
  );

  return requirements.map((r) => {
    const variant = asRelated<VariantRow>(r.product_variants);
    const product = asRelated<{ id: string; name: string; kind: string; subject: string | null }>(variant?.products);
    const img = product ? primaryByProduct.get(product.id) : null;
    return {
      id: r.id as string,
      required_quantity: r.required_quantity as number,
      productName: product?.name ?? "Item",
      productKind: (product?.kind ?? "other") as "book" | "uniform" | "other",
      subject: product?.subject ?? null,
      unitPrice: variant?.unit_price_amount ?? null,
      primaryImageUrl: img ? supabaseStorageUrl(img.storage_path) : null,
      availability: availMap.get(r.product_variant_id as string) ?? "out_of_stock",
      productId: product?.id ?? "",
    };
  });
}

/**
 * All products visible to this parent's child (via requirement/enrollment chain).
 * Uses the user JWT — RLS on products enforces access.
 */
export async function getCatalogProducts(
  schoolId: string,
  academicYearId: string,
  classId: string,
): Promise<CatalogProduct[]> {
  const supabase = await createServerSupabaseClient();

  const { data: requirements } = await supabase
    .from("school_requirements")
    .select(
      "product_variant_id, product_variants ( id, product_id, products ( id, name, kind, subject, description ) )",
    )
    .eq("school_id", schoolId)
    .eq("academic_year_id", academicYearId)
    .eq("class_id", classId)
    .eq("is_active", true);

  if (!requirements || requirements.length === 0) return [];

  type VariantRow = {
    id: string;
    product_id: string;
    products: { id: string; name: string; kind: string; subject: string | null; description: string | null } | Array<{ id: string; name: string; kind: string; subject: string | null; description: string | null }> | null;
  };

  // Deduplicate products (multiple variants/requirements may reference the same product).
  const productMap = new Map<string, { product: { id: string; name: string; kind: string; subject: string | null; description: string | null }; variantId: string }>();
  for (const req of requirements) {
    const variant = asRelated<VariantRow>(req.product_variants);
    const product = asRelated<{ id: string; name: string; kind: string; subject: string | null; description: string | null }>(variant?.products);
    if (product && variant && !productMap.has(product.id)) {
      productMap.set(product.id, { product, variantId: variant.id });
    }
  }

  const productIds = [...productMap.keys()];
  const variantIds = [...productMap.values()].map((v) => v.variantId);

  const [availMap, { data: images }] = await Promise.all([
    getVariantAvailabilityBatch(schoolId, variantIds),
    productIds.length > 0
      ? supabase
          .from("product_images")
          .select("product_id, storage_path, alt_text")
          .eq("school_id", schoolId)
          .in("product_id", productIds)
          .eq("is_primary", true)
      : Promise.resolve({ data: [] as { product_id: string; storage_path: string; alt_text: string | null }[] }),
  ]);

  const primaryByProduct = new Map(
    (images ?? []).map((img) => [img.product_id, img]),
  );

  return [...productMap.entries()].map(([, { product, variantId }]) => {
    const img = primaryByProduct.get(product.id);
    return {
      id: product.id,
      name: product.name,
      kind: product.kind as "book" | "uniform" | "other",
      subject: product.subject,
      description: product.description,
      primaryImageUrl: img ? supabaseStorageUrl(img.storage_path) : null,
      availability: availMap.get(variantId) ?? "out_of_stock",
      variantId,
    };
  });
}

/**
 * Full product detail with all images and variant info.
 * Uses user JWT for products/variants/images; service role for availability.
 */
export async function getProductDetail(
  schoolId: string,
  productId: string,
  academicYearId: string,
  classId: string,
): Promise<ProductDetail | null> {
  const supabase = await createServerSupabaseClient();

  const [{ data: product }, { data: images }, { data: variants }, { data: packItems }] =
    await Promise.all([
      supabase
        .from("products")
        .select("id, name, kind, subject, description")
        .eq("id", productId)
        .eq("school_id", schoolId)
        .maybeSingle(),
      supabase
        .from("product_images")
        .select("id, storage_path, is_primary, sort_order, alt_text")
        .eq("product_id", productId)
        .eq("school_id", schoolId)
        .order("is_primary", { ascending: false })
        .order("sort_order", { ascending: true }),
      supabase
        .from("product_variants")
        .select("id, unit_price_amount, sku, size, edition")
        .eq("product_id", productId)
        .eq("school_id", schoolId),
      supabase
        .from("pack_items")
        .select(
          "pack_id, product_variant_id, packs ( id, name, pack_type, price_amount, is_active, academic_year_id, class_id )",
        )
        .eq("school_id", schoolId)
        .in(
          "product_variant_id",
          // We need variant IDs; fetch inline.
          (await supabase
            .from("product_variants")
            .select("id")
            .eq("product_id", productId)
            .eq("school_id", schoolId)
          ).data?.map((v) => v.id) ?? [],
        ),
    ]);

  if (!product) return null;

  type PackRow = { id: string; name: string; pack_type: string; price_amount: number | string; is_active: boolean; academic_year_id: string; class_id: string };

  const variantIds = (variants ?? []).map((v) => v.id);
  const availMap = await getVariantAvailabilityBatch(schoolId, variantIds);

  // Filter packs to those matching the child's current year+class and active.
  const seenPacks = new Set<string>();
  const matchingPacks: ProductDetail["packs"] = [];
  for (const pi of packItems ?? []) {
    const pack = asRelated<PackRow>(pi.packs);
    if (
      pack &&
      pack.is_active &&
      pack.academic_year_id === academicYearId &&
      pack.class_id === classId &&
      !seenPacks.has(pack.id)
    ) {
      seenPacks.add(pack.id);
      matchingPacks.push({
        id: pack.id,
        name: pack.name,
        pack_type: pack.pack_type,
        price_amount: pack.price_amount,
      });
    }
  }

  return {
    id: product.id,
    name: product.name,
    kind: product.kind as "book" | "uniform" | "other",
    subject: product.subject,
    description: product.description,
    images: (images ?? []).map((img) => ({
      url: supabaseStorageUrl(img.storage_path),
      alt: img.alt_text,
      isPrimary: img.is_primary,
    })),
    variants: (variants ?? []).map((v) => ({
      id: v.id,
      unit_price_amount: v.unit_price_amount,
      sku: v.sku,
      size: v.size,
      edition: v.edition,
      availability: availMap.get(v.id) ?? "out_of_stock",
    })),
    packs: matchingPacks,
  };
}

/**
 * Get primary image URLs for a set of products (batch, for pack listing).
 */
export async function getPrimaryImagesForProducts(
  schoolId: string,
  productIds: string[],
): Promise<Map<string, string>> {
  if (productIds.length === 0) return new Map();
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("product_images")
    .select("product_id, storage_path")
    .eq("school_id", schoolId)
    .in("product_id", productIds)
    .eq("is_primary", true);

  return new Map(
    (data ?? []).map((img) => [
      img.product_id,
      supabaseStorageUrl(img.storage_path),
    ]),
  );
}

/**
 * Batch availability for a set of variants (for pack listing).
 */
export async function getAvailabilityForVariants(
  schoolId: string,
  variantIds: string[],
): Promise<Map<string, AvailabilityStatus>> {
  return getVariantAvailabilityBatch(schoolId, variantIds);
}

/**
 * Availability label for display.
 */
export function availabilityLabel(status: AvailabilityStatus): string {
  switch (status) {
    case "in_stock":
      return "In Stock";
    case "low_stock":
      return "Limited Availability";
    case "out_of_stock":
      return "Out of Stock";
    default:
      return "Unavailable";
  }
}

/**
 * Availability badge color classes.
 */
export function availabilityColor(status: AvailabilityStatus): string {
  switch (status) {
    case "in_stock":
      return "text-emerald-700 bg-emerald-50 border-emerald-200";
    case "low_stock":
      return "text-amber-700 bg-amber-50 border-amber-200";
    case "out_of_stock":
      return "text-red-700 bg-red-50 border-red-200";
    default:
      return "text-zinc-500 bg-zinc-50 border-zinc-200";
  }
}

/**
 * Availability dot color for inline use.
 */
export function availabilityDot(status: AvailabilityStatus): string {
  switch (status) {
    case "in_stock":
      return "bg-emerald-500";
    case "low_stock":
      return "bg-amber-500";
    case "out_of_stock":
      return "bg-red-400";
    default:
      return "bg-zinc-400";
  }
}

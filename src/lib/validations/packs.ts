import { z } from "zod";

export const packTypeSchema = z.enum([
  "book_pack",
  "uniform_pack",
  "complete_pack",
  "custom_pack",
]);

export const packCreateSchema = z.object({
  academicYearId: z.string().uuid("Select an academic year."),
  classId: z.string().uuid("Select a class."),
  name: z.string().trim().min(1, "Enter a pack name.").max(160),
  packType: packTypeSchema,
  price: z
    .string()
    .trim()
    .refine(
      (value) => value !== "" && Number.isFinite(Number(value)) && Number(value) >= 0,
      "Pack price must be zero or more.",
    ),
  isActive: z.boolean().optional(),
});

export const packUpdateSchema = packCreateSchema.extend({
  id: z.string().uuid(),
});

export const packIdSchema = z.object({
  id: z.string().uuid(),
});

export const packItemAddSchema = z.object({
  packId: z.string().uuid(),
  requirementId: z.string().uuid("Select a requirement."),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1.").max(9999),
});

export const packItemUpdateSchema = z.object({
  id: z.string().uuid(),
  packId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1.").max(9999),
});

export const packItemIdSchema = z.object({
  id: z.string().uuid(),
  packId: z.string().uuid(),
});

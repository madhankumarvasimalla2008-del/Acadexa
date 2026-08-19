import { z } from "zod";

export const productKindSchema = z.enum(["book", "uniform", "other"]);

export const requirementCreateSchema = z.object({
  academicYearId: z.string().uuid("Select an academic year."),
  classId: z.string().uuid("Select a class."),
  kind: productKindSchema,
  name: z.string().trim().min(1, "Enter an item name.").max(160),
  subject: z.string().trim().max(80).optional().or(z.literal("")),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1.").max(9999),
  unitPrice: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine(
      (value) => !value || Number.isFinite(Number(value)) && Number(value) >= 0,
      "Unit price must be zero or more.",
    ),
  isActive: z.boolean().optional(),
});

export const requirementUpdateSchema = requirementCreateSchema.extend({
  id: z.string().uuid(),
});

export const requirementIdSchema = z.object({
  id: z.string().uuid(),
});

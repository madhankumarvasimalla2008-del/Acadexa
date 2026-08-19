import { z } from "zod";

export const inventoryMovementSchema = z.object({
  variantId: z.string().uuid("Select an inventory item."),
  reason: z.enum(["stock_in", "adjustment"]),
  quantity: z
    .string()
    .trim()
    .refine((value) => {
      const amount = Number(value);
      return value !== "" && Number.isInteger(amount) && amount !== 0;
    }, "Enter a whole number that is not zero."),
  note: z.string().trim().max(240).optional().or(z.literal("")),
});

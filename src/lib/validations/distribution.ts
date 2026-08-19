import { z } from "zod";

export const distributionStatusFilterSchema = z.enum([
  "not_distributed",
  "partial",
  "fully_distributed",
]);

export const recordDistributionSchema = z.object({
  orderId: z.string().uuid("Select a paid pack to distribute."),
  note: z.string().trim().max(240).optional().or(z.literal("")),
  items: z
    .array(
      z.object({
        orderItemId: z.string().uuid(),
        quantity: z.number().int("Enter a whole number."),
      }),
    )
    .min(1, "Select at least one item."),
});

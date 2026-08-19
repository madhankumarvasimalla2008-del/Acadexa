import { z } from "zod";

export const paymentStatusSchema = z.enum([
  "pending",
  "successful",
  "failed",
  "refunded",
]);

export const checkoutPackSchema = z.object({
  studentId: z.string().uuid(),
  packId: z.string().uuid(),
});

export const paymentStatusFilterSchema = z.enum([
  "all",
  "pending",
  "successful",
  "failed",
  "refunded",
]);

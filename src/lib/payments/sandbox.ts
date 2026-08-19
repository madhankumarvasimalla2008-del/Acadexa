import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";

export async function settleSandboxAttempt(input: {
  transactionId: string;
  orderId: string;
  schoolId: string;
  result: "successful" | "failed";
  failureReason?: string;
}) {
  const admin = createServiceRoleClient();
  const verifiedAt = new Date().toISOString();

  const { error: txError } = await admin
    .from("payment_transactions")
    .update({
      status: input.result,
      verified_at: verifiedAt,
      failure_reason: input.result === "failed" ? (input.failureReason ?? "Sandbox payment failed.") : null,
      gateway_payment_id: `sandbox_${input.transactionId}`,
    })
    .eq("id", input.transactionId)
    .eq("school_id", input.schoolId)
    .eq("status", "pending");

  if (txError) {
    return { error: txError.message };
  }

  const { error: orderError } = await admin
    .from("orders")
    .update({
      payment_status: input.result,
    })
    .eq("id", input.orderId)
    .eq("school_id", input.schoolId);

  if (orderError) {
    return { error: orderError.message };
  }

  return { error: null };
}

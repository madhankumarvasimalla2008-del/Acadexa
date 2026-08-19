import Link from "next/link";
import { z } from "zod";
import { redirect } from "next/navigation";
import AbpsOrnament from "@/components/brand/abps-ornament";
import { EmptyState } from "@/components/brand/empty-state";
import { FoundationForm } from "@/components/forms/foundation-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { failPackPaymentAction, payPackAction } from "@/features/parent/checkout-actions";
import { formatInr, packTypeLabel, paymentStatusLabel, toAmount } from "@/lib/payments/display";
import { requireParentChild } from "@/lib/auth/workspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const schoolSubmitClass =
  "bg-[#6b1d2a] text-[#f7e0a3] hover:bg-[#4a121c] focus-visible:ring-[#6b1d2a]";

type ProductInfo = { name: string };
type VariantInfo = {
  unit_price_amount: number | string | null;
  products: ProductInfo | ProductInfo[] | null;
};

function asRelated<T extends object>(value: unknown): T | null {
  if (!value) {
    return null;
  }
  if (Array.isArray(value)) {
    return (value[0] as T | undefined) ?? null;
  }
  return value as T;
}

function classLabel(name: string, section: string | null) {
  return section ? `Class ${name} · ${section}` : `Class ${name}`;
}

export default async function ParentPackCheckoutPage({
  params,
}: {
  params: Promise<{ studentId: string; packId: string }>;
}) {
  const { studentId: rawStudentId, packId: rawPackId } = await params;
  const parsedStudent = z.string().uuid().safeParse(rawStudentId);
  const parsedPack = z.string().uuid().safeParse(rawPackId);
  if (!parsedStudent.success || !parsedPack.success) {
    redirect("/unauthorized");
  }

  const { studentId, schoolId } = await requireParentChild(parsedStudent.data);
  const supabase = await createServerSupabaseClient();

  const [{ data: student }, { data: pack, error: packError }, { data: school }] = await Promise.all([
    supabase
      .from("students")
      .select("id, full_name, student_code")
      .eq("id", studentId)
      .eq("school_id", schoolId)
      .maybeSingle(),
    supabase
      .from("packs")
      .select(
        "id, name, pack_type, price_amount, is_active, academic_year_id, class_id, allows_repeat_purchase",
      )
      .eq("id", parsedPack.data)
      .eq("school_id", schoolId)
      .maybeSingle(),
    supabase.from("schools").select("id, name").eq("id", schoolId).maybeSingle(),
  ]);

  if (!student) {
    redirect("/unauthorized");
  }

  if (!pack) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {packError?.message ?? "This pack is not available for this child."}
        </p>
        <Link href={`/parent/children/${studentId}/packs`} className="text-sm text-[#6b1d2a] underline">
          Back to packs
        </Link>
      </div>
    );
  }

  const [{ data: enrollment }, { data: year }, { data: klass }, { data: items, error: itemsError }, { data: orders }] =
    await Promise.all([
      supabase
        .from("student_enrollments")
        .select("id")
        .eq("student_id", studentId)
        .eq("school_id", schoolId)
        .eq("academic_year_id", pack.academic_year_id)
        .eq("class_id", pack.class_id)
        .maybeSingle(),
      supabase
        .from("academic_years")
        .select("id, name")
        .eq("id", pack.academic_year_id)
        .eq("school_id", schoolId)
        .maybeSingle(),
      supabase
        .from("classes")
        .select("id, name, section")
        .eq("id", pack.class_id)
        .eq("school_id", schoolId)
        .maybeSingle(),
      supabase
        .from("pack_items")
        .select(
          "id, quantity, product_variants ( unit_price_amount, products ( name ) )",
        )
        .eq("pack_id", pack.id)
        .eq("school_id", schoolId),
      supabase
        .from("orders")
        .select("id, payment_status, amount_snapshot, created_at")
        .eq("student_id", studentId)
        .eq("pack_id", pack.id)
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false }),
    ]);

  const error = itemsError?.message;
  const lines = (items ?? []).map((item) => {
    const variant = asRelated<VariantInfo>(item.product_variants);
    const product = asRelated<ProductInfo>(variant?.products);
    const unit = toAmount(variant?.unit_price_amount);
    return {
      id: item.id as string,
      name: product?.name ?? "Item",
      quantity: item.quantity as number,
      unit,
      line: unit * (item.quantity as number),
    };
  });
  const latest = orders?.[0] ?? null;
  const paid = latest?.payment_status === "successful" && !pack.allows_repeat_purchase;
  const canPay = Boolean(enrollment && pack.is_active && !paid);
  const retry = latest?.payment_status === "failed";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="border-b border-[#c9a227]/30 pb-5">
        <p className="acadexa-kicker text-[#6b1d2a]">Checkout</p>
        <h1 className="acadexa-display mt-2 text-2xl text-[#6b1d2a] sm:text-3xl">{pack.name}</h1>
        <AbpsOrnament className="mt-2 h-3 w-32" />
        <p className="acadexa-lede mt-3 text-zinc-600">
          Review this child’s pack, then pay. The amount is taken from the school pack price.
        </p>
        <Link href={`/parent/children/${studentId}/packs`} className="mt-3 inline-block text-sm text-[#6b1d2a] underline">
          Back to packs
        </Link>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      {!enrollment ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          This pack belongs to a year and class this child is not enrolled in.
        </p>
      ) : null}

      <Card className="acadexa-card-premium border-[#c9a227]/30">
        <CardHeader className="border-[#c9a227]/20">
          <CardTitle>Checkout summary</CardTitle>
          <CardDescription>
            {packTypeLabel(pack.pack_type)}
            {latest ? ` · ${paymentStatusLabel(latest.payment_status)}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-zinc-500">Student</dt>
              <dd className="font-medium text-[#6b1d2a]">
                {student.full_name}
                <span className="block font-normal text-zinc-500">{student.student_code}</span>
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">School</dt>
              <dd className="font-medium text-[#6b1d2a]">{school?.name ?? "School"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Academic year</dt>
              <dd className="font-medium text-[#6b1d2a]">{year?.name ?? "Year"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Class</dt>
              <dd className="font-medium text-[#6b1d2a]">
                {klass ? classLabel(klass.name, klass.section) : "Class"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Pack</dt>
              <dd className="font-medium text-[#6b1d2a]">{pack.name}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Total</dt>
              <dd className="font-medium text-[#6b1d2a]">{formatInr(toAmount(pack.price_amount))}</dd>
            </div>
          </dl>

          <div>
            <p className="font-medium text-[#6b1d2a]">Included items</p>
            {lines.length === 0 ? (
              <EmptyState
                kind="packs"
                title="No items in this pack"
                description="The school has not added requirements to this pack yet."
              />
            ) : (
              <ul className="mt-2 divide-y divide-[#c9a227]/20 rounded-lg border border-[#c9a227]/20">
                {lines.map((line) => (
                  <li key={line.id} className="flex items-start justify-between gap-3 px-3 py-2">
                    <span>
                      {line.name}
                      <span className="block text-zinc-500">Qty {line.quantity}</span>
                    </span>
                    <span className="text-right">
                      {formatInr(line.unit)} each
                      <span className="block font-medium">{formatInr(line.line)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="acadexa-card-premium border-[#c9a227]/30">
        <CardHeader className="border-[#c9a227]/20">
          <CardTitle>{retry ? "Retry payment" : "Pay now"}</CardTitle>
          <CardDescription>
            Checkout uses a server-side sandbox provider until the live gateway is connected.
            Amounts are not taken from the browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {paid ? (
            <p className="text-sm text-teal-800">This pack is already paid for this student.</p>
          ) : null}
          {canPay ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <FoundationForm
                action={payPackAction}
                submitLabel={retry ? "Retry payment" : "Pay pack"}
                submitClassName={schoolSubmitClass}
              >
                <input type="hidden" name="studentId" value={studentId} />
                <input type="hidden" name="packId" value={pack.id} />
              </FoundationForm>
              <FoundationForm
                action={failPackPaymentAction}
                submitLabel="Simulate failed payment"
                submitVariant="outline"
              >
                <input type="hidden" name="studentId" value={studentId} />
                <input type="hidden" name="packId" value={pack.id} />
              </FoundationForm>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

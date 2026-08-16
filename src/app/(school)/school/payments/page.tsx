import { ComingSoon } from "@/components/school/coming-soon";
import { requireSchoolAdmin } from "@/lib/auth/workspace";

export default async function PaymentsPage() {
  await requireSchoolAdmin();
  return <ComingSoon title="Payments" />;
}

import { ComingSoon } from "@/components/school/coming-soon";
import { requireSchoolAdmin } from "@/lib/auth/workspace";

export default async function DistributionPage() {
  await requireSchoolAdmin();
  return <ComingSoon title="Distribution" />;
}

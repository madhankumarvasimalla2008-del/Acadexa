import { ComingSoon } from "@/components/school/coming-soon";
import { requireSchoolAdmin } from "@/lib/auth/workspace";

export default async function RequirementsPage() {
  await requireSchoolAdmin();
  return <ComingSoon title="Requirements" />;
}

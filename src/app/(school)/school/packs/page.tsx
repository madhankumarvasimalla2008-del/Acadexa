import { ComingSoon } from "@/components/school/coming-soon";
import { requireSchoolAdmin } from "@/lib/auth/workspace";

export default async function PacksPage() {
  await requireSchoolAdmin();
  return <ComingSoon title="Packs" />;
}

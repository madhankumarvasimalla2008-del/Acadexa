import type { ReactNode } from "react";
import { requireSuperAdmin } from "@/lib/auth/workspace";
import { availableWorkspaces } from "@/lib/auth/workspaces";
import { PlatformShell } from "@/components/platform/platform-shell";

export const dynamic = "force-dynamic";

export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const context = await requireSuperAdmin();

  return (
    <PlatformShell
      adminName={context.profile?.full_name ?? ""}
      adminEmail={context.email}
      workspaces={availableWorkspaces(context)}
    >
      {children}
    </PlatformShell>
  );
}

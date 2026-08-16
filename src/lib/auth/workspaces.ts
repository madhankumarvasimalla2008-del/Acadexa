import type { AuthContext, WorkspaceKind } from "@/types/auth";

export function availableWorkspaces(context: AuthContext): WorkspaceKind[] {
  const workspaces: WorkspaceKind[] = [];
  if (context.isSuperAdmin) {
    workspaces.push("platform");
  }
  if (context.memberships.some((membership) => membership.role === "school_admin")) {
    workspaces.push("school");
  }
  if (
    context.memberships.some((membership) =>
      ["school_admin", "distribution_staff"].includes(membership.role),
    )
  ) {
    workspaces.push("desk");
  }
  if (
    context.acceptedParentLinks.length > 0 ||
    context.pendingParentInvites.length > 0
  ) {
    workspaces.push("parent");
  }
  return workspaces;
}

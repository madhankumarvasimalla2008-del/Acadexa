import Link from "next/link";
import { logoutAction } from "@/features/auth/actions";
import { setActiveSchoolAction } from "@/features/auth/actions";
import type { AuthContext } from "@/types/auth";
import { Button } from "@/components/ui/button";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import { availableWorkspaces } from "@/lib/auth/workspaces";

export function AppHeader({
  context,
  activeSchoolId,
}: {
  context: AuthContext;
  activeSchoolId?: string | null;
}) {
  const schools = [
    ...new Map(
      context.memberships.map((m) => [
        m.school_id,
        m.schools?.name ?? m.school_id,
      ]),
    ).entries(),
  ];
  const workspaces = availableWorkspaces(context);

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/home" className="text-lg font-semibold tracking-tight text-teal-900">
            Acadexa
          </Link>
          <p className="text-xs text-zinc-500">Phase 0 foundation</p>
        </div>
        <nav className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
          <WorkspaceSwitcher workspaces={workspaces} />
          {schools.length > 1
            ? schools.map(([id, name]) => (
                <form key={id} action={setActiveSchoolAction.bind(null, id)}>
                  <Button
                    type="submit"
                    variant={id === activeSchoolId ? "default" : "outline"}
                    size="sm"
                  >
                    {name}
                  </Button>
                </form>
              ))
            : null}
          <span className="max-w-full truncate text-zinc-500">{context.email}</span>
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </nav>
      </div>
    </header>
  );
}

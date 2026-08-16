"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { WorkspaceKind } from "@/types/auth";
import { cn } from "@/lib/utils";

const WORKSPACE_ITEMS: { kind: WorkspaceKind; href: string; label: string }[] = [
  { kind: "platform", href: "/platform", label: "Platform" },
  { kind: "school", href: "/school", label: "School" },
  { kind: "desk", href: "/desk", label: "Desk" },
  { kind: "parent", href: "/parent", label: "Parent" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function WorkspaceSwitcher({
  workspaces,
  variant = "inline",
  onNavigate,
}: {
  workspaces: WorkspaceKind[];
  variant?: "inline" | "stack";
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const items = WORKSPACE_ITEMS.filter((item) => workspaces.includes(item.kind));

  if (items.length < 2) {
    return null;
  }

  return (
    <nav
      aria-label="Switch workspace"
      className={cn(
        variant === "inline" ? "flex flex-wrap items-center gap-1" : "flex flex-col gap-0.5",
      )}
    >
      {variant === "stack" ? (
        <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Workspace
        </p>
      ) : null}
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.kind}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md text-sm",
              variant === "inline" ? "px-2 py-1" : "px-3 py-2",
              active
                ? "bg-zinc-100 font-medium text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function ParentNav({
  selectedStudentId,
  onNavigate,
}: {
  selectedStudentId: string | null;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const childHomeHref = selectedStudentId
    ? `/parent/children/${selectedStudentId}`
    : null;

  const items = [
    { href: "/parent", label: "Children", exact: true },
    ...(childHomeHref
      ? [
          { href: childHomeHref, label: "Child home", exact: true },
          { href: `${childHomeHref}/packs`, label: "Packs", exact: false },
        ]
      : []),
  ];

  return (
    <nav aria-label="Parent workspace" className="flex flex-col gap-0.5">
      {items.map((item) => {
        const exact = "exact" in item && item.exact;
        const active = exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-2 text-sm",
              active ? "bg-teal-800 text-white" : "text-zinc-700 hover:bg-zinc-100",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

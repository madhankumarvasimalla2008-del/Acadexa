"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export const PLATFORM_NAV = [
  { href: "/platform", label: "Dashboard", exact: true },
  { href: "/platform/schools", label: "Schools" },
  { href: "/platform/admins", label: "School admins" },
  { href: "/platform/audit", label: "Audit" },
] as const;

export function PlatformNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Platform admin" className="flex flex-col gap-0.5">
      {PLATFORM_NAV.map((item) => {
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

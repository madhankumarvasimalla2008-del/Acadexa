"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export const SCHOOL_NAV = [
  { href: "/school", label: "Dashboard", exact: true },
  { href: "/school/years", label: "Academic Years" },
  { href: "/school/classes", label: "Classes" },
  { href: "/school/students", label: "Students" },
  { href: "/school/parents", label: "Parents" },
  { href: "/school/requirements", label: "Requirements", soon: true },
  { href: "/school/packs", label: "Packs", soon: true },
  { href: "/school/inventory", label: "Inventory", soon: true },
  { href: "/school/payments", label: "Payments", soon: true },
  { href: "/school/distribution", label: "Distribution", soon: true },
  { href: "/school/reports", label: "Reports", soon: true },
] as const;

export function SchoolNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="School admin" className="flex flex-col gap-0.5">
      {SCHOOL_NAV.map((item) => {
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
              "flex items-center justify-between rounded-md px-3 py-2 text-sm",
              active
                ? "bg-teal-800 text-white"
                : "text-zinc-700 hover:bg-zinc-100",
            )}
          >
            <span>{item.label}</span>
            {"soon" in item && item.soon ? (
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                  active ? "bg-teal-700 text-teal-50" : "bg-zinc-100 text-zinc-500",
                )}
              >
                Later
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

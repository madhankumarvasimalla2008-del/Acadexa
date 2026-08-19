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
  { href: "/school/requirements", label: "Requirements" },
  { href: "/school/packs", label: "Packs" },
  { href: "/school/inventory", label: "Inventory" },
  { href: "/school/payments", label: "Payments" },
  { href: "/school/distribution", label: "Distribution" },
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
              "flex items-center justify-between rounded-md px-3 py-2 text-sm transition-[color,background-color,transform] duration-200 ease-out motion-reduce:transform-none motion-reduce:transition-none",
              active
                ? "bg-[#c9a227] font-medium text-[#6b1d2a]"
                : "text-white/90 hover:translate-x-0.5 hover:bg-white/10 hover:text-white",
            )}
          >
            <span>{item.label}</span>
            {"soon" in item && item.soon ? (
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                  active ? "bg-[#6b1d2a] text-[#f7e0a3]" : "bg-white/10 text-[#f7e0a3]",
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

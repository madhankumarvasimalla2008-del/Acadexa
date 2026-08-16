"use client";

import { useState } from "react";
import Link from "next/link";
import { logoutAction, setActiveSchoolAction } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { SchoolNav } from "@/components/school/school-nav";

type SchoolOption = { id: string; name: string };

export function SchoolShell({
  schoolName,
  academicYearName,
  adminName,
  adminEmail,
  activeSchoolId,
  schools,
  children,
}: {
  schoolName: string;
  academicYearName: string | null;
  adminName: string;
  adminEmail: string | null;
  activeSchoolId: string;
  schools: SchoolOption[];
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const adminLabel = adminName.trim() || adminEmail || "School Admin";

  return (
    <div className="min-h-screen bg-zinc-50">
      <a
        href="#school-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white">
        <div className="flex items-center gap-3 px-4 py-3 lg:px-6">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 text-zinc-700 lg:hidden"
            aria-expanded={menuOpen}
            aria-controls="school-sidebar"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="sr-only">{menuOpen ? "Close menu" : "Open menu"}</span>
            <span aria-hidden className="text-lg leading-none">
              {menuOpen ? "×" : "☰"}
            </span>
          </button>
          <div className="min-w-0 flex-1">
            <Link href="/school" className="text-lg font-semibold tracking-tight text-teal-900">
              Acadexa
            </Link>
            <p className="truncate text-sm text-zinc-600">
              {schoolName}
              {academicYearName ? ` · ${academicYearName}` : " · No current academic year"}
            </p>
          </div>
          <div className="hidden min-w-0 text-right sm:block">
            <p className="truncate text-sm font-medium text-zinc-800">{adminLabel}</p>
            {adminEmail && adminName.trim() ? (
              <p className="truncate text-xs text-zinc-500">{adminEmail}</p>
            ) : null}
          </div>
          {schools.length > 1
            ? schools.map((school) => (
                <form key={school.id} action={setActiveSchoolAction.bind(null, school.id)}>
                  <Button
                    type="submit"
                    variant={school.id === activeSchoolId ? "default" : "outline"}
                    size="sm"
                    className="hidden md:inline-flex"
                  >
                    {school.name}
                  </Button>
                </form>
              ))
            : null}
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm">
              Logout
            </Button>
          </form>
        </div>
      </header>
      <div className="lg:flex">
        {menuOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-20 bg-zinc-900/30 lg:hidden"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
        ) : null}
        <aside
          id="school-sidebar"
          className={`fixed inset-y-0 left-0 z-20 w-64 border-r border-zinc-200 bg-white px-3 py-4 pt-20 lg:static lg:z-0 lg:block lg:min-h-[calc(100vh-57px)] lg:w-60 lg:pt-4 ${
            menuOpen ? "block" : "hidden lg:block"
          }`}
        >
          <SchoolNav onNavigate={() => setMenuOpen(false)} />
        </aside>
        <main id="school-main" className="min-w-0 flex-1 px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

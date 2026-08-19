"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { logoutAction, setActiveSchoolAction } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { SchoolNav } from "@/components/school/school-nav";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import type { WorkspaceKind } from "@/types/auth";

type SchoolOption = { id: string; name: string };

export function SchoolShell({
  schoolName,
  shortName,
  academicYearName,
  adminName,
  adminEmail,
  activeSchoolId,
  schools,
  workspaces,
  children,
}: {
  schoolName: string;
  shortName: string | null;
  academicYearName: string | null;
  adminName: string;
  adminEmail: string | null;
  activeSchoolId: string;
  schools: SchoolOption[];
  workspaces: WorkspaceKind[];
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const adminLabel = adminName.trim() || adminEmail || "School Admin";

  return (
    <div className="acadexa-surface relative min-h-screen overflow-x-hidden">
      <div className="acadexa-pattern-drift" aria-hidden />
      <a
        href="#school-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>
      <header className="acadexa-header-pattern relative z-30 sticky top-0 border-b-2 border-[#c9a227] text-white">
        <div className="flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3 lg:px-6">
          <button
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#c9a227]/70 text-white lg:hidden"
            aria-expanded={menuOpen}
            aria-controls="school-sidebar"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="sr-only">{menuOpen ? "Close menu" : "Open menu"}</span>
            <span aria-hidden className="text-lg leading-none">
              {menuOpen ? "×" : "☰"}
            </span>
          </button>
          <Link href="/school" className="relative block h-11 w-10 shrink-0 sm:h-14 sm:w-12">
            <Image
              src="/school-logo.png"
              alt={schoolName}
              fill
              sizes="48px"
              className="object-contain"
              priority
            />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-tight text-white sm:text-base lg:text-lg">
              {schoolName}
            </p>
            {shortName ? (
              <p className="truncate text-xs font-medium tracking-[0.18em] text-[#f7e0a3]">
                {shortName}
              </p>
            ) : null}
            <p className="hidden truncate text-xs text-white/75 sm:block">
              {academicYearName ? academicYearName : "No current academic year"}
            </p>
          </div>
          <div className="hidden min-w-0 text-right sm:block">
            <p className="truncate text-sm font-medium text-white">{adminLabel}</p>
            {adminEmail && adminName.trim() ? (
              <p className="truncate text-xs text-[#f7e0a3]/90">{adminEmail}</p>
            ) : null}
          </div>
          <div className="hidden rounded-md bg-white/95 px-1 py-0.5 lg:block">
            <WorkspaceSwitcher workspaces={workspaces} />
          </div>
          {schools.length > 1
            ? schools.map((school) => (
                <form key={school.id} action={setActiveSchoolAction.bind(null, school.id)}>
                  <Button
                    type="submit"
                    variant={school.id === activeSchoolId ? "default" : "outline"}
                    size="sm"
                    className={
                      school.id === activeSchoolId
                        ? "hidden bg-[#c9a227] text-[#6b1d2a] hover:bg-[#d4af37] md:inline-flex"
                        : "hidden border-[#f7e0a3] bg-transparent text-white hover:bg-white/10 md:inline-flex"
                    }
                  >
                    {school.name}
                  </Button>
                </form>
              ))
            : null}
          <form action={logoutAction}>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="border-[#f7e0a3] bg-transparent px-2.5 text-white hover:bg-white/10 sm:px-3"
            >
              Logout
            </Button>
          </form>
        </div>
      </header>
      <div className="relative z-10 lg:flex">
        {menuOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-[#6b1d2a]/40 lg:hidden"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
        ) : null}
        <aside
          id="school-sidebar"
          className={`fixed inset-y-0 left-0 z-40 w-[min(16.5rem,85vw)] overflow-y-auto border-r border-[#c9a227]/40 bg-[#6b1d2a] px-3 py-4 pt-20 lg:static lg:z-0 lg:block lg:min-h-[calc(100vh-73px)] lg:w-60 lg:pt-4 ${
            menuOpen ? "block" : "hidden lg:block"
          }`}
        >
          <SchoolNav onNavigate={() => setMenuOpen(false)} />
          <div className="mt-6 rounded-md bg-white/95 p-2 lg:hidden">
            <WorkspaceSwitcher
              workspaces={workspaces}
              variant="stack"
              onNavigate={() => setMenuOpen(false)}
            />
          </div>
        </aside>
        <main
          id="school-main"
          className="acadexa-anim-page min-w-0 flex-1 px-3 py-5 sm:px-5 sm:py-6 lg:px-8 lg:py-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction, setActiveStudentAction } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { ParentNav } from "@/components/parent/parent-nav";

export type ParentChildOption = {
  id: string;
  fullName: string;
  studentCode: string;
  schoolName: string;
};

export function ParentShell({
  parentName,
  parentEmail,
  childrenList,
  activeStudentId,
  showPlatform,
  showSchool,
  showDesk,
  children,
}: {
  parentName: string;
  parentEmail: string | null;
  childrenList: ParentChildOption[];
  activeStudentId: string | null;
  showPlatform: boolean;
  showSchool: boolean;
  showDesk: boolean;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const fromPath = pathname.match(/^\/parent\/children\/([^/]+)/)?.[1];
  const selectedId =
    fromPath && childrenList.some((child) => child.id === fromPath)
      ? fromPath
      : activeStudentId;
  const selected = childrenList.find((child) => child.id === selectedId) ?? null;
  const parentLabel = parentName.trim() || parentEmail || "Parent";

  return (
    <div className="min-h-screen bg-zinc-50">
      <a
        href="#parent-main"
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
            aria-controls="parent-sidebar"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="sr-only">{menuOpen ? "Close menu" : "Open menu"}</span>
            <span aria-hidden className="text-lg leading-none">
              {menuOpen ? "×" : "☰"}
            </span>
          </button>
          <div className="min-w-0 flex-1">
            <Link href="/parent" className="text-lg font-semibold tracking-tight text-teal-900">
              Acadexa
            </Link>
            <p className="truncate text-sm text-zinc-600">
              {selected
                ? `${selected.fullName} · ${selected.schoolName}`
                : "Parent workspace"}
            </p>
          </div>
          <div className="hidden min-w-0 text-right sm:block">
            <p className="truncate text-sm font-medium text-zinc-800">{parentLabel}</p>
            {parentEmail && parentName.trim() ? (
              <p className="truncate text-xs text-zinc-500">{parentEmail}</p>
            ) : null}
          </div>
          {showPlatform ? (
            <Link
              href="/platform"
              className="hidden text-sm text-zinc-600 hover:text-zinc-900 md:inline"
            >
              Platform
            </Link>
          ) : null}
          {showSchool ? (
            <Link
              href="/school"
              className="hidden text-sm text-zinc-600 hover:text-zinc-900 md:inline"
            >
              School
            </Link>
          ) : null}
          {showDesk ? (
            <Link
              href="/desk"
              className="hidden text-sm text-zinc-600 hover:text-zinc-900 md:inline"
            >
              Desk
            </Link>
          ) : null}
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
          id="parent-sidebar"
          className={`fixed inset-y-0 left-0 z-20 w-64 border-r border-zinc-200 bg-white px-3 py-4 pt-20 lg:static lg:z-0 lg:block lg:min-h-[calc(100vh-57px)] lg:w-60 lg:pt-4 ${
            menuOpen ? "block" : "hidden lg:block"
          }`}
        >
          <ParentNav
            selectedStudentId={selectedId}
            onNavigate={() => setMenuOpen(false)}
          />
          {childrenList.length > 1 ? (
            <div className="mt-6">
              <p className="px-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                Switch child
              </p>
              <div className="mt-2 flex flex-col gap-1">
                {childrenList.map((child) => (
                  <form key={child.id} action={setActiveStudentAction.bind(null, child.id)}>
                    <Button
                      type="submit"
                      variant={child.id === selectedId ? "default" : "ghost"}
                      size="sm"
                      className="w-full justify-start"
                    >
                      {child.fullName}
                    </Button>
                  </form>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
        <main id="parent-main" className="min-w-0 flex-1 px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

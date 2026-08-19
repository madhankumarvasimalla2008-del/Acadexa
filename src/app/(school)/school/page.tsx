import Image from "next/image";
import Link from "next/link";
import {
  BookOpen,
  CalendarDays,
  GraduationCap,
  Mail,
  Plus,
  School,
  Users,
} from "lucide-react";
import { AbpsHeroArt } from "@/components/brand/abps-hero-art";
import AbpsOrnament from "@/components/brand/abps-ornament";
import { AnimatedCounter } from "@/components/brand/animated-counter";
import { EmptyState } from "@/components/brand/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSchoolAdmin } from "@/lib/auth/workspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function formatActivity(action: string, entityType: string, createdAt: string) {
  const when = new Date(createdAt).toLocaleString();
  return `${action.replaceAll("_", " ")} · ${entityType.replaceAll("_", " ")} · ${when}`;
}

export default async function SchoolDashboardPage() {
  const { schoolId, context } = await requireSchoolAdmin();
  const supabase = await createServerSupabaseClient();

  const [
    studentsCount,
    classesCount,
    pendingCount,
    acceptedParents,
    currentYear,
    activity,
  ] = await Promise.all([
    supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId),
    supabase
      .from("classes")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId),
    supabase
      .from("parent_students")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("status", "invited"),
    supabase
      .from("parent_students")
      .select("parent_id")
      .eq("school_id", schoolId)
      .eq("status", "accepted")
      .not("parent_id", "is", null),
    supabase
      .from("academic_years")
      .select("name")
      .eq("school_id", schoolId)
      .eq("is_current", true)
      .maybeSingle(),
    supabase
      .from("audit_logs")
      .select("id, action, entity_type, created_at")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const parentIds = new Set(
    (acceptedParents.data ?? [])
      .map((row) => row.parent_id)
      .filter((id): id is string => Boolean(id)),
  );

  const schoolName =
    context.memberships.find((membership) => membership.school_id === schoolId)?.schools
      ?.name ?? "School";

  const cards = [
    {
      label: "Total Students",
      value: studentsCount.count ?? 0,
      icon: GraduationCap,
    },
    {
      label: "Total Classes",
      value: classesCount.count ?? 0,
      icon: School,
    },
    {
      label: "Total Parents",
      value: parentIds.size,
      icon: Users,
    },
    {
      label: "Pending Parent Invitations",
      value: pendingCount.count ?? 0,
      icon: Mail,
    },
    {
      label: "Current Academic Year",
      value: currentYear.data?.name ?? "Not set",
      icon: CalendarDays,
    },
  ];

  const quickActions = [
    {
      href: "/school/students",
      label: "Add Student",
      description: "Create a student record",
      icon: Plus,
    },
    {
      href: "/school/classes",
      label: "Add Class",
      description: "Set up a class section",
      icon: School,
    },
    {
      href: "/school/parents",
      label: "Invite Parent",
      description: "Send a school-controlled invite",
      icon: Mail,
    },
    {
      href: "/school/requirements",
      label: "Manage Requirements",
      description: "Books, uniforms, and packs",
      icon: BookOpen,
    },
  ];

  const logs = activity.data ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-7 sm:space-y-10">
      <section
        aria-label="Welcome"
        className="acadexa-anim-fade-up relative overflow-hidden rounded-2xl border border-[#c9a227]/60 bg-gradient-to-br from-[#4a121c] via-[#6b1d2a] to-[#8a2a3a] shadow-[0_22px_50px_-28px_rgb(107_29_42_/_0.85)]"
      >
        <div className="acadexa-hero-light" />
        <div className="pointer-events-none absolute -right-8 bottom-0 h-48 w-48 rounded-full bg-black/20 blur-3xl" />
        <div className="acadexa-hero-pattern pointer-events-none absolute inset-0 opacity-20" />
        <AbpsHeroArt />
        <div className="acadexa-hero-sheen" />
        <div className="relative z-10 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-8 sm:p-8 lg:p-9">
          <div className="acadexa-glass-hero relative h-16 w-16 shrink-0 rounded-2xl p-2 ring-1 ring-[#c9a227]/45 sm:h-[5.25rem] sm:w-[5.25rem]">
            <Image
              src="/school-logo.png"
              alt={schoolName}
              fill
              sizes="84px"
              className="object-contain p-2"
              priority
            />
          </div>
          <div className="min-w-0">
            <p className="acadexa-kicker text-[#f7e0a3]">Welcome</p>
            <h1 className="acadexa-display mt-2 text-[1.65rem] text-white sm:text-3xl lg:text-[2.15rem]">
              {schoolName}
            </h1>
            <AbpsOrnament className="mt-2.5 h-3.5 w-36 brightness-125" />
            <p className="acadexa-lede mt-3 max-w-2xl text-white/80">
              Overview for this school. Counts are limited to your school by access
              policies.
            </p>
          </div>
        </div>
        <div className="relative z-10 h-1.5 bg-gradient-to-r from-[#c9a227] via-[#f7e0a3] to-[#c9a227]" />
      </section>

      <section aria-label="Overview">
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-5 xl:grid-cols-5">
          {cards.map((card, index) => {
            const Icon = card.icon;
            const delay =
              index === 0
                ? "acadexa-delay-1"
                : index === 1
                  ? "acadexa-delay-2"
                  : index === 2
                    ? "acadexa-delay-3"
                    : index === 3
                      ? "acadexa-delay-4"
                      : "acadexa-delay-5";
            return (
              <Card
                key={card.label}
                className={`acadexa-anim-fade-up acadexa-card-premium acadexa-glass ${delay} border-[#c9a227]/30 hover:border-[#c9a227]/70`}
              >
                <CardHeader className="flex flex-row items-start justify-between gap-3 border-0 p-5 pb-0">
                  <p className="acadexa-kicker text-[#6b1d2a]/70">
                    {card.label}
                  </p>
                  <span className="acadexa-icon-pop inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#faf6ef] text-[#6b1d2a] ring-1 ring-[#c9a227]/25">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                </CardHeader>
                <CardContent className="p-5 pt-3">
                  <p className="acadexa-display break-words text-[1.7rem] text-[#6b1d2a]">
                    {typeof card.value === "number" ? (
                      <AnimatedCounter value={card.value} />
                    ) : (
                      card.value
                    )}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section aria-label="Quick actions" className="acadexa-anim-fade-up acadexa-delay-2">
        <div>
          <h2 className="acadexa-display text-lg text-[#6b1d2a] sm:text-xl">Quick Actions</h2>
          <p className="acadexa-lede mt-1.5 text-zinc-600">
            Jump to common school admin tasks.
          </p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="acadexa-lift acadexa-card-premium acadexa-glass group rounded-xl border border-[#c9a227]/35 p-5 hover:border-[#c9a227]/80"
              >
                <span className="acadexa-icon-pop inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#6b1d2a] text-white ring-1 ring-[#c9a227]/40 group-hover:bg-[#54151f]">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="mt-3 block font-semibold tracking-tight text-[#6b1d2a]">{action.label}</span>
                <span className="mt-1 block text-sm text-zinc-600">{action.description}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section aria-label="Recent activity" className="acadexa-anim-fade-up acadexa-delay-3">
        <Card className="acadexa-card-premium acadexa-glass border-[#c9a227]/30">
          <CardHeader className="border-[#c9a227]/20">
            <CardTitle className="tracking-[-0.02em] text-[#6b1d2a]">Recent Activity</CardTitle>
            <CardDescription>
              School audit events only. Nothing is invented when the log is empty.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <EmptyState
                kind="activity"
                title="No recent school activity yet"
                description="Audit events for this school will appear here when work begins."
              />
            ) : (
              <ol className="relative">
                <span
                  className="acadexa-timeline-rail pointer-events-none absolute bottom-3 left-[11px] top-3 w-px"
                  aria-hidden
                />
                {logs.map((row, index) => (
                  <li
                    key={row.id}
                    className={`acadexa-anim-fade-up group relative pb-6 pl-8 last:pb-0 ${
                      index === 0
                        ? "acadexa-delay-1"
                        : index === 1
                          ? "acadexa-delay-2"
                          : "acadexa-delay-3"
                    }`}
                  >
                    <span
                      className={`absolute left-[5px] top-2.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#c9a227] shadow-[0_0_0_3px_rgb(201_162_39_/_0.18)] ${
                        index === 0 ? "acadexa-timeline-dot-live" : ""
                      }`}
                      aria-hidden
                    />
                    <div className="rounded-lg px-3 py-2 transition-colors duration-200 group-hover:bg-[#faf6ef]/90">
                      <p className="text-sm font-semibold capitalize tracking-tight text-[#6b1d2a]">
                        {row.action.replaceAll("_", " ")}
                      </p>
                      <p className="mt-0.5 text-sm capitalize text-zinc-600">
                        {row.entity_type.replaceAll("_", " ")}
                      </p>
                      <p className="mt-1 text-xs tracking-wide text-zinc-500">
                        {new Date(row.created_at).toLocaleString()}
                      </p>
                    </div>
                    <span className="sr-only">
                      {formatActivity(row.action, row.entity_type, row.created_at)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

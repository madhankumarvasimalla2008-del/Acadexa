"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { requireSchoolAdmin } from "@/lib/auth/workspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  academicYearSchema,
  classSchema,
  enrollmentSchema,
  parentInviteSchema,
  studentSchema,
} from "@/lib/validations/phase0";
import type { ActionState } from "@/features/auth/actions";

function revalidateSchoolPaths() {
  revalidatePath("/school");
  revalidatePath("/school/years");
  revalidatePath("/school/classes");
  revalidatePath("/school/students");
  revalidatePath("/school/parents");
}

export async function createAcademicYearAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { schoolId } = await requireSchoolAdmin();
  const parsed = academicYearSchema.safeParse({
    name: formData.get("name"),
    startsOn: formData.get("startsOn"),
    endsOn: formData.get("endsOn"),
    isCurrent: formData.get("isCurrent") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid year." };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("academic_years")
    .insert({
      school_id: schoolId,
      name: parsed.data.name,
      starts_on: parsed.data.startsOn,
      ends_on: parsed.data.endsOn,
      is_current: parsed.data.isCurrent ?? false,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  await writeAuditLog({
    schoolId,
    action: "academic_year.create",
    entityType: "academic_years",
    entityId: data.id,
  });
  revalidateSchoolPaths();
  return { success: "Academic year created." };
}

export async function createClassAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { schoolId } = await requireSchoolAdmin();
  const parsed = classSchema.safeParse({
    name: formData.get("name"),
    section: formData.get("section"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid class." };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("classes")
    .insert({
      school_id: schoolId,
      name: parsed.data.name,
      section: parsed.data.section || null,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  await writeAuditLog({
    schoolId,
    action: "class.create",
    entityType: "classes",
    entityId: data.id,
  });
  revalidateSchoolPaths();
  return { success: "Class created." };
}

export async function createStudentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { schoolId } = await requireSchoolAdmin();
  const parsed = studentSchema.safeParse({
    studentCode: formData.get("studentCode"),
    fullName: formData.get("fullName"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid student." };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("students")
    .insert({
      school_id: schoolId,
      student_code: parsed.data.studentCode,
      full_name: parsed.data.fullName,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  await writeAuditLog({
    schoolId,
    action: "student.create",
    entityType: "students",
    entityId: data.id,
  });
  revalidateSchoolPaths();
  return { success: "Student created. Enroll them in a year/class next." };
}

export async function createEnrollmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { schoolId } = await requireSchoolAdmin();
  const parsed = enrollmentSchema.safeParse({
    studentId: formData.get("studentId"),
    academicYearId: formData.get("academicYearId"),
    classId: formData.get("classId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid enrollment." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: student } = await supabase
    .from("students")
    .select("id, school_id")
    .eq("id", parsed.data.studentId)
    .maybeSingle();

  if (!student || student.school_id !== schoolId) {
    return { error: "Student is not in this school." };
  }

  const { data, error } = await supabase
    .from("student_enrollments")
    .insert({
      school_id: schoolId,
      student_id: parsed.data.studentId,
      academic_year_id: parsed.data.academicYearId,
      class_id: parsed.data.classId,
      status: "active",
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  await writeAuditLog({
    schoolId,
    action: "enrollment.create",
    entityType: "student_enrollments",
    entityId: data.id,
  });
  revalidateSchoolPaths();
  return { success: "Enrollment recorded." };
}

function inviteResultFromRpc(data: unknown): { id: string; inviteToken: string } | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    return null;
  }
  const rec = row as Record<string, unknown>;
  const id = rec.id;
  const token = rec.invite_token ?? rec.inviteToken;
  if (typeof id !== "string" || !id) {
    return null;
  }
  if (typeof token !== "string" || !token) {
    return null;
  }
  return { id, inviteToken: token };
}

export async function inviteParentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { schoolId } = await requireSchoolAdmin();
  const parsed = parentInviteSchema.safeParse({
    studentId: formData.get("studentId"),
    email: formData.get("email"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid invitation." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: student } = await supabase
    .from("students")
    .select("id, school_id")
    .eq("id", parsed.data.studentId)
    .maybeSingle();

  if (!student || student.school_id !== schoolId) {
    return { error: "Student is not in this school." };
  }

  const email = parsed.data.email || null;
  const phone = parsed.data.phone || null;

  let parentId: string | null = null;
  const { data: matches } = await supabase.rpc("find_profile_by_contact", {
    p_email: email,
    p_phone: phone,
    p_school_id: schoolId,
  });
  const found = (matches ?? [])[0] as { id: string } | undefined;
  if (found) {
    parentId = found.id;
  }

  const { data, error } = await supabase.rpc("create_parent_student_invite", {
    p_school_id: schoolId,
    p_student_id: parsed.data.studentId,
    p_email: email,
    p_phone: phone,
    p_parent_id: parentId,
  });

  const created = inviteResultFromRpc(data);

  if (error || !created) {
    if (error?.message?.toLowerCase().includes("already exists")) {
      const { data: existing } = await supabase
        .from("parent_students")
        .select("id, status, student_id")
        .eq("school_id", schoolId)
        .eq("student_id", parsed.data.studentId)
        .in("status", ["invited", "accepted"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing) {
        return {
          success:
            existing.status === "accepted"
              ? "This parent is already linked to the student. No new invitation was created."
              : "An invitation already exists for this student. It is listed above. The original link cannot be shown again because the token is not stored in plaintext.",
        };
      }
    }
    return { error: error?.message ?? "Could not create invitation." };
  }

  await writeAuditLog({
    schoolId,
    action: "parent_student.invite",
    entityType: "parent_students",
    entityId: created.id,
  });
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "http://localhost:3000";
  const inviteUrl = `${base}/invite/${created.inviteToken}`;
  return {
    success:
      "Invitation created. Share this link with the parent. They must accept it before seeing the child.",
    href: inviteUrl,
  };
}

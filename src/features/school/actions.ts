"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { requireSchoolAdmin } from "@/lib/auth/workspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  academicYearIdSchema,
  academicYearSchema,
  academicYearUpdateSchema,
  classIdSchema,
  classSchema,
  classUpdateSchema,
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
  revalidatePath("/school/students/import");
  revalidatePath("/school/parents");
}

function mapSchoolWriteError(
  error: { code?: string; message: string },
  kind: "year" | "class",
): string {
  const code = error.code ?? "";
  const message = error.message ?? "";
  if (code === "23505" || /duplicate key|unique constraint/i.test(message)) {
    return kind === "year"
      ? "An academic year with this name already exists for this school."
      : "A class with this name and section already exists for this school.";
  }
  if (code === "23503" || /foreign key|violates foreign key/i.test(message)) {
    return kind === "year"
      ? "This year cannot be removed while students are enrolled in it."
      : "This class cannot be removed while students are enrolled in it.";
  }
  if (code === "23514" || /check constraint|dates_check/i.test(message)) {
    return "The end date must be after the start date.";
  }
  return message || "Could not save changes.";
}

function classSortOrder(name: string): number {
  const match = name.match(/(\d{1,2})/);
  if (!match) {
    return 0;
  }
  const value = Number.parseInt(match[1], 10);
  return value >= 1 && value <= 12 ? value : 0;
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
    return { error: mapSchoolWriteError(error, "year") };
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

export async function updateAcademicYearAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { schoolId } = await requireSchoolAdmin();
  const parsed = academicYearUpdateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    startsOn: formData.get("startsOn"),
    endsOn: formData.get("endsOn"),
    isCurrent: formData.get("isCurrent") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid year." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("academic_years")
    .update({
      name: parsed.data.name,
      starts_on: parsed.data.startsOn,
      ends_on: parsed.data.endsOn,
      is_current: parsed.data.isCurrent ?? false,
    })
    .eq("id", parsed.data.id)
    .eq("school_id", schoolId);

  if (error) {
    return { error: mapSchoolWriteError(error, "year") };
  }

  await writeAuditLog({
    schoolId,
    action: "academic_year.update",
    entityType: "academic_years",
    entityId: parsed.data.id,
  });
  revalidateSchoolPaths();
  return { success: "Academic year updated." };
}

export async function setCurrentAcademicYearAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { schoolId } = await requireSchoolAdmin();
  const parsed = academicYearIdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) {
    return { error: "Invalid year." };
  }

  const makeCurrent = formData.get("isCurrent") === "on";
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("academic_years")
    .update({ is_current: makeCurrent })
    .eq("id", parsed.data.id)
    .eq("school_id", schoolId);

  if (error) {
    return { error: mapSchoolWriteError(error, "year") };
  }

  await writeAuditLog({
    schoolId,
    action: makeCurrent ? "academic_year.set_current" : "academic_year.clear_current",
    entityType: "academic_years",
    entityId: parsed.data.id,
  });
  revalidateSchoolPaths();
  return {
    success: makeCurrent
      ? "This is now the current academic year."
      : "Year marked as historical.",
  };
}

export async function deleteAcademicYearAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { schoolId } = await requireSchoolAdmin();
  const parsed = academicYearIdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) {
    return { error: "Invalid year." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("academic_years")
    .delete()
    .eq("id", parsed.data.id)
    .eq("school_id", schoolId);

  if (error) {
    return { error: mapSchoolWriteError(error, "year") };
  }

  await writeAuditLog({
    schoolId,
    action: "academic_year.delete",
    entityType: "academic_years",
    entityId: parsed.data.id,
  });
  revalidateSchoolPaths();
  return { success: "Academic year removed." };
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
      sort_order: classSortOrder(parsed.data.name),
    })
    .select("id")
    .single();

  if (error) {
    return { error: mapSchoolWriteError(error, "class") };
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

export async function updateClassAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { schoolId } = await requireSchoolAdmin();
  const parsed = classUpdateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    section: formData.get("section"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid class." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("classes")
    .update({
      name: parsed.data.name,
      section: parsed.data.section || null,
      sort_order: classSortOrder(parsed.data.name),
    })
    .eq("id", parsed.data.id)
    .eq("school_id", schoolId);

  if (error) {
    return { error: mapSchoolWriteError(error, "class") };
  }

  await writeAuditLog({
    schoolId,
    action: "class.update",
    entityType: "classes",
    entityId: parsed.data.id,
  });
  revalidateSchoolPaths();
  return { success: "Class updated." };
}

export async function deleteClassAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { schoolId } = await requireSchoolAdmin();
  const parsed = classIdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) {
    return { error: "Invalid class." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("classes")
    .delete()
    .eq("id", parsed.data.id)
    .eq("school_id", schoolId);

  if (error) {
    return { error: mapSchoolWriteError(error, "class") };
  }

  await writeAuditLog({
    schoolId,
    action: "class.delete",
    entityType: "classes",
    entityId: parsed.data.id,
  });
  revalidateSchoolPaths();
  return { success: "Class removed." };
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

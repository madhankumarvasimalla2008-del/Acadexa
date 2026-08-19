"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { requireSchoolAdmin } from "@/lib/auth/workspace";
import {
  parseStudentImportFile,
  safeImportFilename,
  STUDENT_IMPORT_MAX_BYTES,
  type StudentImportRowResult,
} from "@/lib/school/student-import";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ActionState } from "@/features/auth/actions";

function revalidateImportPaths() {
  revalidatePath("/school");
  revalidatePath("/school/students");
  revalidatePath("/school/students/import");
}

export async function importStudentsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { schoolId, context } = await requireSchoolAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a CSV or Excel file." };
  }
  if (file.size > STUDENT_IMPORT_MAX_BYTES) {
    return { error: "File is larger than 2 MB." };
  }

  const filename = safeImportFilename(file.name);
  const lower = filename.toLowerCase();
  if (!lower.endsWith(".csv") && !lower.endsWith(".xlsx")) {
    return { error: "Use a .csv or .xlsx file." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const supabase = await createServerSupabaseClient();

  const { data: job, error: jobError } = await supabase
    .from("student_import_jobs")
    .insert({
      school_id: schoolId,
      uploaded_by: context.userId,
      filename,
      byte_size: file.size,
      status: "pending",
    })
    .select("id")
    .single();

  if (jobError || !job) {
    return { error: jobError?.message ?? "Could not start import job." };
  }

  const storagePath = `${schoolId}/${job.id}/${filename}`;
  const { error: uploadError } = await supabase.storage
    .from("student-imports")
    .upload(storagePath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    await supabase
      .from("student_import_jobs")
      .update({
        status: "failed",
        error_summary: uploadError.message,
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .eq("school_id", schoolId);
    revalidateImportPaths();
    return { error: uploadError.message };
  }

  await supabase
    .from("student_import_jobs")
    .update({
      status: "processing",
      storage_path: storagePath,
    })
    .eq("id", job.id)
    .eq("school_id", schoolId);

  const parsed = await parseStudentImportFile(buffer, filename);
  if (parsed.error) {
    await supabase
      .from("student_import_jobs")
      .update({
        status: "failed",
        error_summary: parsed.error,
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .eq("school_id", schoolId);
    await writeAuditLog({
      schoolId,
      action: "student.import",
      entityType: "student_import_jobs",
      entityId: job.id,
      metadata: { inserted: 0, failed: 0, skipped: 0, filename },
    });
    revalidateImportPaths();
    return { error: parsed.error };
  }

  const { data: existingRows } = await supabase
    .from("students")
    .select("student_code")
    .eq("school_id", schoolId);
  const existingCodes = new Set(
    (existingRows ?? []).map((row) => row.student_code),
  );

  const rowRecords: {
    job_id: string;
    school_id: string;
    row_number: number;
    status: StudentImportRowResult["status"];
    student_code: string | null;
    message: string | null;
  }[] = [];
  let inserted = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of parsed.rows) {
    if (row.status === "skipped") {
      skipped += 1;
      rowRecords.push({
        job_id: job.id,
        school_id: schoolId,
        row_number: row.rowNumber,
        status: "skipped",
        student_code: row.studentCode,
        message: row.message,
      });
      continue;
    }

    if (row.status === "failed" || !row.studentCodeValue || !row.fullNameValue) {
      failed += 1;
      rowRecords.push({
        job_id: job.id,
        school_id: schoolId,
        row_number: row.rowNumber,
        status: "failed",
        student_code: row.studentCode,
        message: row.message,
      });
      continue;
    }

    if (existingCodes.has(row.studentCodeValue)) {
      failed += 1;
      rowRecords.push({
        job_id: job.id,
        school_id: schoolId,
        row_number: row.rowNumber,
        status: "failed",
        student_code: row.studentCodeValue,
        message: "Student code already exists at this school.",
      });
      continue;
    }

    const { error: insertError } = await supabase.from("students").insert({
      school_id: schoolId,
      student_code: row.studentCodeValue,
      full_name: row.fullNameValue,
    });

    if (insertError) {
      failed += 1;
      rowRecords.push({
        job_id: job.id,
        school_id: schoolId,
        row_number: row.rowNumber,
        status: "failed",
        student_code: row.studentCodeValue,
        message: insertError.message,
      });
      continue;
    }

    existingCodes.add(row.studentCodeValue);
    inserted += 1;
    rowRecords.push({
      job_id: job.id,
      school_id: schoolId,
      row_number: row.rowNumber,
      status: "inserted",
      student_code: row.studentCodeValue,
      message: null,
    });
  }

  if (rowRecords.length > 0) {
    const { error: rowsError } = await supabase
      .from("student_import_job_rows")
      .insert(rowRecords);
    if (rowsError) {
      await supabase
        .from("student_import_jobs")
        .update({
          status: "failed",
          total_rows: parsed.rows.length,
          inserted_count: inserted,
          failed_count: failed,
          skipped_count: skipped,
          error_summary: rowsError.message,
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id)
        .eq("school_id", schoolId);
      revalidateImportPaths();
      return { error: rowsError.message };
    }
  }

  await supabase
    .from("student_import_jobs")
    .update({
      status: "completed",
      total_rows: parsed.rows.length,
      inserted_count: inserted,
      failed_count: failed,
      skipped_count: skipped,
      completed_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("school_id", schoolId);

  await writeAuditLog({
    schoolId,
    action: "student.import",
    entityType: "student_import_jobs",
    entityId: job.id,
    metadata: { inserted, failed, skipped, filename },
  });
  revalidateImportPaths();

  return {
    success: `Import finished. Inserted ${inserted}, failed ${failed}, skipped ${skipped}.`,
  };
}

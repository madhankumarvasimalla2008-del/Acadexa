import ExcelJS from "exceljs";
import Papa from "papaparse";
import { studentSchema } from "@/lib/validations/phase0";

export const STUDENT_IMPORT_MAX_BYTES = 2 * 1024 * 1024;
export const STUDENT_IMPORT_MAX_ROWS = 2000;

export type StudentImportRowResult = {
  rowNumber: number;
  status: "inserted" | "failed" | "skipped";
  studentCode: string | null;
  message: string | null;
  studentCodeValue?: string;
  fullNameValue?: string;
};

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function cellText(value: unknown): string {
  if (value == null) {
    return "";
  }
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  return String(value).trim();
}

function parseGrid(grid: string[][]): {
  error?: string;
  rows: StudentImportRowResult[];
} {
  if (grid.length === 0) {
    return { error: "The file is empty.", rows: [] };
  }

  const header = (grid[0] ?? []).map(normalizeHeader);
  const codeIndex = header.findIndex((name) => name === "student_code");
  const nameIndex = header.findIndex((name) => name === "full_name");
  if (codeIndex < 0 || nameIndex < 0) {
    return {
      error: "Missing required headers student_code and full_name.",
      rows: [],
    };
  }

  const dataRows = grid.slice(1);
  if (dataRows.length > STUDENT_IMPORT_MAX_ROWS) {
    return {
      error: `Too many rows. Maximum is ${STUDENT_IMPORT_MAX_ROWS}.`,
      rows: [],
    };
  }

  const seen = new Set<string>();
  const rows: StudentImportRowResult[] = [];

  for (let i = 0; i < dataRows.length; i += 1) {
    const line = dataRows[i] ?? [];
    const rowNumber = i + 2;
    const studentCode = cellText(line[codeIndex]);
    const fullName = cellText(line[nameIndex]);

    if (!studentCode && !fullName) {
      rows.push({
        rowNumber,
        status: "skipped",
        studentCode: null,
        message: "Empty row.",
      });
      continue;
    }

    const parsed = studentSchema.safeParse({
      studentCode,
      fullName,
    });
    if (!parsed.success) {
      rows.push({
        rowNumber,
        status: "failed",
        studentCode: studentCode || null,
        message: parsed.error.issues[0]?.message ?? "Invalid student.",
      });
      continue;
    }

    const codeKey = parsed.data.studentCode;
    if (seen.has(codeKey)) {
      rows.push({
        rowNumber,
        status: "failed",
        studentCode: codeKey,
        message: "Duplicate student_code in this file.",
      });
      continue;
    }
    seen.add(codeKey);

    rows.push({
      rowNumber,
      status: "inserted",
      studentCode: codeKey,
      message: null,
      studentCodeValue: parsed.data.studentCode,
      fullNameValue: parsed.data.fullName,
    });
  }

  return { rows };
}

async function gridFromXlsx(buffer: Buffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return [];
  }
  const grid: string[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row) => {
    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
    grid.push(values.map(cellText));
  });
  return grid;
}

export async function parseStudentImportFile(
  buffer: Buffer,
  filename: string,
): Promise<{ error?: string; rows: StudentImportRowResult[] }> {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".xlsx")) {
    const grid = await gridFromXlsx(buffer);
    return parseGrid(grid);
  }
  if (lower.endsWith(".csv")) {
    const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
    const parsed = Papa.parse<string[]>(text, {
      header: false,
      skipEmptyLines: false,
    });
    if (parsed.errors.length > 0 && (!parsed.data || parsed.data.length === 0)) {
      return { error: parsed.errors[0]?.message ?? "Could not parse CSV.", rows: [] };
    }
    const grid = (parsed.data ?? []).map((line) =>
      Array.isArray(line) ? line.map(cellText) : [],
    );
    return parseGrid(grid);
  }
  return { error: "Use a .csv or .xlsx file.", rows: [] };
}

export function safeImportFilename(filename: string): string {
  const base = filename.replace(/\\/g, "/").split("/").pop() ?? "import.csv";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.slice(0, 120) || "import.csv";
}

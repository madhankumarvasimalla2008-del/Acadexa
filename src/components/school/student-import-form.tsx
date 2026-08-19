"use client";

import { FoundationForm } from "@/components/forms/foundation-form";
import { Label } from "@/components/ui/label";
import { importStudentsAction } from "@/features/school/import-actions";

export function StudentImportForm() {
  return (
    <FoundationForm action={importStudentsAction} submitLabel="Import students">
      <div className="space-y-1">
        <Label htmlFor="file">CSV or Excel file</Label>
        <input
          id="file"
          name="file"
          type="file"
          required
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-zinc-300 file:bg-white file:px-3 file:py-1.5"
        />
      </div>
    </FoundationForm>
  );
}

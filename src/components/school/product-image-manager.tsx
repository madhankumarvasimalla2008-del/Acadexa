"use client";

import { useState, useRef, useActionState } from "react";
import { uploadProductImageAction, deleteProductImageAction } from "@/features/school/requirement-actions";
import type { ActionState } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_FILE_SIZE } from "@/lib/validations/requirements";


export type ImageSummary = {
  id: string;
  productId: string;
  storagePath: string;
  isPrimary: boolean;
  altText: string | null;
  url: string;
};

export function ProductImageManager({
  productId,
  productName,
  images,
}: {
  productId: string;
  productName: string;
  images: ImageSummary[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadState, uploadFormAction, isUploading] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      setClientError(null);
      const res = await uploadProductImageAction(prev, formData);
      if (res?.success) {
        setSelectedFile(null);
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
      return res;
    },
    undefined
  );


  const [deleteState, deleteFormAction, isDeleting] = useActionState(
    deleteProductImageAction,
    undefined
  );

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setClientError(null);
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }

    if (file.size > MAX_IMAGE_FILE_SIZE) {
      setClientError("File size exceeds 5 MB limit.");
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setClientError("Please select a JPEG, PNG, or WebP image.");
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  }

  return (
    <div className="mt-4 border-t border-[#c9a227]/20 pt-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6b1d2a] hover:underline"
        >
          <span>📸 Product photos & cover images ({images.length})</span>
          <span className="text-[10px] text-zinc-500">{isOpen ? "▲ Hide" : "▼ Manage"}</span>
        </button>
      </div>

      {isOpen ? (
        <div className="mt-3 space-y-4 rounded-lg border border-[#c9a227]/25 bg-[#faf6ef]/50 p-3 text-xs">
          {/* Existing Images Gallery */}
          <div>
            <p className="font-semibold text-zinc-700">Uploaded photos for {productName}</p>
            {images.length === 0 ? (
              <p className="mt-1 text-zinc-500 italic">No photos uploaded yet. The parent catalog will show a category glyph.</p>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {images.map((img) => (
                  <div
                    key={img.id}
                    className="relative group overflow-hidden rounded-lg border border-[#c9a227]/30 bg-white shadow-xs p-1"
                  >
                    <div className="relative aspect-square w-full overflow-hidden rounded-md bg-[#faf6ef]">
                      <img
                        src={img.url}
                        alt={img.altText || productName}
                        className="h-full w-full object-cover"
                      />
                      {img.isPrimary ? (
                        <span className="absolute top-1 left-1 rounded bg-[#6b1d2a] px-1.5 py-0.5 text-[10px] font-semibold text-[#f7e0a3]">
                          Primary
                        </span>
                      ) : null}
                    </div>

                    <form action={deleteFormAction} className="mt-1.5 flex justify-end">
                      <input type="hidden" name="imageId" value={img.id} />
                      <button
                        type="submit"
                        disabled={isDeleting}
                        className="text-[11px] font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            )}
            {deleteState?.error ? (
              <p className="mt-1 text-xs text-red-600">{deleteState.error}</p>
            ) : null}
          </div>

          {/* Upload Form */}
          <div className="border-t border-[#c9a227]/20 pt-3">
            <p className="font-semibold text-zinc-700">Upload new photo (max 5 MB)</p>
            <form action={uploadFormAction} className="mt-2 space-y-2.5">
              <input type="hidden" name="productId" value={productId} />

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  name="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="block w-full text-xs text-zinc-600 file:mr-2 file:rounded-md file:border-0 file:bg-[#6b1d2a] file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-[#f7e0a3] hover:file:bg-[#4a121c]"
                />

                <label className="flex items-center gap-1.5 whitespace-nowrap text-xs text-zinc-700">
                  <input
                    type="checkbox"
                    name="isPrimary"
                    defaultChecked={images.length === 0}
                    className="h-3.5 w-3.5 accent-[#6b1d2a]"
                  />
                  Set as primary
                </label>
              </div>

              {previewUrl ? (
                <div className="flex items-center gap-2 rounded border border-[#c9a227]/30 bg-white p-1.5 w-max">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="h-12 w-12 rounded object-cover"
                  />
                  <div className="text-[11px] text-zinc-600">
                    <p className="font-medium truncate max-w-[160px]">{selectedFile?.name}</p>
                    <p>{(selectedFile?.size ? (selectedFile.size / 1024).toFixed(1) : 0)} KB</p>
                  </div>
                </div>
              ) : null}

              {clientError ? (
                <p className="text-xs text-red-600 font-medium">{clientError}</p>
              ) : null}
              {uploadState?.error ? (
                <p className="text-xs text-red-600 font-medium">{uploadState.error}</p>
              ) : null}
              {uploadState?.success ? (
                <p className="text-xs text-teal-700 font-medium">{uploadState.success}</p>
              ) : null}

              <Button
                type="submit"
                size="sm"
                disabled={isUploading || !selectedFile}
                className="bg-[#6b1d2a] text-[#f7e0a3] hover:bg-[#4a121c] text-xs h-7 px-3"
              >
                {isUploading ? "Uploading…" : "Upload Photo"}
              </Button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

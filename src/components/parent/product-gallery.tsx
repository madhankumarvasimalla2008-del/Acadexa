"use client";

import { useState } from "react";

type ImageItem = {
  url: string;
  alt: string | null;
  isPrimary: boolean;
};

export function ProductGallery({
  images,
  kind,
  name,
}: {
  images: ImageItem[];
  kind: "book" | "uniform" | "other";
  name: string;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-xl border border-[#c9a227]/25 bg-[#faf6ef] text-6xl text-[#c9a227]/40 shadow-inner">
        {kind === "book" ? "📖" : kind === "uniform" ? "👕" : "📦"}
      </div>
    );
  }

  const currentImage = images[selectedIndex] ?? images[0];

  return (
    <div className="space-y-3">
      {/* Main Preview */}
      <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-[#c9a227]/30 bg-[#faf6ef] shadow-sm">
        <img
          src={currentImage.url}
          alt={currentImage.alt || name}
          className="h-full w-full object-contain p-2 transition-all duration-300"
        />
      </div>

      {/* Thumbnails */}
      {images.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {images.map((img, idx) => (
            <button
              key={img.url + idx}
              type="button"
              onClick={() => setSelectedIndex(idx)}
              className={`relative h-16 w-16 overflow-hidden rounded-lg border transition-all ${
                selectedIndex === idx
                  ? "border-[#6b1d2a] ring-2 ring-[#6b1d2a]/30 shadow-xs"
                  : "border-[#c9a227]/30 bg-[#faf6ef] opacity-70 hover:opacity-100"
              }`}
            >
              <img
                src={img.url}
                alt={img.alt || `${name} thumbnail ${idx + 1}`}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

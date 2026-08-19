"use client";

export function AbpsOrnament({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 160 16"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M8 8h52" stroke="#c9a227" strokeWidth="1" strokeLinecap="round" />
      <path d="M100 8h52" stroke="#c9a227" strokeWidth="1" strokeLinecap="round" />
      <path
        d="M80 2.5 84.5 8 80 13.5 75.5 8Z"
        stroke="#c9a227"
        strokeWidth="1.1"
        fill="#f7e0a3"
      />
    </svg>
  );
}

export default AbpsOrnament;

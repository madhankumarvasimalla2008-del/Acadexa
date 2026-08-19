type EmptyKind = "students" | "enrollments" | "invites" | "activity";

function Illustration({ kind }: { kind: EmptyKind }) {
  if (kind === "students") {
    return (
      <svg aria-hidden viewBox="0 0 120 72" className="mx-auto h-16 w-auto">
        <rect x="14" y="18" width="36" height="42" rx="5" fill="#fff" stroke="#6b1d2a" strokeWidth="1.2" />
        <circle cx="32" cy="34" r="7" fill="none" stroke="#6b1d2a" strokeWidth="1.2" />
        <path d="M20 54c3-9 21-9 24 0" fill="none" stroke="#6b1d2a" strokeWidth="1.2" />
        <path d="M62 22h40v38H62Z" fill="#faf6ef" stroke="#c9a227" strokeWidth="1.2" />
        <path d="M70 34h24M70 42h24M70 50h14" stroke="#c9a227" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "enrollments") {
    return (
      <svg aria-hidden viewBox="0 0 120 72" className="mx-auto h-16 w-auto">
        <path d="M24 54V22l36-12 36 12v32" fill="#fff" stroke="#6b1d2a" strokeWidth="1.2" />
        <path d="M60 10v44" stroke="#c9a227" strokeWidth="1.2" />
        <path d="M38 34h16M78 34h16M38 44h12M78 44h12" stroke="#6b1d2a" strokeWidth="1.1" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "invites") {
    return (
      <svg aria-hidden viewBox="0 0 120 72" className="mx-auto h-16 w-auto">
        <rect x="22" y="18" width="76" height="42" rx="5" fill="#fff" stroke="#6b1d2a" strokeWidth="1.2" />
        <path d="M22 24l38 22 38-22" fill="none" stroke="#c9a227" strokeWidth="1.3" />
      </svg>
    );
  }
  return (
    <svg aria-hidden viewBox="0 0 120 72" className="mx-auto h-16 w-auto">
      <path d="M28 16v40" stroke="#c9a227" strokeWidth="1.2" />
      <circle cx="28" cy="22" r="4" fill="#c9a227" />
      <circle cx="28" cy="38" r="4" fill="none" stroke="#6b1d2a" strokeWidth="1.2" />
      <circle cx="28" cy="54" r="4" fill="none" stroke="#6b1d2a" strokeWidth="1.2" />
      <path d="M42 22h50M42 38h40M42 54h32" stroke="#6b1d2a" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

export function EmptyState({
  kind,
  title,
  description,
}: {
  kind: EmptyKind;
  title: string;
  description: string;
}) {
  return (
    <div className="acadexa-empty rounded-2xl border border-dashed border-[#c9a227]/45 bg-gradient-to-b from-white/80 to-[#faf6ef] px-5 py-10 text-center sm:px-8">
      <div className="mx-auto flex h-[4.5rem] w-[7.5rem] items-center justify-center rounded-xl bg-white/70 ring-1 ring-[#c9a227]/25">
        <Illustration kind={kind} />
      </div>
      <p className="acadexa-kicker mt-5 text-[#c9a227]">Ready when you are</p>
      <p className="mt-2 text-base font-semibold tracking-tight text-[#6b1d2a]">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-zinc-600">{description}</p>
    </div>
  );
}

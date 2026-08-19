"use client";

import { useActionState, useEffect, useState } from "react";
import type { ActionState } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";

export function FoundationForm({
  action,
  children,
  submitLabel,
  submitClassName,
  submitVariant = "default",
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  submitLabel: string;
  submitClassName?: string;
  submitVariant?: "default" | "outline" | "ghost" | "destructive";
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
  }, [state?.href]);

  async function copyHref() {
    if (!state?.href) {
      return;
    }
    try {
      await navigator.clipboard.writeText(state.href);
      setCopied(true);
      return;
    } catch {
      /* HTTP / iOS may not expose clipboard */
    }
    try {
      const field = document.createElement("textarea");
      field.value = state.href;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.left = "-9999px";
      document.body.appendChild(field);
      field.select();
      document.execCommand("copy");
      document.body.removeChild(field);
      setCopied(true);
    } catch {
      /* Link remains visible to copy manually */
    }
  }

  return (
    <form action={formAction} className="space-y-3">
      {children}
      {state?.error ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      {state?.success ? (
        <div className="space-y-2" role="status">
          <p className="text-sm text-teal-800">{state.success}</p>
          {state.href ? (
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={state.href}
                className="break-all text-sm text-teal-800 underline"
                target="_blank"
                rel="noreferrer"
              >
                {state.href}
              </a>
              <Button type="button" size="sm" variant="outline" onClick={copyHref}>
                {copied ? "Copied" : "Copy Link"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      <Button
        type="submit"
        size="sm"
        variant={submitVariant}
        className={submitClassName}
        disabled={pending}
      >
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}

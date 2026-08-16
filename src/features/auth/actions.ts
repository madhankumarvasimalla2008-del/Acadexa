"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema } from "@/lib/validations/phase0";

export type ActionState = { error?: string; success?: string; href?: string } | undefined;

export async function loginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured. Copy .env.example to .env.local." };
  }

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: error.message };
  }

  const next = String(formData.get("next") ?? "/home");
  redirect(next.startsWith("/") ? next : "/home");
}

export async function registerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured. Copy .env.example to .env.local." };
  }

  const parsed = registerSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName,
        phone: parsed.data.phone || null,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  return {
    success:
      "Account created. If email confirmation is enabled, check your inbox before signing in.",
  };
}

export async function logoutAction() {
  if (!isSupabaseConfigured()) {
    redirect("/login");
  }
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function setActiveSchoolAction(schoolId: string) {
  const { cookies } = await import("next/headers");
  const { requireAuth } = await import("@/lib/auth/session");
  const context = await requireAuth();
  const allowed = context.memberships.some((m) => m.school_id === schoolId);
  if (!allowed) {
    return;
  }
  const cookieStore = await cookies();
  cookieStore.set("acadexa_active_school", schoolId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
  revalidatePath("/");
}

export async function setActiveStudentAction(studentId: string) {
  const { cookies } = await import("next/headers");
  const { requireAuth } = await import("@/lib/auth/session");
  const { ACTIVE_STUDENT_COOKIE, isAcceptedParentChild } = await import(
    "@/lib/auth/workspace"
  );
  const context = await requireAuth();
  if (!isAcceptedParentChild(context, studentId)) {
    return;
  }
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_STUDENT_COOKIE, studentId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
  revalidatePath("/parent");
  redirect(`/parent/children/${studentId}`);
}

export async function forgotPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured. Copy .env.example to .env.local." };
  }

  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid email." };
  }

  const supabase = await createServerSupabaseClient();
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "http://localhost:3000";
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${base}/auth/callback?next=/reset-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return {
    success:
      "If that email is registered, we sent a reset link. Check your inbox and spam folder.",
  };
}

export async function updatePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured. Copy .env.example to .env.local." };
  }

  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid password." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "This reset link is invalid or has expired. Request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { error: error.message };
  }

  redirect("/home");
}

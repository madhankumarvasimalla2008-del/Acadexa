import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const registerSchema = z.object({
  fullName: z.string().min(2, "Enter your name.").max(120),
  email: z.string().email("Enter a valid email address."),
  phone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .or(z.literal("")),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const schoolCreateSchema = z.object({
  name: z.string().min(2).max(160),
  code: z
    .string()
    .min(2)
    .max(32)
    .regex(/^[a-zA-Z0-9_-]+$/, "Use letters, numbers, dash, or underscore."),
});

export const membershipSchema = z.object({
  schoolId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(["school_admin", "distribution_staff"]),
});

export const schoolStatusSchema = z.object({
  schoolId: z.string().uuid(),
  status: z.enum(["active", "suspended"]),
});

export const membershipIdSchema = z.object({
  membershipId: z.string().uuid(),
  schoolId: z.string().uuid(),
});

export const academicYearSchema = z.object({
  name: z.string().trim().min(4).max(40),
  startsOn: z.string().min(10).max(10),
  endsOn: z.string().min(10).max(10),
  isCurrent: z.boolean().optional(),
});

export const academicYearIdSchema = z.object({
  id: z.string().uuid(),
});

export const academicYearUpdateSchema = academicYearSchema.extend({
  id: z.string().uuid(),
});

export const classSchema = z.object({
  name: z.string().trim().min(1).max(80),
  section: z.string().trim().max(20).optional().or(z.literal("")),
});

export const classUpdateSchema = classSchema.extend({
  id: z.string().uuid(),
});

export const classIdSchema = z.object({
  id: z.string().uuid(),
});

export const studentSchema = z.object({
  studentCode: z.string().min(1).max(40),
  fullName: z.string().min(2).max(160),
});

export const enrollmentSchema = z.object({
  studentId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  classId: z.string().uuid(),
});

export const parentInviteSchema = z.object({
  studentId: z.string().uuid(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(20).optional().or(z.literal("")),
}).refine((value) => Boolean(value.email || value.phone), {
  message: "Provide an email or mobile number to invite.",
});

export const inviteTokenSchema = z.object({
  token: z.string().uuid(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address."),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters."),
  confirmPassword: z.string().min(8, "Password must be at least 8 characters."),
}).refine((value) => value.password === value.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

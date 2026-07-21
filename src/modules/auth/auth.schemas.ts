import { z } from "zod";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address");
const password = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(128, "Password is too long")
  .regex(/[a-z]/, "Password needs a lowercase letter")
  .regex(/[A-Z]/, "Password needs an uppercase letter")
  .regex(/[0-9]/, "Password needs a number");

const birthDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD")
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && s === d.toISOString().slice(0, 10);
  }, "That date does not exist")
  .refine((s) => {
    const age = ageOn(new Date(), new Date(`${s}T00:00:00Z`));
    return age >= 13;
  }, "You must be at least 13 to join")
  .refine((s) => {
    const age = ageOn(new Date(), new Date(`${s}T00:00:00Z`));
    return age <= 120;
  }, "Check the year — that would make you over 120");

export function ageOn(now: Date, dob: Date): number {
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < dob.getUTCMonth() ||
    (now.getUTCMonth() === dob.getUTCMonth() &&
      now.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}


export const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(100),
  email,
  phone: z
    .string()
    .trim()
    .regex(/^[\d\s+\-().]{7,20}$/, "Enter a valid phone number")
    .optional(),
  birthDate,
  gender: z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]),
  password,
});

export const verifyEmailSchema = z.object({
  email,
  code: z.string().regex(/^\d{6}$/, "The code is 6 digits"),
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, 'Enter your email or phone number'),
  password: z.string().min(1, 'Enter your password'),
});

export const resendOtpSchema = z.object({
  email,
});

export type SignupInput = z.infer<typeof signupSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

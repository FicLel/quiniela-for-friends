import { z } from 'zod'

export const emailSchema = z
  .string()
  .min(1, { message: 'Email is required.' })
  .email({ message: 'Please enter a valid email address.' })
  .transform((val) => val.toLowerCase())

export const passwordSchema = z
  .string()
  .min(1, { message: 'Password is required.' })

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
})

export const changePasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, { message: 'Password must be at least 8 characters.' })
      .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter.' })
      .regex(/[a-z]/, { message: 'Password must contain at least one lowercase letter.' })
      .regex(/[0-9]/, { message: 'Password must contain at least one digit.' }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })

export const createFirstAdminSchema = z
  .object({
    email: emailSchema,
    password: z
      .string()
      .min(8, { message: 'Password must be at least 8 characters.' }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })

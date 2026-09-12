import { z } from 'zod';
export const roles = ['STUDENT', 'MENTOR', 'VERIFIER', 'ADMIN'] as const;
export const roleSchema = z.enum(roles);
const text = z.string().trim().min(1).max(200);
const list = z.array(text).max(40).default([]);
export const passwordSchema = z
  .string()
  .min(12, 'Parola en az 12 karakter olmalıdır.')
  .max(128)
  .regex(/[a-z]/, 'Küçük harf ekleyin.')
  .regex(/[A-Z]/, 'Büyük harf ekleyin.')
  .regex(/[0-9]/, 'Rakam ekleyin.');
export const registrationSchema = z
  .object({
    name: text,
    email: z
      .string()
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    password: passwordSchema,
    role: z.enum(['STUDENT', 'MENTOR']),
    minor: z.boolean().default(true),
    consent: z.literal(true),
  })
  .strict();
export const loginSchema = z
  .object({
    email: z
      .string()
      .email()
      .transform((v) => v.toLowerCase()),
    password: z.string().max(128),
  })
  .strict();
export const profileSchema = z
  .object({
    bio: z.string().trim().max(2000).default(''),
    interests: list,
    skills: z
      .array(z.object({ name: text, level: z.number().int().min(1).max(5) }).strict())
      .max(40)
      .default([]),
    goals: list,
    availability: list,
    languages: list,
    mode: z.enum(['ONLINE', 'IN_PERSON', 'BOTH']).default('ONLINE'),
    city: z.string().trim().max(100).default(''),
  })
  .strict();
export const mentorSchema = profileSchema.extend({
  expertise: list,
  experience: z.number().min(0).max(60),
  capacity: z.number().int().min(1).max(30),
});
export const achievementSchema = z
  .object({
    title: text,
    description: z.string().trim().min(10).max(4000),
    category: text,
    date: z.string().date(),
    institutionId: z.string().uuid(),
  })
  .strict();
export const visibilitySchema = z.enum(['PRIVATE', 'MENTORS_ONLY', 'INSTITUTION_ONLY', 'PUBLIC']);
export const privacySchema = z
  .object({
    profile: visibilitySchema,
    interests: visibilitySchema,
    skills: visibilitySchema,
    goals: visibilitySchema,
    achievements: visibilitySchema,
    city: visibilitySchema,
    mentorSearch: z.boolean(),
    publicTitle: z.boolean(),
  })
  .strict();
export const privateDefaults = {
  profile: 'PRIVATE',
  interests: 'PRIVATE',
  skills: 'PRIVATE',
  goals: 'PRIVATE',
  achievements: 'PRIVATE',
  city: 'PRIVATE',
  mentorSearch: false,
  publicTitle: false,
} as const;
export const weightsSchema = z
  .object({
    interest: z.number().min(0).max(1),
    goal: z.number().min(0).max(1),
    expertise: z.number().min(0).max(1),
    availability: z.number().min(0).max(1),
    experience: z.number().min(0).max(1),
    language: z.number().min(0).max(1),
    mode: z.number().min(0).max(1),
    capacity: z.number().min(0).max(1),
  })
  .strict()
  .refine(
    (w) => Math.abs(Object.values(w).reduce((a, b) => a + b, 0) - 1) < 1e-8,
    'Ağırlıkların toplamı 1 olmalıdır.',
  );
export const defaultWeights = {
  interest: 0.25,
  goal: 0.25,
  expertise: 0.2,
  availability: 0.1,
  experience: 0.08,
  language: 0.05,
  mode: 0.04,
  capacity: 0.03,
};
export type ProfileInput = z.infer<typeof profileSchema>;

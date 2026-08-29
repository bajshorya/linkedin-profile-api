import { z } from 'zod';

/**
 * The PUBLIC response contract. Everything is nullable or defaults to [] — keys
 * are never omitted, so consumers get a stable shape. `profile.schema.parse()`
 * runs before we respond, guaranteeing we never ship a shape we didn't document.
 */

const ImageSchema = z
  .object({
    url: z.string(),
    width: z.number().nullable(),
    height: z.number().nullable(),
    expiresAt: z.string().nullable(),
  })
  .nullable();

const LocationSchema = z.object({
  raw: z.string().nullable(),
  countryCode: z.string().nullable(),
});

const ExperienceSchema = z.object({
  title: z.string().nullable(),
  company: z.string().nullable(),
  companyUrl: z.string().nullable(),
  companyLogo: z.string().nullable(),
  employmentType: z.string().nullable(),
  location: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  isCurrent: z.boolean(),
  durationMonths: z.number().nullable(),
  description: z.string().nullable(),
});

const EducationSchema = z.object({
  school: z.string().nullable(),
  schoolUrl: z.string().nullable(),
  schoolLogo: z.string().nullable(),
  degree: z.string().nullable(),
  fieldOfStudy: z.string().nullable(),
  startYear: z.number().nullable(),
  endYear: z.number().nullable(),
  grade: z.string().nullable(),
  description: z.string().nullable(),
});

const SkillSchema = z.object({
  name: z.string().nullable(),
  endorsementCount: z.number().nullable(),
});

const CertificationSchema = z.object({
  name: z.string().nullable(),
  authority: z.string().nullable(),
  licenseNumber: z.string().nullable(),
  url: z.string().nullable(),
  issuedDate: z.string().nullable(),
  expirationDate: z.string().nullable(),
});

const LanguageSchema = z.object({
  name: z.string().nullable(),
  proficiency: z.string().nullable(),
});

export const ProfileSchema = z.object({
  profileUrl: z.string(),
  publicIdentifier: z.string().nullable(),
  urn: z.string().nullable(),
  memberUrn: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  fullName: z.string().nullable(),
  headline: z.string().nullable(),
  location: LocationSchema,
  about: z.string().nullable(),
  industry: z.string().nullable(),
  profilePicture: ImageSchema,
  backgroundImage: ImageSchema,
  experience: z.array(ExperienceSchema),
  education: z.array(EducationSchema),
  skills: z.array(SkillSchema),
  certifications: z.array(CertificationSchema),
  languages: z.array(LanguageSchema),
});

export const MetaSchema = z.object({
  scrapedAt: z.string(),
  cached: z.boolean(),
  durationMs: z.number(),
  source: z.literal('voyager'),
  sectionsUnavailable: z.array(z.string()),
});

export const ProfileResponseSchema = z.object({
  data: ProfileSchema,
  meta: MetaSchema,
});

export type Profile = z.infer<typeof ProfileSchema>;
export type ProfileMeta = z.infer<typeof MetaSchema>;
export type ProfileResponse = z.infer<typeof ProfileResponseSchema>;

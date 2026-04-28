import { z } from 'zod'

/**
 * Schema for whistleblower signup application submission
 */
export const createWhistleblowerApplicationSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name must be at most 100 characters')
    .describe('Applicant full name'),
  email: z
    .string()
    .email('Invalid email address')
    .describe('Applicant email address'),
  phone: z
    .string()
    .min(10, 'Phone number must be at least 10 characters')
    .describe('Applicant phone number'),
  address: z
    .string()
    .min(5, 'Address must be at least 5 characters')
    .describe('Current residential address'),
  linkedinProfile: z
    .string()
    .url('LinkedIn profile must be a valid URL')
    .describe('LinkedIn profile URL'),
  facebookProfile: z
    .string()
    .url('Facebook profile must be a valid URL')
    .describe('Facebook profile URL'),
  instagramProfile: z
    .string()
    .url('Instagram profile must be a valid URL')
    .describe('Instagram profile URL'),
})

export type CreateWhistleblowerApplicationRequest = z.infer<
  typeof createWhistleblowerApplicationSchema
>

/**
 * Schema for listing whistleblower applications (admin)
 */
export const listWhistleblowerApplicationsSchema = z.object({
  status: z
    .enum(['pending', 'approved', 'rejected'])
    .optional()
    .describe('Filter by application status'),
  page: z.coerce.number().int().positive().default(1).optional(),
  pageSize: z.coerce.number().int().positive().min(1).max(100).default(20).optional(),
})

export type ListWhistleblowerApplicationsRequest = z.infer<
  typeof listWhistleblowerApplicationsSchema
>

/**
 * Schema for getting a single whistleblower application
 */
export const getWhistleblowerApplicationSchema = z.object({
  applicationId: z.string().uuid().describe('Application ID'),
})

export type GetWhistleblowerApplicationRequest = z.infer<
  typeof getWhistleblowerApplicationSchema
>

/**
 * Schema for approving a whistleblower application
 */
export const approveWhistleblowerApplicationSchema = z.object({
  reviewedBy: z
    .string()
    .min(1, 'Reviewer identifier is required')
    .describe('Admin user ID or email who reviewed the application'),
})

export type ApproveWhistleblowerApplicationRequest = z.infer<
  typeof approveWhistleblowerApplicationSchema
>

/**
 * Schema for rejecting a whistleblower application
 */
export const rejectWhistleblowerApplicationSchema = z.object({
  reviewedBy: z
    .string()
    .min(1, 'Reviewer identifier is required')
    .describe('Admin user ID or email who reviewed the application'),
  reason: z
    .string()
    .min(10, 'Rejection reason must be at least 10 characters')
    .describe('Reason for rejection'),
})

export type RejectWhistleblowerApplicationRequest = z.infer<
  typeof rejectWhistleblowerApplicationSchema
>

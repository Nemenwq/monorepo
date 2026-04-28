import { z } from 'zod'

export const kycDocumentTypeSchema = z.enum(['drivers_license', 'passport', 'national_id', 'voters_card'])

export const kycStatusSchema = z.enum(['pending', 'in_review', 'approved', 'rejected', 'expired'])

export const kycSubmissionSchema = z.object({
  documentType: kycDocumentTypeSchema,
  frontImageKey: z.string().min(1),
  backImageKey: z.string().min(1).optional(),
  livenessSignal: z.string().optional(),
})

export const kycWebhookUpdateSchema = z.object({
  providerId: z.string(),
  externalId: z.string(),
  status: kycStatusSchema,
  reason: z.string().optional(),
  checkedAt: z.string().datetime(),
})

export const kycAdminActionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().optional(),
})

export type KycDocumentType = z.infer<typeof kycDocumentTypeSchema>
export type KycStatus = z.infer<typeof kycStatusSchema>
export type KycSubmission = z.infer<typeof kycSubmissionSchema>
export type KycWebhookUpdate = z.infer<typeof kycWebhookUpdateSchema>
export type KycAdminAction = z.infer<typeof kycAdminActionSchema>

export interface KycRecord {
  id: string
  userId: string
  documentType: KycDocumentType
  frontImageKey: string
  backImageKey: string | null
  livenessSignal: string | null
  status: KycStatus
  providerId: string | null
  externalId: string | null
  rejectionReason: string | null
  reviewedBy: string | null
  createdAt: Date
  updatedAt: Date
  expiresAt: Date | null
}
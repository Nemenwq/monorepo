import { z } from 'zod'

export const paymentDisputeReasonSchema = z.enum([
  'amount_discrepancy',
  'duplicate_charge',
  'service_not_received',
  'early_termination',
  'property_issue',
  'other',
])

export const paymentDisputeStatusSchema = z.enum([
  'pending',
  'under_review',
  'resolved',
  'rejected',
])

export const paymentDisputeCreateSchema = z.object({
  paymentId: z.string().uuid(),
  reason: paymentDisputeReasonSchema,
  description: z.string().min(10).max(1000),
  evidenceKeys: z.array(z.string()).max(5).optional(),
})

export type PaymentDisputeReason = z.infer<typeof paymentDisputeReasonSchema>
export type PaymentDisputeStatus = z.infer<typeof paymentDisputeStatusSchema>
export type PaymentDisputeCreate = z.infer<typeof paymentDisputeCreateSchema>

export interface PaymentDispute {
  id: string
  userId: string
  paymentId: string
  reason: PaymentDisputeReason
  description: string
  evidenceKeys: string[]
  status: PaymentDisputeStatus
  resolution: string | null
  resolvedBy: string | null
  createdAt: Date
  updatedAt: Date
}
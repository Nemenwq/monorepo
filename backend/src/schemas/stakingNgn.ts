import { z } from 'zod'

export const stakingQuoteRequestSchema = z.object({
  amountNgn: z.number().min(100, 'Minimum stake is 100 NGN').max(10000000, 'Maximum stake is 10,000,000 NGN'),
})

export const stakingQuoteResponseSchema = z.object({
  quoteId: z.string(),
  amountNgn: z.number(),
  estimatedUsdc: z.number(),
  fxRate: z.number(),
  fees: z.object({
    conversion: z.number(),
    staking: z.number(),
    total: z.number(),
  }),
  totalUsdcAfterFees: z.number(),
  expiresAt: z.string(),
  createdAt: z.string(),
})

export const stakeNgnRequestSchema = z.object({
  quoteId: z.string(),
})

export const stakeNgnResponseSchema = z.object({
  success: z.boolean(),
  stakeId: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  timeline: z.array(z.object({
    step: z.string(),
    status: z.enum(['pending', 'completed', 'failed']),
    timestamp: z.string().nullable(),
    description: z.string(),
  })),
  amountNgn: z.number(),
  estimatedUsdc: z.number(),
  createdAt: z.string(),
})

export const stakingStatusResponseSchema = z.object({
  stakeId: z.string(),
  status: z.enum(['ngn_reserved', 'conversion_processing', 'usdc_staked', 'receipt_recorded', 'failed']),
  timeline: z.array(z.object({
    step: z.string(),
    status: z.enum(['pending', 'completed', 'failed']),
    timestamp: z.string().nullable(),
    description: z.string(),
  })),
  amountNgn: z.number(),
  amountUsdc: z.number().nullable(),
  txHash: z.string().nullable(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
})

export type StakingQuoteRequest = z.infer<typeof stakingQuoteRequestSchema>
export type StakingQuoteResponse = z.infer<typeof stakingQuoteResponseSchema>
export type StakeNgnRequest = z.infer<typeof stakeNgnRequestSchema>
export type StakeNgnResponse = z.infer<typeof stakeNgnResponseSchema>
export type StakingStatusResponse = z.infer<typeof stakingStatusResponseSchema>

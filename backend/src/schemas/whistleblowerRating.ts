import { z } from 'zod'

const emptyStringToUndefined = (value: unknown) => {
  if (typeof value === 'string' && value.trim() === '') return undefined
  return value
}

export const createWhistleblowerRatingSchema = z.object({
  whistleblowerId: z.string().min(1, 'Whistleblower ID is required'),
  dealId: z.string().min(1, 'Deal ID is required'),
  rating: z
    .number()
    .int('Rating must be an integer')
    .min(1, 'Rating must be between 1 and 5')
    .max(5, 'Rating must be between 1 and 5'),
  reviewText: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().max(2000, 'Review text is too long').optional(),
  ),
})

export const listWhistleblowerRatingsQuerySchema = z.object({
  limit: z
    .preprocess((v) => (v === undefined ? undefined : Number(v)), z.number().int().min(1).max(100))
    .optional(),
})

export type CreateWhistleblowerRatingRequest = z.infer<typeof createWhistleblowerRatingSchema>
export type ListWhistleblowerRatingsQuery = z.infer<typeof listWhistleblowerRatingsQuerySchema>


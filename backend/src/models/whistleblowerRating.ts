export type WhistleblowerRating = {
  ratingId: string
  whistleblowerId: string
  tenantId: string
  dealId: string
  rating: number
  reviewText?: string
  createdAt: Date
}

export type CreateWhistleblowerRatingInput = {
  whistleblowerId: string
  tenantId: string
  dealId: string
  rating: number
  reviewText?: string
}

export type WhistleblowerRatingAggregate = {
  whistleblowerId: string
  count: number
  average: number
  breakdown: Record<1 | 2 | 3 | 4 | 5, number>
}


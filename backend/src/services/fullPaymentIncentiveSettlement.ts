import { dealStore } from '../models/dealStore.js'
import { listingStore } from '../models/listingStore.js'
import { settlementLedgerStore } from '../models/settlementLedgerStore.js'
import { computeFullPaymentSplit } from './fullPaymentSplit.js'

export type FullPaymentIncentiveSettlementResult = {
  dealId: string
  platformAmountNgn: number
  reporterAmountNgn: number
  landlordNetAmountNgn: number
  splitConfigVersion: string
  reporterApplied: boolean
  reporterId?: string
}

export async function settleFullPaymentIncentive(params: {
  dealId: string
  grossAmountNgn: number
}): Promise<FullPaymentIncentiveSettlementResult | null> {
  const { dealId, grossAmountNgn } = params

  const deal = await dealStore.findById(dealId)
  if (!deal) return null

  // Guard: apply only for payment-in-full events (covers financed amount)
  if (grossAmountNgn < deal.financedAmountNgn) {
    return null
  }

  const listing = deal.listingId ? await listingStore.getById(deal.listingId) : null
  const reporterId = listing?.whistleblowerId
  const reporterApplied = typeof reporterId === 'string' && reporterId.trim() !== ''

  const split = computeFullPaymentSplit({ grossAmountNgn, reporterApplied })

  await settlementLedgerStore.insertMany([
    {
      dealId,
      eventType: 'full_payment_incentive',
      beneficiaryType: 'platform',
      amountNgn: split.platformAmountNgn,
      currency: 'NGN',
      rationale: 'Full payment incentive platform share',
      splitConfigVersion: split.config.version,
      splitConfigSnapshot: {
        platformShare: split.config.platformShare,
        reporterShare: split.config.reporterShare,
        reporterApplied,
      },
    },
    ...(reporterApplied
      ? [
          {
            dealId,
            eventType: 'full_payment_incentive' as const,
            beneficiaryType: 'reporter' as const,
            beneficiaryId: reporterId,
            amountNgn: split.reporterAmountNgn,
            currency: 'NGN' as const,
            rationale: 'Full payment incentive reporter share',
            splitConfigVersion: split.config.version,
            splitConfigSnapshot: {
              platformShare: split.config.platformShare,
              reporterShare: split.config.reporterShare,
              reporterApplied,
            },
          },
        ]
      : []),
    {
      dealId,
      eventType: 'full_payment_incentive',
      beneficiaryType: 'landlord',
      beneficiaryId: deal.landlordId,
      amountNgn: split.landlordNetAmountNgn,
      currency: 'NGN',
      rationale: 'Full payment incentive landlord net amount',
      splitConfigVersion: split.config.version,
      splitConfigSnapshot: {
        platformShare: split.config.platformShare,
        reporterShare: split.config.reporterShare,
        reporterApplied,
      },
    },
  ])

  return {
    dealId,
    platformAmountNgn: split.platformAmountNgn,
    reporterAmountNgn: split.reporterAmountNgn,
    landlordNetAmountNgn: split.landlordNetAmountNgn,
    splitConfigVersion: split.config.version,
    reporterApplied,
    reporterId: reporterApplied ? reporterId : undefined,
  }
}

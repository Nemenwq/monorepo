import { env } from '../schemas/env.js'

export type FullPaymentSplitConfig = {
  version: string
  platformShare: number
  reporterShare: number
}

export type FullPaymentSplitResult = {
  config: FullPaymentSplitConfig
  grossAmountNgn: number
  platformAmountNgn: number
  reporterAmountNgn: number
  landlordNetAmountNgn: number
  reporterApplied: boolean
}

function roundNgn(value: number): number {
  // Deterministic integer rounding for NGN amounts
  return Math.round(value)
}

export function getFullPaymentSplitConfig(): FullPaymentSplitConfig {
  return {
    version: env.FULL_PAYMENT_SPLIT_VERSION,
    platformShare: env.FULL_PAYMENT_PLATFORM_SHARE,
    reporterShare: env.FULL_PAYMENT_REPORTER_SHARE,
  }
}

export function computeFullPaymentSplit(params: {
  grossAmountNgn: number
  reporterApplied: boolean
}): FullPaymentSplitResult {
  const { grossAmountNgn, reporterApplied } = params
  const config = getFullPaymentSplitConfig()

  if (!Number.isFinite(grossAmountNgn) || grossAmountNgn <= 0) {
    throw new Error('grossAmountNgn must be a positive number')
  }

  const platformAmountNgn = roundNgn(grossAmountNgn * config.platformShare)
  const reporterAmountNgn = reporterApplied ? roundNgn(grossAmountNgn * config.reporterShare) : 0

  const landlordNetAmountNgn = grossAmountNgn - platformAmountNgn - reporterAmountNgn

  if (landlordNetAmountNgn < 0) {
    throw new Error('Split resulted in negative landlord net amount')
  }

  return {
    config,
    grossAmountNgn,
    platformAmountNgn,
    reporterAmountNgn,
    landlordNetAmountNgn,
    reporterApplied,
  }
}

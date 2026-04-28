export type SettlementLedgerBeneficiaryType = 'platform' | 'reporter' | 'landlord'

export type SettlementLedgerEventType = 'full_payment_incentive'

export type SettlementLedgerEntry = {
  entryId: string
  dealId: string
  eventType: SettlementLedgerEventType
  beneficiaryType: SettlementLedgerBeneficiaryType
  beneficiaryId?: string
  amountNgn: number
  currency: 'NGN'
  rationale: string
  splitConfigVersion: string
  splitConfigSnapshot: {
    platformShare: number
    reporterShare: number
    reporterApplied: boolean
  }
  createdAt: Date
}

export type CreateSettlementLedgerEntryInput = Omit<SettlementLedgerEntry, 'entryId' | 'createdAt'>

import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('computeFullPaymentSplit', () => {
  beforeEach(() => {
    process.env.FULL_PAYMENT_SPLIT_VERSION = 'test-v1'
    process.env.FULL_PAYMENT_PLATFORM_SHARE = '0.1'
    process.env.FULL_PAYMENT_REPORTER_SHARE = '0.05'
    vi.resetModules()
  })

  it('computes deterministic split with reporter applied', async () => {
    const mod = await import('./fullPaymentSplit.js')
    const out = mod.computeFullPaymentSplit({ grossAmountNgn: 1000, reporterApplied: true })
    expect(out.platformAmountNgn).toBe(100)
    expect(out.reporterAmountNgn).toBe(50)
    expect(out.landlordNetAmountNgn).toBe(850)
    expect(out.config.version).toBe('test-v1')
  })

  it('guards reporter payout when reporter is not applied', async () => {
    const mod = await import('./fullPaymentSplit.js')
    const out = mod.computeFullPaymentSplit({ grossAmountNgn: 1000, reporterApplied: false })
    expect(out.platformAmountNgn).toBe(100)
    expect(out.reporterAmountNgn).toBe(0)
    expect(out.landlordNetAmountNgn).toBe(900)
  })

  it('throws on non-positive amount', async () => {
    const mod = await import('./fullPaymentSplit.js')
    expect(() => mod.computeFullPaymentSplit({ grossAmountNgn: 0, reporterApplied: true })).toThrow()
  })
})

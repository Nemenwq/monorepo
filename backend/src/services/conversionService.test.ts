import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../utils/cache.js', () => ({
  conversionCache: {
    get: vi.fn(async () => null),
    set: vi.fn(async () => {}),
  },
}))

import { ConversionService } from './conversionService.js'
import { HttpConversionProvider, StubConversionProvider } from './conversionProvider.js'
import { conversionStore } from '../models/conversionStore.js'
import { outboxStore, TxType } from '../outbox/index.js'

vi.mock('../utils/token.js', () => ({
  getUsdcTokenAddress: () => '0x0000000000000000000000000000000000000000',
}))

describe('ConversionService conversion receipts', () => {
  beforeEach(async () => {
    await conversionStore.clear()
    await outboxStore.clear()
  })

  it('creates a CONVERSION outbox item exactly once for duplicate convertDeposit calls', async () => {
    const provider = new StubConversionProvider(1600)
    const service = new ConversionService(provider, 'onramp')

    const a = await service.convertDeposit({
      depositId: 'dep-1',
      userId: 'user-1',
      amountNgn: 1600,
    })

    const b = await service.convertDeposit({
      depositId: 'dep-1',
      userId: 'user-1',
      amountNgn: 1600,
    })

    expect(a.conversionId).toBe(b.conversionId)

    const items = await outboxStore.listByDealId('conversion', TxType.CONVERSION)
    expect(items).toHaveLength(1)

    expect(items[0].txType).toBe(TxType.CONVERSION)
    expect(String(items[0].payload.txType)).toBe(TxType.CONVERSION)
    expect(String(items[0].payload.conversionProviderRef)).toBe(a.providerRef)
  })

  it('ensures CONVERSION outbox exists when conversion is already completed before calling convertDeposit again', async () => {
    const provider = new StubConversionProvider(1600)
    const service = new ConversionService(provider, 'onramp')

    const conversion = await service.convertDeposit({
      depositId: 'dep-2',
      userId: 'user-2',
      amountNgn: 1600,
    })

    await outboxStore.clear()

    const again = await service.convertDeposit({
      depositId: 'dep-2',
      userId: 'user-2',
      amountNgn: 1600,
    })

    expect(again.conversionId).toBe(conversion.conversionId)

    const items = await outboxStore.listByDealId('conversion', TxType.CONVERSION)
    expect(items).toHaveLength(1)
    expect(String(items[0].payload.conversionId)).toBe(conversion.conversionId)
  })

  it('convertDeposit persists HTTP provider rate and providerRef', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ fxRateNgnPerUsdc: 2000, providerRef: 'quote-live-1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const provider = new HttpConversionProvider({
      rateUrl: 'https://rates.test/r',
      timeoutMs: 5_000,
      minRate: 1,
      maxRate: 50_000,
      fetchFn,
    })
    const service = new ConversionService(provider, 'onramp')

    const conv = await service.convertDeposit({
      depositId: 'dep-http-1',
      userId: 'user-http',
      amountNgn: 4000,
    })

    expect(conv.fxRateNgnPerUsdc).toBe(2000)
    expect(conv.amountUsdc).toBe('2.000000')
    expect(conv.providerRef).toBe('quote-live-1')
  })
})

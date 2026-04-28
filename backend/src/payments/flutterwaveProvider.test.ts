/**
 * flutterwaveProvider.test.ts
 *
 * Unit tests for the FlutterwaveProvider adapter.
 * All outbound HTTP calls are intercepted via vi.spyOn(globalThis, 'fetch').
 */

import crypto from 'node:crypto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { FlutterwaveProvider } from './flutterwaveProvider.js'
import { AppError } from '../errors/AppError.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetch(body: unknown, ok = true, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

function makeReq(
  headers: Record<string, string> = {},
  body: unknown = {},
  rawBody?: string,
) {
  return {
    headers,
    body,
    rawBody: rawBody ?? JSON.stringify(body),
  } as any
}

function flwHmac(secret: string, payload: string): string {
  return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex')
}

// ---------------------------------------------------------------------------

describe('FlutterwaveProvider', () => {
  let provider: FlutterwaveProvider
  const originalEnv = { ...process.env }

  beforeEach(() => {
    provider = new FlutterwaveProvider()
    process.env.FLUTTERWAVE_SECRET = 'FLWSECK_test_abc123'
    process.env.FLUTTERWAVE_BASE_URL = 'https://api.flutterwave.com/v3'
    delete process.env.WEBHOOK_SIGNATURE_ENABLED
    delete process.env.NODE_ENV
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = { ...originalEnv }
  })

  // ── initiatePayment ──────────────────────────────────────────────────────

  describe('initiatePayment', () => {
    it('calls Flutterwave /payments and returns correct shape', async () => {
      mockFetch({
        status: 'success',
        data: { link: 'https://checkout.flutterwave.com/v3/hosted/pay/abc' },
      })

      const result = await provider.initiatePayment({
        amountNgn: 10000,
        userId: 'user-456',
        internalRef: 'flw-ref-001',
        rail: 'flutterwave',
        customerMeta: { email: 'pay@test.com', name: 'Pay User' },
      })

      expect(result.externalRefSource).toBe('flutterwave')
      expect(result.externalRef).toBe('flw-ref-001') // tx_ref = internalRef
      expect(result.redirectUrl).toBe('https://checkout.flutterwave.com/v3/hosted/pay/abc')
    })

    it('sends amount in NGN (no kobo conversion)', async () => {
      const spy = mockFetch({
        status: 'success',
        data: { link: 'https://checkout.flutterwave.com/v3/hosted/pay/x' },
      })

      await provider.initiatePayment({
        amountNgn: 7500.5,
        userId: 'u',
        internalRef: 'r',
        rail: 'flutterwave',
      })

      const callBody = JSON.parse(spy.mock.calls[0]![1]!.body as string)
      expect(callBody.amount).toBe(7500.5) // raw NGN, not kobo
      expect(callBody.currency).toBe('NGN')
    })

    it('uses placeholder email when customerMeta.email is absent', async () => {
      const spy = mockFetch({
        status: 'success',
        data: { link: 'https://u' },
      })

      await provider.initiatePayment({
        amountNgn: 500,
        userId: 'no-email-user',
        internalRef: 'r',
        rail: 'flutterwave',
      })

      const callBody = JSON.parse(spy.mock.calls[0]![1]!.body as string)
      expect(callBody.customer.email).toBe('no-email-user@quipay.internal')
    })

    it('throws PAYMENT_PROVIDER_ERROR 502 on FLW API failure', async () => {
      mockFetch(
        { status: 'error', message: 'Unauthorized', data: null },
        false,
        401,
      )

      await expect(
        provider.initiatePayment({
          amountNgn: 100,
          userId: 'u',
          internalRef: 'r',
          rail: 'flutterwave',
        }),
      ).rejects.toMatchObject({ code: 'PAYMENT_PROVIDER_ERROR', status: 502 })
    })

    it('throws INTERNAL_ERROR 500 when FLUTTERWAVE_SECRET is missing', async () => {
      delete process.env.FLUTTERWAVE_SECRET

      await expect(
        provider.initiatePayment({
          amountNgn: 100,
          userId: 'u',
          internalRef: 'r',
          rail: 'flutterwave',
        }),
      ).rejects.toMatchObject({ code: 'INTERNAL_ERROR', status: 500 })
    })
  })

  // ── verifyPayment ────────────────────────────────────────────────────────

  describe('verifyPayment', () => {
    it('maps FLW "successful" status → confirmed', async () => {
      mockFetch({
        status: 'success',
        data: [{ status: 'successful', tx_ref: 'flw-ref-001', id: 1 }],
      })

      const result = await provider.verifyPayment({
        externalRefSource: 'flutterwave',
        externalRef: 'flw-ref-001',
      })

      expect(result.status).toBe('confirmed')
      expect(result.providerStatus).toBe('successful')
    })

    it('maps FLW "failed" status → failed', async () => {
      mockFetch({
        status: 'success',
        data: [{ status: 'failed', tx_ref: 'ref', id: 2 }],
      })

      const result = await provider.verifyPayment({
        externalRefSource: 'flutterwave',
        externalRef: 'ref',
      })

      expect(result.status).toBe('failed')
    })

    it('maps FLW "pending" status → pending', async () => {
      mockFetch({
        status: 'success',
        data: [{ status: 'pending', tx_ref: 'ref', id: 3 }],
      })

      const result = await provider.verifyPayment({
        externalRefSource: 'flutterwave',
        externalRef: 'ref',
      })

      expect(result.status).toBe('pending')
    })

    it('maps FLW "reversed" status → reversed', async () => {
      mockFetch({
        status: 'success',
        data: [{ status: 'reversed', tx_ref: 'ref', id: 4 }],
      })

      const result = await provider.verifyPayment({
        externalRefSource: 'flutterwave',
        externalRef: 'ref',
      })

      expect(result.status).toBe('reversed')
    })

    it('returns pending when no transactions found', async () => {
      mockFetch({ status: 'success', data: [] })

      const result = await provider.verifyPayment({
        externalRefSource: 'flutterwave',
        externalRef: 'nonexistent',
      })

      expect(result.status).toBe('pending')
      expect(result.providerStatus).toBe('not_found')
    })

    it('throws 502 on FLW API error', async () => {
      mockFetch({ status: 'error', message: 'Error', data: null }, false, 500)

      await expect(
        provider.verifyPayment({ externalRefSource: 'flutterwave', externalRef: 'r' }),
      ).rejects.toMatchObject({ code: 'PAYMENT_PROVIDER_ERROR', status: 502 })
    })
  })

  // ── parseAndValidateWebhook ──────────────────────────────────────────────

  describe('parseAndValidateWebhook', () => {
    beforeEach(() => {
      process.env.FLUTTERWAVE_SECRET = 'flw_webhook_secret'
      process.env.WEBHOOK_SIGNATURE_ENABLED = 'true'
    })

    it('parses a valid charge.completed webhook', async () => {
      const body = {
        event: 'charge.completed',
        data: { tx_ref: 'flw-ref-002', status: 'successful' },
      }
      const rawBody = JSON.stringify(body)
      const sig = flwHmac('flw_webhook_secret', rawBody)

      const req = makeReq({ 'verif-hash': sig }, body, rawBody)
      const result = await provider.parseAndValidateWebhook(req)

      expect(result.externalRefSource).toBe('flutterwave')
      expect(result.externalRef).toBe('flw-ref-002')
      expect(result.rawStatus).toBe('charge.completed')
      expect(result.providerStatus).toBe('successful')
    })

    it('parses a valid transfer.reversed webhook', async () => {
      const body = {
        event: 'transfer.reversed',
        data: { tx_ref: 'flw-ref-003', status: 'reversed' },
      }
      const rawBody = JSON.stringify(body)
      const sig = flwHmac('flw_webhook_secret', rawBody)

      const req = makeReq({ 'verif-hash': sig }, body, rawBody)
      const result = await provider.parseAndValidateWebhook(req)

      expect(result.rawStatus).toBe('transfer.reversed')
    })

    it('throws 401 when verif-hash is invalid', async () => {
      const body = { event: 'charge.completed', data: { tx_ref: 'r' } }
      const req = makeReq({ 'verif-hash': 'bad_hash' }, body)

      await expect(provider.parseAndValidateWebhook(req)).rejects.toMatchObject({
        status: 401,
      })
    })

    it('throws 400 when event field is missing', async () => {
      const body = { data: { tx_ref: 'r' } }
      const rawBody = JSON.stringify(body)
      const sig = flwHmac('flw_webhook_secret', rawBody)
      const req = makeReq({ 'verif-hash': sig }, body, rawBody)

      await expect(provider.parseAndValidateWebhook(req)).rejects.toMatchObject({
        status: 400,
      })
    })

    it('throws 400 when tx_ref is missing', async () => {
      const body = { event: 'charge.completed', data: {} }
      const rawBody = JSON.stringify(body)
      const sig = flwHmac('flw_webhook_secret', rawBody)
      const req = makeReq({ 'verif-hash': sig }, body, rawBody)

      await expect(provider.parseAndValidateWebhook(req)).rejects.toMatchObject({
        status: 400,
      })
    })
  })

  // ── mapStatus ────────────────────────────────────────────────────────────

  describe('mapStatus', () => {
    it.each([
      ['charge.completed', undefined, 'confirmed'],
      ['charge.failed', undefined, 'failed'],
      ['transfer.completed', undefined, 'confirmed'],
      ['transfer.failed', undefined, 'failed'],
      ['transfer.reversed', undefined, 'reversed'],
    ] as const)('maps event "%s" → %s', (rawStatus, providerStatus, expected) => {
      expect(provider.mapStatus({ rawStatus, providerStatus })).toBe(expected)
    })

    it('uses providerStatus when rawStatus is unrecognised', () => {
      expect(
        provider.mapStatus({ rawStatus: 'unknown.flw.event', providerStatus: 'reversed' }),
      ).toBe('reversed')
    })

    it('falls back to confirmed for fully unknown inputs', () => {
      expect(provider.mapStatus({ rawStatus: 'something_else' })).toBe('confirmed')
    })

    it('maps successful providerStatus → confirmed', () => {
      expect(
        provider.mapStatus({ rawStatus: 'unknown', providerStatus: 'successful' }),
      ).toBe('confirmed')
    })
  })

  // ── executePayout ────────────────────────────────────────────────────────

  describe('executePayout', () => {
    it('initiates FLW bank transfer and returns confirmed on "NEW" status', async () => {
      mockFetch({
        status: 'success',
        data: { id: 1, status: 'NEW', reference: 'po-flw-001' },
      })

      const result = await provider.executePayout!({
        amountNgn: 15000,
        userId: 'user-flw-payout',
        internalRef: 'po-flw-001',
        bankAccount: {
          accountNumber: '0987654321',
          accountName: 'Jane Smith',
          bankName: '044', // FLW bank code
        },
        rail: 'flutterwave',
      })

      expect(result.externalRefSource).toBe('flutterwave')
      expect(result.externalRef).toBe('po-flw-001')
      expect(result.status).toBe('confirmed')
      expect(result.providerStatus).toBe('NEW')
    })

    it('returns confirmed on "success" transfer status', async () => {
      mockFetch({
        status: 'success',
        data: { id: 2, status: 'success', reference: 'po-flw-002' },
      })

      const result = await provider.executePayout!({
        amountNgn: 5000,
        userId: 'u',
        internalRef: 'po-flw-002',
        bankAccount: { accountNumber: '01', accountName: 'A', bankName: '058' },
        rail: 'flutterwave',
      })

      expect(result.status).toBe('confirmed')
    })

    it('returns failed when transfer status is FAILED', async () => {
      mockFetch({
        status: 'success',
        data: { id: 3, status: 'FAILED', reference: 'po-flw-003' },
      })

      const result = await provider.executePayout!({
        amountNgn: 1000,
        userId: 'u',
        internalRef: 'po-flw-003',
        bankAccount: { accountNumber: '01', accountName: 'A', bankName: '058' },
        rail: 'flutterwave',
      })

      expect(result.status).toBe('failed')
    })

    it('sends amount as raw NGN (no kobo conversion)', async () => {
      const spy = mockFetch({
        status: 'success',
        data: { id: 4, status: 'NEW', reference: 'r' },
      })

      await provider.executePayout!({
        amountNgn: 2500,
        userId: 'u',
        internalRef: 'r',
        bankAccount: { accountNumber: '01', accountName: 'A', bankName: '058' },
        rail: 'flutterwave',
      })

      const callBody = JSON.parse(spy.mock.calls[0]![1]!.body as string)
      expect(callBody.amount).toBe(2500) // raw NGN
    })

    it('throws PAYMENT_PROVIDER_ERROR when FLW API rejects the transfer', async () => {
      mockFetch(
        { status: 'error', message: 'Insufficient balance', data: null },
        false,
        400,
      )

      await expect(
        provider.executePayout!({
          amountNgn: 1000000,
          userId: 'u',
          internalRef: 'r',
          bankAccount: { accountNumber: '01', accountName: 'A', bankName: '058' },
          rail: 'flutterwave',
        }),
      ).rejects.toMatchObject({ code: 'PAYMENT_PROVIDER_ERROR' })
    })
  })
})

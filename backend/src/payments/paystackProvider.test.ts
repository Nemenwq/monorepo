/**
 * paystackProvider.test.ts
 *
 * Unit tests for the PaystackProvider adapter.
 * All outbound HTTP calls are intercepted via vi.spyOn(globalThis, 'fetch').
 */

import crypto from 'node:crypto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PaystackProvider } from './paystackProvider.js'
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

function paystackHmac(secret: string, payload: string): string {
  return crypto.createHmac('sha512', secret).update(payload, 'utf8').digest('hex')
}

// ---------------------------------------------------------------------------

describe('PaystackProvider', () => {
  let provider: PaystackProvider
  const originalEnv = { ...process.env }

  beforeEach(() => {
    provider = new PaystackProvider()
    process.env.PAYSTACK_SECRET = 'sk_test_abc123'
    process.env.PAYSTACK_BASE_URL = 'https://api.paystack.co'
    // Disable signature validation except where explicitly tested
    delete process.env.WEBHOOK_SIGNATURE_ENABLED
    delete process.env.NODE_ENV
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = { ...originalEnv }
  })

  // ── initiatePayment ──────────────────────────────────────────────────────

  describe('initiatePayment', () => {
    it('calls Paystack /transaction/initialize and returns correct shape', async () => {
      mockFetch({
        status: true,
        message: 'Authorization URL created',
        data: {
          authorization_url: 'https://checkout.paystack.com/xyz',
          access_code: 'acc_xyz',
          reference: 'txn-internal-001',
        },
      })

      const result = await provider.initiatePayment({
        amountNgn: 5000,
        userId: 'user-123',
        internalRef: 'txn-internal-001',
        rail: 'paystack',
        customerMeta: { email: 'user@example.com', name: 'Test User' },
      })

      expect(result.externalRefSource).toBe('paystack')
      expect(result.externalRef).toBe('txn-internal-001')
      expect(result.redirectUrl).toBe('https://checkout.paystack.com/xyz')
    })

    it('converts NGN to kobo (×100) when posting to Paystack', async () => {
      const spy = mockFetch({
        status: true,
        data: { authorization_url: 'https://checkout.paystack.com/y', access_code: 'a', reference: 'ref' },
      })

      await provider.initiatePayment({
        amountNgn: 1500,
        userId: 'u',
        internalRef: 'ref',
        rail: 'paystack',
      })

      const callBody = JSON.parse(spy.mock.calls[0]![1]!.body as string)
      expect(callBody.amount).toBe(150000) // 1500 NGN × 100 kobo
    })

    it('uses placeholder email when customerMeta.email is absent', async () => {
      const spy = mockFetch({
        status: true,
        data: { authorization_url: 'u', access_code: 'a', reference: 'r' },
      })

      await provider.initiatePayment({
        amountNgn: 100,
        userId: 'user-no-email',
        internalRef: 'r',
        rail: 'paystack',
      })

      const callBody = JSON.parse(spy.mock.calls[0]![1]!.body as string)
      expect(callBody.email).toBe('user-no-email@quipay.internal')
    })

    it('throws PAYMENT_PROVIDER_ERROR 502 on Paystack API failure', async () => {
      mockFetch(
        { status: false, message: 'Invalid key', data: null },
        false,
        401,
      )

      await expect(
        provider.initiatePayment({
          amountNgn: 100,
          userId: 'u',
          internalRef: 'r',
          rail: 'paystack',
        }),
      ).rejects.toMatchObject({ code: 'PAYMENT_PROVIDER_ERROR', status: 502 })
    })

    it('throws INTERNAL_ERROR 500 when PAYSTACK_SECRET is missing', async () => {
      delete process.env.PAYSTACK_SECRET

      await expect(
        provider.initiatePayment({
          amountNgn: 100,
          userId: 'u',
          internalRef: 'r',
          rail: 'paystack',
        }),
      ).rejects.toMatchObject({ code: 'INTERNAL_ERROR', status: 500 })
    })
  })

  // ── verifyPayment ────────────────────────────────────────────────────────

  describe('verifyPayment', () => {
    it('maps Paystack "success" status → confirmed', async () => {
      mockFetch({
        status: true,
        data: { status: 'success', gateway_response: 'Successful' },
      })

      const result = await provider.verifyPayment({
        externalRefSource: 'paystack',
        externalRef: 'ref-001',
      })

      expect(result.status).toBe('confirmed')
      expect(result.providerStatus).toBe('success')
    })

    it('maps Paystack "failed" status → failed', async () => {
      mockFetch({
        status: true,
        data: { status: 'failed', gateway_response: 'Declined' },
      })

      const result = await provider.verifyPayment({
        externalRefSource: 'paystack',
        externalRef: 'ref-002',
      })

      expect(result.status).toBe('failed')
    })

    it('maps Paystack "abandoned" status → failed', async () => {
      mockFetch({
        status: true,
        data: { status: 'abandoned' },
      })

      const result = await provider.verifyPayment({
        externalRefSource: 'paystack',
        externalRef: 'ref-003',
      })

      expect(result.status).toBe('failed')
    })

    it('maps Paystack "reversed" status → reversed', async () => {
      mockFetch({
        status: true,
        data: { status: 'reversed' },
      })

      const result = await provider.verifyPayment({
        externalRefSource: 'paystack',
        externalRef: 'ref-004',
      })

      expect(result.status).toBe('reversed')
    })

    it('returns pending for unknown Paystack status', async () => {
      mockFetch({
        status: true,
        data: { status: 'ongoing' },
      })

      const result = await provider.verifyPayment({
        externalRefSource: 'paystack',
        externalRef: 'ref-005',
      })

      expect(result.status).toBe('pending')
    })

    it('throws 502 on Paystack API error', async () => {
      mockFetch({ status: false, message: 'Not found', data: null }, false, 404)

      await expect(
        provider.verifyPayment({ externalRefSource: 'paystack', externalRef: 'bad' }),
      ).rejects.toMatchObject({ code: 'PAYMENT_PROVIDER_ERROR', status: 502 })
    })
  })

  // ── parseAndValidateWebhook ──────────────────────────────────────────────

  describe('parseAndValidateWebhook', () => {
    beforeEach(() => {
      process.env.PAYSTACK_SECRET = 'webhook_secret'
      process.env.WEBHOOK_SIGNATURE_ENABLED = 'true'
    })

    it('parses a valid charge.success webhook', async () => {
      const body = {
        event: 'charge.success',
        data: { reference: 'ref-pay-001', status: 'success' },
      }
      const rawBody = JSON.stringify(body)
      const sig = paystackHmac('webhook_secret', rawBody)

      const req = makeReq({ 'x-paystack-signature': sig }, body, rawBody)

      const result = await provider.parseAndValidateWebhook(req)

      expect(result.externalRefSource).toBe('paystack')
      expect(result.externalRef).toBe('ref-pay-001')
      expect(result.rawStatus).toBe('charge.success')
      expect(result.providerStatus).toBe('success')
      expect(result.providerEventId).toMatch(/^[a-f0-9]{64}$/) // hash when root id omitted
    })

    it('uses root id as providerEventId when present', async () => {
      const body = {
        id: 99_000_000,
        event: 'charge.success',
        data: { reference: 'ref-pay-ida', status: 'success' },
      }
      const rawBody = JSON.stringify(body)
      const sig = paystackHmac('webhook_secret', rawBody)
      const req = makeReq({ 'x-paystack-signature': sig }, body, rawBody)
      const result = await provider.parseAndValidateWebhook(req)
      expect(result.providerEventId).toBe('99000000')
    })

    it('parses a valid charge.failed webhook', async () => {
      const body = {
        event: 'charge.failed',
        data: { reference: 'ref-pay-002', status: 'failed' },
      }
      const rawBody = JSON.stringify(body)
      const sig = paystackHmac('webhook_secret', rawBody)

      const req = makeReq({ 'x-paystack-signature': sig }, body, rawBody)
      const result = await provider.parseAndValidateWebhook(req)

      expect(result.rawStatus).toBe('charge.failed')
    })

    it('throws 401 when signature is invalid', async () => {
      const body = { event: 'charge.success', data: { reference: 'r' } }
      const req = makeReq({ 'x-paystack-signature': 'wrong' }, body)

      await expect(provider.parseAndValidateWebhook(req)).rejects.toMatchObject({
        status: 401,
      })
    })

    it('throws 400 when event field is missing', async () => {
      const body = { data: { reference: 'r' } }
      const rawBody = JSON.stringify(body)
      const sig = paystackHmac('webhook_secret', rawBody)
      const req = makeReq({ 'x-paystack-signature': sig }, body, rawBody)

      await expect(provider.parseAndValidateWebhook(req)).rejects.toMatchObject({
        status: 400,
      })
    })

    it('throws 400 when reference field is missing', async () => {
      const body = { event: 'charge.success', data: {} }
      const rawBody = JSON.stringify(body)
      const sig = paystackHmac('webhook_secret', rawBody)
      const req = makeReq({ 'x-paystack-signature': sig }, body, rawBody)

      await expect(provider.parseAndValidateWebhook(req)).rejects.toMatchObject({
        status: 400,
      })
    })
  })

  // ── mapStatus ────────────────────────────────────────────────────────────

  describe('mapStatus', () => {
    it.each([
      ['charge.success', undefined, 'confirmed'],
      ['charge.failed', undefined, 'failed'],
      ['charge.dispute.create', undefined, 'reversed'],
      ['charge.dispute.resolve', undefined, 'confirmed'],
      ['transfer.reversed', undefined, 'reversed'],
      ['transfer.failed', undefined, 'failed'],
      ['transfer.success', undefined, 'confirmed'],
    ] as const)('maps event "%s" → %s', (rawStatus, providerStatus, expected) => {
      expect(provider.mapStatus({ rawStatus, providerStatus })).toBe(expected)
    })

    it('uses providerStatus when rawStatus is unrecognised', () => {
      expect(provider.mapStatus({ rawStatus: 'unknown.event', providerStatus: 'reversed' })).toBe(
        'reversed',
      )
    })

    it('falls back to confirmed for fully unknown inputs', () => {
      expect(provider.mapStatus({ rawStatus: 'something_else' })).toBe('confirmed')
    })
  })

  // ── executePayout ────────────────────────────────────────────────────────

  describe('executePayout', () => {
    it('creates recipient then initiates transfer and returns confirmed on success', async () => {
      // First call: POST /transferrecipient
      mockFetch({
        status: true,
        data: { recipient_code: 'RCP_abc123' },
      })
      // Second call: POST /transfer
      mockFetch({
        status: true,
        data: {
          transfer_code: 'TRF_xyz789',
          status: 'success',
          reference: 'po-internal-001',
        },
      })

      const result = await provider.executePayout!({
        amountNgn: 20000,
        userId: 'user-payout',
        internalRef: 'po-internal-001',
        bankAccount: {
          accountNumber: '0123456789',
          accountName: 'John Doe',
          bankName: '058', // FLW/Paystack bank code
        },
        rail: 'paystack',
      })

      expect(result.externalRefSource).toBe('paystack')
      expect(result.externalRef).toBe('po-internal-001')
      expect(result.status).toBe('confirmed')
      expect(result.providerStatus).toBe('success')
    })

    it('returns failed when transfer status is not success/otp', async () => {
      mockFetch({ status: true, data: { recipient_code: 'RCP_x' } })
      mockFetch({
        status: true,
        data: { transfer_code: 'TRF_y', status: 'failed', reference: 'ref' },
      })

      const result = await provider.executePayout!({
        amountNgn: 5000,
        userId: 'u',
        internalRef: 'ref',
        bankAccount: { accountNumber: '01', accountName: 'A', bankName: '058' },
        rail: 'paystack',
      })

      expect(result.status).toBe('failed')
    })

    it('throws PAYMENT_PROVIDER_ERROR when recipient creation fails', async () => {
      mockFetch({ status: false, message: 'Bank not found', data: null }, false, 400)

      await expect(
        provider.executePayout!({
          amountNgn: 1000,
          userId: 'u',
          internalRef: 'r',
          bankAccount: { accountNumber: '01', accountName: 'A', bankName: 'bad' },
          rail: 'paystack',
        }),
      ).rejects.toMatchObject({ code: 'PAYMENT_PROVIDER_ERROR' })
    })

    it('converts NGN to kobo when posting the transfer', async () => {
      // Two fetches happen: (1) POST /transferrecipient, (2) POST /transfer
      // We spy on the global fetch once and inspect both calls via mock.calls.
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ status: true, data: { recipient_code: 'RCP_k' } }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ status: true, data: { transfer_code: 'TRF_k', status: 'success', reference: 'r' } }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )

      await provider.executePayout!({
        amountNgn: 3000,
        userId: 'u',
        internalRef: 'r',
        bankAccount: { accountNumber: '01', accountName: 'A', bankName: '058' },
        rail: 'paystack',
      })

      // calls[0] = recipient creation, calls[1] = the actual transfer
      const transferCallBody = JSON.parse(fetchSpy.mock.calls[1]![1]!.body as string)
      expect(transferCallBody.amount).toBe(300000) // 3000 NGN × 100 kobo
    })
  })
})

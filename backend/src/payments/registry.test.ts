/**
 * registry.test.ts
 *
 * Tests that getPaymentProvider returns the correct adapter class based on the
 * PSP_PROVIDER_{RAIL} environment variable, and that the singleton cache
 * behaves correctly.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getPaymentProvider, _resetProviderCache } from './index.js'
import { PaystackProvider } from './paystackProvider.js'
import { FlutterwaveProvider } from './flutterwaveProvider.js'
import { StubPspProvider } from './stubPspProvider.js'
import { AppError } from '../errors/AppError.js'

describe('getPaymentProvider — registry', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    _resetProviderCache()
    delete process.env.PSP_PROVIDER_PAYSTACK
    delete process.env.PSP_PROVIDER_FLUTTERWAVE
    delete process.env.PSP_PROVIDER_PSP
    delete process.env.PSP_PROVIDER_MANUAL_ADMIN
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    _resetProviderCache()
  })

  // ── Default / stub mode ─────────────────────────────────────────────────

  it('returns StubPspProvider for paystack when PSP_PROVIDER_PAYSTACK is absent', () => {
    const provider = getPaymentProvider('paystack')
    expect(provider).toBeInstanceOf(StubPspProvider)
  })

  it('returns StubPspProvider for flutterwave when PSP_PROVIDER_FLUTTERWAVE is absent', () => {
    const provider = getPaymentProvider('flutterwave')
    expect(provider).toBeInstanceOf(StubPspProvider)
  })

  it('returns StubPspProvider when PSP_PROVIDER_PAYSTACK=stub', () => {
    process.env.PSP_PROVIDER_PAYSTACK = 'stub'
    const provider = getPaymentProvider('paystack')
    expect(provider).toBeInstanceOf(StubPspProvider)
  })

  it('returns StubPspProvider for psp rail', () => {
    const provider = getPaymentProvider('psp')
    expect(provider).toBeInstanceOf(StubPspProvider)
  })

  it('returns StubPspProvider for manual_admin rail', () => {
    const provider = getPaymentProvider('manual_admin')
    expect(provider).toBeInstanceOf(StubPspProvider)
  })

  // ── Real adapter selection ───────────────────────────────────────────────

  it('returns PaystackProvider when PSP_PROVIDER_PAYSTACK=paystack', () => {
    process.env.PSP_PROVIDER_PAYSTACK = 'paystack'
    const provider = getPaymentProvider('paystack')
    expect(provider).toBeInstanceOf(PaystackProvider)
  })

  it('returns FlutterwaveProvider when PSP_PROVIDER_FLUTTERWAVE=flutterwave', () => {
    process.env.PSP_PROVIDER_FLUTTERWAVE = 'flutterwave'
    const provider = getPaymentProvider('flutterwave')
    expect(provider).toBeInstanceOf(FlutterwaveProvider)
  })

  it('is case-insensitive for the rail parameter', () => {
    process.env.PSP_PROVIDER_PAYSTACK = 'paystack'
    const provider = getPaymentProvider('PAYSTACK')
    expect(provider).toBeInstanceOf(PaystackProvider)
  })

  // ── Singleton / caching ──────────────────────────────────────────────────

  it('returns the same PaystackProvider instance on repeated calls', () => {
    process.env.PSP_PROVIDER_PAYSTACK = 'paystack'
    const p1 = getPaymentProvider('paystack')
    const p2 = getPaymentProvider('paystack')
    expect(p1).toBe(p2)
  })

  it('returns the same FlutterwaveProvider instance on repeated calls', () => {
    process.env.PSP_PROVIDER_FLUTTERWAVE = 'flutterwave'
    const p1 = getPaymentProvider('flutterwave')
    const p2 = getPaymentProvider('flutterwave')
    expect(p1).toBe(p2)
  })

  it('returns new instance after _resetProviderCache', () => {
    process.env.PSP_PROVIDER_PAYSTACK = 'paystack'
    const p1 = getPaymentProvider('paystack')
    _resetProviderCache()
    const p2 = getPaymentProvider('paystack')
    // Different objects after reset
    expect(p1).not.toBe(p2)
    expect(p2).toBeInstanceOf(PaystackProvider)
  })

  it('picks up env change after cache reset', () => {
    // Start in stub mode
    const stub = getPaymentProvider('paystack')
    expect(stub).toBeInstanceOf(StubPspProvider)

    // Switch to real in env and reset cache
    process.env.PSP_PROVIDER_PAYSTACK = 'paystack'
    _resetProviderCache()

    const real = getPaymentProvider('paystack')
    expect(real).toBeInstanceOf(PaystackProvider)
  })

  // ── Error: unsupported rail ──────────────────────────────────────────────

  it('throws VALIDATION_ERROR for an unsupported rail', () => {
    expect(() => getPaymentProvider('bitcoin')).toThrow(AppError)
    try {
      getPaymentProvider('bitcoin')
    } catch (err) {
      expect(err).toBeInstanceOf(AppError)
      expect((err as AppError).status).toBe(400)
      expect((err as AppError).code).toBe('VALIDATION_ERROR')
    }
  })

  it('throws VALIDATION_ERROR for an empty string rail', () => {
    expect(() => getPaymentProvider('')).toThrow(AppError)
  })

  // ── Provider interface completeness ──────────────────────────────────────

  it.each(['paystack', 'flutterwave', 'psp', 'manual_admin'])(
    'provider for rail %s exposes required interface methods',
    (rail) => {
      const provider = getPaymentProvider(rail)
      expect(typeof provider.initiatePayment).toBe('function')
      expect(typeof provider.verifyPayment).toBe('function')
      expect(typeof provider.parseAndValidateWebhook).toBe('function')
      expect(typeof provider.mapStatus).toBe('function')
    },
  )

  it('PaystackProvider exposes executePayout', () => {
    process.env.PSP_PROVIDER_PAYSTACK = 'paystack'
    const provider = getPaymentProvider('paystack')
    expect(typeof provider.executePayout).toBe('function')
  })

  it('FlutterwaveProvider exposes executePayout', () => {
    process.env.PSP_PROVIDER_FLUTTERWAVE = 'flutterwave'
    const provider = getPaymentProvider('flutterwave')
    expect(typeof provider.executePayout).toBe('function')
  })
})

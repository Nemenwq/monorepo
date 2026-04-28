import { AppError } from '../errors/AppError.js'
import { ErrorCode } from '../errors/errorCodes.js'
import { StubPspProvider } from './stubPspProvider.js'
import { PaystackProvider } from './paystackProvider.js'
import { FlutterwaveProvider } from './flutterwaveProvider.js'
import type { PaymentProvider } from './types.js'

// ---------------------------------------------------------------------------
// Supported rails
// ---------------------------------------------------------------------------
const SUPPORTED_RAILS = new Set(['psp', 'paystack', 'flutterwave', 'manual_admin'])

// ---------------------------------------------------------------------------
// Singleton caches — one provider instance per adapter type so we don't pay
// construction overhead on every request.
// ---------------------------------------------------------------------------
let _paystackProvider: PaystackProvider | undefined
let _flutterwaveProvider: FlutterwaveProvider | undefined
const _stubProviders = new Map<string, StubPspProvider>()

function paystackSingleton(): PaystackProvider {
  _paystackProvider ??= new PaystackProvider()
  return _paystackProvider
}

function flutterwaveSingleton(): FlutterwaveProvider {
  _flutterwaveProvider ??= new FlutterwaveProvider()
  return _flutterwaveProvider
}

function stubSingleton(rail: string): StubPspProvider {
  if (!_stubProviders.has(rail)) {
    _stubProviders.set(rail, new StubPspProvider(rail))
  }
  return _stubProviders.get(rail)!
}

// ---------------------------------------------------------------------------
// resolveProvider — reads PSP_PROVIDER_{RAIL} from the environment.
//
//   PSP_PROVIDER_PAYSTACK=paystack      → PaystackProvider (real HTTP calls)
//   PSP_PROVIDER_FLUTTERWAVE=flutterwave → FlutterwaveProvider (real HTTP calls)
//   <absent> | stub                      → StubPspProvider (safe default)
//
// This means flipping a rail from stub → real in production requires only an
// env-var change with no code deployment.
// ---------------------------------------------------------------------------
function resolveProvider(rail: string): PaymentProvider {
  const envKey = `PSP_PROVIDER_${rail.toUpperCase()}`
  const chosen = (process.env[envKey] ?? 'stub').toLowerCase()

  switch (chosen) {
    case 'paystack':
      return paystackSingleton()
    case 'flutterwave':
      return flutterwaveSingleton()
    default:
      // 'stub' or any unrecognised value → safe local/CI fallback
      return stubSingleton(rail)
  }
}

// ---------------------------------------------------------------------------
// Public API — unchanged signature preserves all existing route contracts.
// ---------------------------------------------------------------------------
export function getPaymentProvider(rail: string): PaymentProvider {
  const normalized = String(rail).toLowerCase()

  if (!SUPPORTED_RAILS.has(normalized)) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'Unsupported payment rail')
  }

  return resolveProvider(normalized)
}

// ---------------------------------------------------------------------------
// Test helpers — allow tests to clear cached singletons so env-var changes
// between test cases are picked up correctly.
// ---------------------------------------------------------------------------
export function _resetProviderCache(): void {
  _paystackProvider = undefined
  _flutterwaveProvider = undefined
  _stubProviders.clear()
}

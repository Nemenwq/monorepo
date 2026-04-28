import { AppError } from '../errors/AppError.js'
import { ErrorCode } from '../errors/errorCodes.js'
import { ngnDepositStore } from '../models/ngnDepositStore.js'
import { NgnWalletService } from './ngnWalletService.js'
import { getPaymentProvider } from '../payments/index.js'
import { logger } from '../utils/logger.js'
import {
  ngnTopupInitiateResponseSchema,
  type NgnTopupInitiateRequest,
  type NgnTopupInitiateResponse,
} from '../schemas/ngnTopup.js'

const ngnWallet = new NgnWalletService()

/**
 * Shared NGN top-up initiation for `/api/wallet/ngn/topup/initiate` and tenant routes.
 * Deposit-level idempotency: when `idempotencyKey` is set, reuses the same `ngn_deposits` row.
 */
export async function initiateNgnTopup(params: {
  userId: string
  body: NgnTopupInitiateRequest
  idempotencyKey: string | null
  requestId?: string
}): Promise<{ status: 200 | 201; body: NgnTopupInitiateResponse }> {
  const { userId, body, idempotencyKey, requestId } = params

  if (idempotencyKey) {
    const existing = await ngnDepositStore.getByUserIdAndIdempotencyKey(userId, idempotencyKey)
    if (existing) {
      if (!existing.externalRefSource || !existing.externalRef) {
        throw new AppError(ErrorCode.CONFLICT, 409, 'Deposit initiation is in progress')
      }
      const response = {
        success: true,
        depositId: existing.depositId,
        externalRefSource: existing.externalRefSource,
        externalRef: existing.externalRef,
        ...(existing.redirectUrl ? { redirectUrl: existing.redirectUrl } : {}),
        ...(existing.bankDetails ? { bankDetails: existing.bankDetails } : {}),
      }
      return { status: 200, body: ngnTopupInitiateResponseSchema.parse(response) }
    }
  }

  const deposit = await ngnDepositStore.create({
    userId,
    amountNgn: body.amountNgn,
    rail: body.rail,
    idempotencyKey,
  })

  let externalRefSource: string
  let externalRef: string
  let redirectUrl: string | undefined
  let bankDetails: Record<string, string> | undefined

  if (body.rail === 'bank_transfer') {
    externalRefSource = 'bank'
    externalRef = `bnk_${deposit.depositId}`
    bankDetails = { accountNumber: '1234567890', bankName: 'Example Bank' }
  } else {
    const provider = getPaymentProvider(body.rail)
    const init = await provider.initiatePayment({
      amountNgn: body.amountNgn,
      userId,
      internalRef: deposit.depositId,
      rail: body.rail,
    })
    externalRefSource = init.externalRefSource
    externalRef = init.externalRef
    redirectUrl = init.redirectUrl
    if (init.bankDetails) {
      bankDetails = init.bankDetails
    }
  }

  await ngnDepositStore.attachExternalRef({
    depositId: deposit.depositId,
    externalRefSource,
    externalRef,
    redirectUrl: redirectUrl ?? null,
    bankDetails: bankDetails ?? null,
  })

  await ngnWallet.recordTopUpPending(deposit.depositId, body.amountNgn, externalRef)

  logger.info('NGN topup initiated', { userId, depositId: deposit.depositId, rail: body.rail, requestId })

  const response = {
    success: true,
    depositId: deposit.depositId,
    externalRefSource,
    externalRef,
    ...(redirectUrl ? { redirectUrl } : {}),
    ...(bankDetails ? { bankDetails } : {}),
  }

  return { status: 201, body: ngnTopupInitiateResponseSchema.parse(response) }
}

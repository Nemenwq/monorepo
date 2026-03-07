import { Router, type Request, type Response, type NextFunction } from 'express'
import { validate } from '../middleware/validate.js'
import { paymentsWebhookSchema } from '../schemas/deposit.js'
import { depositReversalWebhookSchema } from '../schemas/risk.js'
import { depositStore } from '../models/depositStore.js'
import { logger } from '../utils/logger.js'
import { AppError } from '../errors/AppError.js'
import { ErrorCode } from '../errors/errorCodes.js'
import { outboxStore, OutboxSender, TxType } from '../outbox/index.js'
import { createSorobanAdapter } from '../soroban/index.js'
import { getSorobanConfigFromEnv } from '../soroban/client.js'
import { NgnWalletService } from '../services/ngnWalletService.js'

export function createWebhooksRouter(ngnWalletService: NgnWalletService) {
  const router = Router()
  const adapter = createSorobanAdapter(getSorobanConfigFromEnv(process.env))
  const sender = new OutboxSender(adapter)

  /**
   * POST /api/webhooks/payments/:rail
   * 
   * Webhook endpoint for payment provider notifications.
   * Idempotent by (rail, externalRef) - replays won't double-credit.
   * 
   * Handles:
   * - confirmed: Credits NGN wallet and marks deposit as confirmed
   * - failed: Marks deposit as failed (no wallet credit)
   * - reversed: Debits NGN wallet and marks deposit as reversed
   * 
   * Signature validation is enforced in production mode when WEBHOOK_SIGNATURE_ENABLED=true
   */
  router.post(
    '/payments/:rail',
    validate(paymentsWebhookSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const rail = String(req.params.rail)
        
        // Validate webhook signature in production mode
        if (process.env.WEBHOOK_SIGNATURE_ENABLED === 'true') {
          const sig = req.headers['x-webhook-signature']
          if (typeof sig !== 'string' || sig !== process.env.WEBHOOK_SECRET) {
            throw new AppError(ErrorCode.UNAUTHORIZED, 401, 'Invalid webhook signature')
          }
        }

        const { externalRefSource, externalRef, status, providerStatus } = req.body
        
        // Validate rail matches externalRefSource
        if (externalRefSource !== rail) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'Rail mismatch')
        }

        // Find deposit by canonical reference (idempotency key)
        const existing = await depositStore.getByCanonical(rail, externalRef)
        if (!existing) {
          throw new AppError(ErrorCode.NOT_FOUND, 404, 'Deposit not found')
        }

        const { depositId, userId, amountNgn } = existing
        const reference = existing.externalRef || depositId

        // Map provider status to internal status if provided
        // This allows flexibility for different provider status codes
        const internalStatus = mapProviderStatus(status, providerStatus)

        // Handle failed status
        if (internalStatus === 'failed') {
          await depositStore.fail(depositId)
          logger.warn('Deposit failed via webhook', {
            depositId,
            userId,
            rail,
            externalRef,
            providerStatus,
            requestId: req.requestId,
          })
          return res.status(200).json({ success: true })
        }

        // Handle reversed/chargeback status
        if (internalStatus === 'reversed') {
          const reversed = await depositStore.reverseByCanonical(rail, externalRef)
          
          if (reversed) {
            // Debit wallet balance (idempotent - won't double-debit)
            const result = await ngnWalletService.reverseTopUp(
              userId,
              depositId,
              amountNgn,
              reference
            )

            logger.info('Deposit reversed via webhook', {
              depositId,
              userId,
              rail,
              externalRef,
              amountNgn,
              newAvailableBalance: result.newBalance.availableNgn,
              providerStatus,
              requestId: req.requestId,
            })
          }

          return res.status(200).json({ success: true })
        }

        // Handle confirmed status
        if (internalStatus === 'confirmed') {
          // Confirm deposit (idempotent - won't double-confirm)
          const confirmed = await depositStore.confirmByCanonical(rail, externalRef)

          if (confirmed && confirmed.confirmedAt) {
            // Credit NGN wallet (idempotent - won't double-credit)
            const creditResult = await ngnWalletService.creditTopUp(
              userId,
              depositId,
              amountNgn,
              reference
            )

            // Only create staking outbox item if this was a new credit
            // (existing staking flow for deposits)
            if (creditResult.credited) {
              const amountUsdc = String(Math.round((amountNgn / 1600) * 1e6) / 1e6)
              const outboxItem = await outboxStore.create({
                txType: TxType.STAKE,
                source: 'deposit',
                ref: depositId,
                payload: {
                  txType: TxType.STAKE,
                  amountUsdc,
                },
              })
              await sender.send(outboxItem)
            }

            logger.info('Deposit confirmed and wallet credited via webhook', {
              depositId,
              userId,
              rail,
              externalRef,
              amountNgn,
              newAvailableBalance: creditResult.newBalance.availableNgn,
              credited: creditResult.credited,
              providerStatus,
              requestId: req.requestId,
            })
          }
        }

        res.status(200).json({ success: true })
      } catch (error) {
        next(error)
      }
    },
  )

  /**
   * Maps provider-specific status codes to internal status values.
   * This allows different payment providers to use their own status codes
   * while maintaining a consistent internal representation.
   */
  function mapProviderStatus(status: string, providerStatus?: string): 'confirmed' | 'failed' | 'reversed' {
    // If status is already in our enum, use it directly
    if (status === 'confirmed' || status === 'failed' || status === 'reversed') {
      return status
    }

    // Map common provider status codes
    const normalizedProviderStatus = providerStatus?.toLowerCase() || ''
    
    // Common reversal/chargeback indicators
    if (
      normalizedProviderStatus.includes('reversed') ||
      normalizedProviderStatus.includes('chargeback') ||
      normalizedProviderStatus.includes('refund') ||
      normalizedProviderStatus.includes('dispute') ||
      status.toLowerCase().includes('reversed')
    ) {
      return 'reversed'
    }

    // Common failure indicators
    if (
      normalizedProviderStatus.includes('failed') ||
      normalizedProviderStatus.includes('declined') ||
      normalizedProviderStatus.includes('error') ||
      status.toLowerCase().includes('failed')
    ) {
      return 'failed'
    }

    // Default to confirmed for unknown statuses
    return 'confirmed'
  }

  /**
   * POST /api/webhooks/reversals/:provider
   * Handle deposit reversal/chargeback webhooks
   * Idempotent based on (provider, providerRef, eventType)
   */
  router.post(
    '/reversals/:provider',
    validate(depositReversalWebhookSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const provider = String(req.params.provider)
        
        // Verify webhook signature if enabled
        if (process.env.WEBHOOK_SIGNATURE_ENABLED === 'true') {
          const sig = req.headers['x-webhook-signature']
          if (typeof sig !== 'string' || sig !== process.env.WEBHOOK_SECRET) {
            throw new AppError(ErrorCode.UNAUTHORIZED, 401, 'Invalid webhook signature')
          }
        }

        const { provider: bodyProvider, providerRef, reversalRef, eventType } = req.body
        
        if (bodyProvider !== provider) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'Provider mismatch')
        }

        if (eventType !== 'deposit.reversed') {
          throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'Invalid event type')
        }

        logger.info('Processing deposit reversal webhook', {
          provider,
          providerRef,
          reversalRef,
          requestId: req.requestId,
        })

        // Process the reversal (idempotent)
        await ngnWalletService.processDepositReversal(provider, providerRef, reversalRef)

        logger.info('Deposit reversal processed successfully', {
          provider,
          providerRef,
          reversalRef,
          requestId: req.requestId,
        })

        res.status(200).json({ success: true })
      } catch (error) {
        if (error instanceof AppError && error.code === ErrorCode.NOT_FOUND) {
          // If deposit not found, still return 200 to prevent webhook retries
          logger.warn('Deposit not found for reversal webhook', {
            provider: req.params.provider,
            body: req.body,
            requestId: req.requestId,
          })
          res.status(200).json({ success: true, message: 'Deposit not found' })
          return
        }
        next(error)
      }
    },
  )

  return router
}

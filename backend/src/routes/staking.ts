import { Router, type Request, type Response, type NextFunction } from 'express'
import { outboxStore, OutboxSender, TxType } from '../outbox/index.js'
import { SorobanAdapter } from '../soroban/adapter.js'
import { logger } from '../utils/logger.js'
import { AppError } from '../errors/AppError.js'
import { ErrorCode } from '../errors/errorCodes.js'
import { validate } from '../middleware/validate.js'
import { authenticateToken, type AuthenticatedRequest } from '../middleware/auth.js'
import { depositStore } from '../models/depositStore.js'
import { LinkedAddressStore } from '../models/linkedAddressStore.js'
import { env } from '../schemas/env.js'
import { depositInitiateSchema, type DepositInitiateRequest } from '../schemas/deposit.js'
import { stakeFromDepositSchema, type StakeFromDepositRequest } from '../schemas/stakeFromDeposit.js'
import { stakeFinalizeSchema, type StakeFinalizeRequest } from '../schemas/stakeFinalize.js'
import { conversionStore } from '../models/conversionStore.js'
import { WalletService } from '../services/walletService.js'
import {
  stakeSchema,
  unstakeSchema,
  claimStakeRewardSchema,
  stakingPositionSchema,
  type StakeRequest,
  type UnstakeRequest,
  type ClaimStakeRewardRequest,
  type StakingPositionResponse,
} from '../schemas/staking.js'

function formatAmount6(amountMicro: bigint): string {
  const negative = amountMicro < 0n
  const abs = negative ? -amountMicro : amountMicro
  const whole = abs / 1_000_000n
  const frac = (abs % 1_000_000n).toString().padStart(6, '0')
  return `${negative ? '-' : ''}${whole.toString()}.${frac}`
}

export function createStakingRouter(
  adapter: SorobanAdapter,
  walletService: WalletService,
  linkedAddressStore: LinkedAddressStore,
) {
  const router = Router()
  const sender = new OutboxSender(adapter)

  router.post(
    '/deposit/initiate',
    validate(depositInitiateSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { quoteId, paymentRail, customerMeta } = req.body as DepositInitiateRequest
        const userId = req.headers['x-user-id']
        if (typeof userId !== 'string' || userId.length === 0) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'Missing x-user-id header')
        }
        const amountNgnHeader = req.headers['x-amount-ngn']
        const amountNgn = typeof amountNgnHeader === 'string' ? Number(amountNgnHeader) : NaN
        if (!Number.isFinite(amountNgn) || amountNgn <= 0) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'Invalid NGN amount')
        }
        const deposit = await depositStore.create({
          quoteId,
          userId,
          paymentRail,
          amountNgn,
          customerMeta,
        })
        let externalRefSource: string | undefined
        let externalRef: string | undefined
        let redirectUrl: string | undefined
        let bankDetails: Record<string, string> | undefined
        if (paymentRail === 'psp') {
          externalRefSource = 'psp'
          externalRef = `pi_${deposit.depositId}`
          redirectUrl = `https://pay.example.com/${externalRef}`
        } else if (paymentRail === 'bank') {
          externalRefSource = 'bank'
          externalRef = `bnk_${deposit.depositId}`
          bankDetails = { accountNumber: '1234567890', bankName: 'Example Bank' }
        } else {
          throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'Unsupported payment rail')
        }
        await depositStore.attachExternalRef(deposit.depositId, externalRefSource, externalRef)
        logger.info('Deposit initiated', {
          depositId: deposit.depositId,
          paymentRail,
          requestId: req.requestId,
        })
        res.status(201).json({
          success: true,
          depositId: deposit.depositId,
          externalRefSource,
          externalRef,
          ...(redirectUrl ? { redirectUrl } : {}),
          ...(bankDetails ? { bankDetails } : {}),
        })
      } catch (error) {
        next(error)
      }
    },
  )

  /**
   * POST /api/staking/finalize
   *
   * Finalizes staking using the canonical USDC amount produced by a conversion.
   * - If conversion not completed -> 409
   * - Idempotent by conversionId
   */
  router.post(
    '/finalize',
    validate(stakeFinalizeSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { conversionId } = req.body as StakeFinalizeRequest

        const conversion = await conversionStore.getByConversionId(conversionId)
        if (!conversion) {
          throw new AppError(ErrorCode.NOT_FOUND, 404, 'Conversion not found')
        }
        if (conversion.status !== 'completed') {
          throw new AppError(ErrorCode.CONFLICT, 409, 'Conversion not completed')
        }

        // Create outbox item idempotent by conversionId
        const outboxItem = await outboxStore.create({
          txType: TxType.STAKE,
          source: 'conversion',
          ref: conversion.conversionId,
          payload: {
            txType: TxType.STAKE,
            amountUsdc: conversion.amountUsdc,

            // Include FX metadata so receipt is deterministic.
            amountNgn: conversion.amountNgn,
            fxRateNgnPerUsdc: conversion.fxRateNgnPerUsdc,
            fxProvider: conversion.provider,

            conversionId: conversion.conversionId,
            depositId: conversion.depositId,
            conversionProviderRef: conversion.providerRef,
            userId: conversion.userId,
          },
        })

        const sent = await sender.send(outboxItem)

        const updatedItem = await outboxStore.getById(outboxItem.id)
        if (!updatedItem) {
          throw new AppError(
            ErrorCode.INTERNAL_ERROR,
            500,
            'Failed to retrieve outbox item after send attempt',
          )
        }

        res.status(sent ? 200 : 202).json({
          success: true,
          outboxId: updatedItem.id,
          txId: updatedItem.txId,
          status: updatedItem.status,
          message: sent
            ? 'Staking finalized and receipt written to chain'
            : 'Staking finalized, receipt queued for retry',
        })
      } catch (error) {
        next(error)
      }
    },
  )

  /**
   * POST /api/staking/stake_from_deposit
   *
   * Stakes using the canonical USDC amount produced by a prior deposit conversion.
   * Idempotent by depositId (conversion is unique per deposit).
   */
  router.post(
    '/stake_from_deposit',
    validate(stakeFromDepositSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { conversionId } = req.body as StakeFromDepositRequest

        const conversion = await conversionStore.getByConversionId(conversionId)
        if (!conversion) {
          throw new AppError(ErrorCode.NOT_FOUND, 404, 'Conversion not found')
        }
        if (conversion.status !== 'completed') {
          throw new AppError(ErrorCode.CONFLICT, 409, 'Conversion not completed')
        }

        const deposit = await depositStore.getById(conversion.depositId)
        if (!deposit) {
          throw new AppError(ErrorCode.NOT_FOUND, 404, 'Deposit not found')
        }

        // Mark deposit consumed (idempotent)
        await depositStore.markConsumed(deposit.depositId)

        // Create outbox item idempotent by depositId
        const outboxItem = await outboxStore.create({
          txType: TxType.STAKE,
          source: 'deposit',
          ref: deposit.depositId,
          payload: {
            txType: TxType.STAKE,
            amountUsdc: conversion.amountUsdc,

            // Include FX metadata so the on-chain receipt can carry NGN fields deterministically.
            amountNgn: conversion.amountNgn,
            fxRateNgnPerUsdc: conversion.fxRateNgnPerUsdc,
            fxProvider: conversion.provider,

            depositId: deposit.depositId,
            conversionId: conversion.conversionId,
            conversionProviderRef: conversion.providerRef,
            userId: conversion.userId,
          },
        })

        const sent = await sender.send(outboxItem)

        const updatedItem = await outboxStore.getById(outboxItem.id)
        if (!updatedItem) {
          throw new AppError(
            ErrorCode.INTERNAL_ERROR,
            500,
            'Failed to retrieve outbox item after send attempt',
          )
        }

        res.status(sent ? 200 : 202).json({
          success: true,
          outboxId: updatedItem.id,
          txId: updatedItem.txId,
          status: updatedItem.status,
          message: sent
            ? 'Staking confirmed and receipt written to chain'
            : 'Staking confirmed, receipt queued for retry',
        })
      } catch (error) {
        next(error)
      }
    },
  )

  /**
   * POST /api/staking/stake
   * 
   * Stake USDC tokens and record the transaction on-chain.
   * 
   * Idempotent by externalRefSource:externalRef combination.
   */
  router.post(
    '/stake',
    validate(stakeSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { amountUsdc, externalRefSource, externalRef } = req.body as StakeRequest

        logger.info('Staking request received', {
          amountUsdc,
          externalRefSource,
          requestId: req.requestId,
        })

        // Create outbox item (idempotent by source+ref)
        const outboxItem = await outboxStore.create({
          txType: TxType.STAKE,
          source: externalRefSource,
          ref: externalRef,
          payload: {
            txType: TxType.STAKE,
            amountUsdc,
            externalRefSource,
            externalRef,
          },
        })

        logger.info('Outbox item created for staking', {
          outboxId: outboxItem.id,
          txId: outboxItem.txId,
          status: outboxItem.status,
          requestId: req.requestId,
        })

        // Attempt immediate on-chain write
        const sent = await sender.send(outboxItem)

        const updatedItem = await outboxStore.getById(outboxItem.id)
        if (!updatedItem) {
          throw new AppError(
            ErrorCode.INTERNAL_ERROR,
            500,
            'Failed to retrieve outbox item after send attempt',
          )
        }

        res.status(sent ? 200 : 202).json({
          success: true,
          outboxId: updatedItem.id,
          txId: updatedItem.txId,
          status: updatedItem.status,
          message: sent
            ? 'Staking confirmed and receipt written to chain'
            : 'Staking confirmed, receipt queued for retry',
        })
      } catch (error) {
        next(error)
      }
    },
  )

  /**
   * POST /api/staking/unstake
   * 
   * Unstake USDC tokens and record the transaction on-chain.
   * 
   * Idempotent by externalRefSource:externalRef combination.
   */
  router.post(
    '/unstake',
    validate(unstakeSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { amountUsdc, externalRefSource, externalRef } = req.body as UnstakeRequest

        logger.info('Unstaking request received', {
          amountUsdc,
          externalRefSource,
          requestId: req.requestId,
        })

        // Create outbox item (idempotent by source+ref)
        const outboxItem = await outboxStore.create({
          txType: TxType.UNSTAKE,
          source: externalRefSource,
          ref: externalRef,
          payload: {
            txType: TxType.UNSTAKE,
            amountUsdc,
            externalRefSource,
            externalRef,
          },
        })

        logger.info('Outbox item created for unstaking', {
          outboxId: outboxItem.id,
          txId: outboxItem.txId,
          status: outboxItem.status,
          requestId: req.requestId,
        })

        // Attempt immediate on-chain write
        const sent = await sender.send(outboxItem)

        const updatedItem = await outboxStore.getById(outboxItem.id)
        if (!updatedItem) {
          throw new AppError(
            ErrorCode.INTERNAL_ERROR,
            500,
            'Failed to retrieve outbox item after send attempt',
          )
        }

        res.status(sent ? 200 : 202).json({
          success: true,
          outboxId: updatedItem.id,
          txId: updatedItem.txId,
          status: updatedItem.status,
          message: sent
            ? 'Unstaking confirmed and receipt written to chain'
            : 'Unstaking confirmed, receipt queued for retry',
        })
      } catch (error) {
        next(error)
      }
    },
  )

  /**
   * POST /api/staking/claim
   * 
   * Claim staking rewards and record the transaction on-chain.
   * 
   * Idempotent by externalRefSource:externalRef combination.
   */
  router.post(
    '/claim',
    validate(claimStakeRewardSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { externalRefSource, externalRef } = req.body as ClaimStakeRewardRequest

        logger.info('Staking reward claim request received', {
          externalRefSource,
          requestId: req.requestId,
        })

        // Create outbox item (idempotent by source+ref)
        const outboxItem = await outboxStore.create({
          txType: TxType.STAKE_REWARD_CLAIM,
          source: externalRefSource,
          ref: externalRef,
          payload: {
            txType: TxType.STAKE_REWARD_CLAIM,
            externalRefSource,
            externalRef,
          },
        })

        logger.info('Outbox item created for staking reward claim', {
          outboxId: outboxItem.id,
          txId: outboxItem.txId,
          status: outboxItem.status,
          requestId: req.requestId,
        })

        // Attempt immediate on-chain write
        const sent = await sender.send(outboxItem)

        const updatedItem = await outboxStore.getById(outboxItem.id)
        if (!updatedItem) {
          throw new AppError(
            ErrorCode.INTERNAL_ERROR,
            500,
            'Failed to retrieve outbox item after send attempt',
          )
        }

        res.status(sent ? 200 : 202).json({
          success: true,
          outboxId: updatedItem.id,
          txId: updatedItem.txId,
          status: updatedItem.status,
          message: sent
            ? 'Staking reward claim confirmed and receipt written to chain'
            : 'Staking reward claim confirmed, receipt queued for retry',
        })
      } catch (error) {
        next(error)
      }
    },
  )

  /**
   * GET /api/staking/position
   * 
   * Get current staking position (staked amount and claimable rewards).
   * 
   * Note: This is a mock implementation. In a real system, this would query
   * the staking contract or a database to get actual staking positions.
   */
  router.get(
    '/position',
    authenticateToken,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const userId = req.user?.id
        if (!userId) {
          throw new AppError(ErrorCode.UNAUTHORIZED, 401, 'Authentication required')
        }

        const accountHeader = req.headers['x-wallet-address']
        let account: string
        if (typeof accountHeader === 'string' && accountHeader.length > 0) {
          account = accountHeader
        } else if (env.CUSTODIAL_MODE_ENABLED) {
          try {
            account = await walletService.getPublicAddress(userId)
          } catch (error) {
            if (error instanceof Error && error.message.includes('Wallet not found')) {
              throw new AppError(ErrorCode.UNAUTHORIZED, 401, 'User wallet not found')
            }
            throw error
          }
        } else {
          const linked = await linkedAddressStore.getLinkedAddress(userId)
          if (!linked) {
            throw new AppError(
              ErrorCode.VALIDATION_ERROR,
              400,
              'No linked wallet address found for user',
            )
          }
          account = linked
        }

        const [stakedMicro, claimableMicro] = await Promise.all([
          adapter.getStakedBalance(account),
          adapter.getClaimableRewards(account),
        ])

        const position: StakingPositionResponse = stakingPositionSchema.parse({
          staked: formatAmount6(stakedMicro),
          claimable: formatAmount6(claimableMicro),
        })

        logger.info('Staking position requested', {
          requestId: req.requestId,
          userId,
        })

        res.status(200).json({
          success: true,
          position,
        })
      } catch (error) {
        next(error)
      }
    },
  )

  /**
   * POST /api/staking/quote
   * 
   * Get a quote for staking NGN amount with conversion to USDC.
   */
  router.post(
    '/quote',
    authenticateToken,
    validate(stakingQuoteRequestSchema, 'body'),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { amountNgn } = req.body as StakingQuoteRequest
        const userId = req.user!.id

        // Clean up expired quotes
        stakingQuoteStore.deleteExpired()

        // Mock FX rate and fees (in production, get from FX provider)
        const fxRate = 1600 // 1 USDC = 1600 NGN
        const conversionFee = amountNgn * 0.01 // 1% conversion fee
        const stakingFee = amountNgn * 0.005 // 0.5% staking fee
        const totalFees = conversionFee + stakingFee

        const estimatedUsdc = (amountNgn - totalFees) / fxRate

        const quote = stakingQuoteStore.create({
          amountNgn,
          estimatedUsdc,
          fxRate,
          fees: {
            conversion: conversionFee,
            staking: stakingFee,
            total: totalFees,
          },
          totalUsdcAfterFees: estimatedUsdc,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
          userId,
        })

        logger.info('Staking quote created', {
          quoteId: quote.quoteId,
          amountNgn,
          estimatedUsdc,
          userId,
          requestId: req.requestId,
        })

        const response: StakingQuoteResponse = {
          quoteId: quote.quoteId,
          amountNgn: quote.amountNgn,
          estimatedUsdc: quote.estimatedUsdc,
          fxRate: quote.fxRate,
          fees: quote.fees,
          totalUsdcAfterFees: quote.totalUsdcAfterFees,
          expiresAt: quote.expiresAt.toISOString(),
          createdAt: quote.createdAt.toISOString(),
        }

        res.json(stakingQuoteResponseSchema.parse(response))
      } catch (error) {
        next(error)
      }
    },
  )

  /**
   * POST /api/staking/stake-ngn
   * 
   * Stake NGN amount with conversion to USDC.
   */
  router.post(
    '/stake-ngn',
    authenticateToken,
    validate(stakeNgnRequestSchema, 'body'),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { quoteId } = req.body as StakeNgnRequest
        const userId = req.user!.id

        const quote = stakingQuoteStore.getById(quoteId)
        if (!quote) {
          throw new AppError(ErrorCode.NOT_FOUND, 404, 'Quote not found')
        }

        if (quote.userId !== userId) {
          throw new AppError(ErrorCode.FORBIDDEN, 403, 'Quote does not belong to user')
        }

        if (new Date() > quote.expiresAt) {
          stakingQuoteStore.deleteById(quoteId)
          throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'Quote has expired')
        }

        // Check NGN wallet balance
        const ngnBalance = await ngnWalletService.getBalance(userId)
        if (ngnBalance.availableNgn < quote.amountNgn) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'Insufficient NGN balance')
        }

        // Reserve NGN funds
        // await ngnWalletService.reserveFunds(userId, quote.amountNgn, quote.quoteId)
        // TODO: Implement reserveFunds in NgnWalletService

        // Create staking record
        const stake = ngnStakeStore.create({
          quoteId,
          userId,
          amountNgn: quote.amountNgn,
          estimatedUsdc: quote.estimatedUsdc,
          status: 'ngn_reserved',
          amountUsdc: null,
          txHash: null,
          completedAt: null,
        })

        // Update timeline for first step
        ngnStakeStore.updateStatus(stake.stakeId, 'ngn_reserved')

        // Start conversion process (mock - in production would call conversion service)
        setTimeout(async () => {
          try {
            ngnStakeStore.updateStatus(stake.stakeId, 'conversion_processing')
            
            // Mock conversion delay
            setTimeout(async () => {
              try {
                // Mock USDC staking
                ngnStakeStore.updateStatus(stake.stakeId, 'usdc_staked', {
                  amountUsdc: quote.estimatedUsdc,
                })

                // Mock receipt recording
                setTimeout(async () => {
                  try {
                    ngnStakeStore.updateStatus(stake.stakeId, 'receipt_recorded', {
                      txHash: `0x${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`,
                    })
                  } catch (error) {
                    logger.error('Failed to record receipt', { stakeId: stake.stakeId, error })
                  }
                }, 5000) // 5 seconds for receipt recording
              } catch (error) {
                logger.error('Failed to stake USDC', { stakeId: stake.stakeId, error })
                ngnStakeStore.updateStatus(stake.stakeId, 'failed')
              }
            }, 10000) // 10 seconds for conversion
          } catch (error) {
            logger.error('Failed to process conversion', { stakeId: stake.stakeId, error })
            ngnStakeStore.updateStatus(stake.stakeId, 'failed')
          }
        }, 2000) // 2 seconds to start conversion

        // Delete the quote
        stakingQuoteStore.deleteById(quoteId)

        logger.info('NGN staking initiated', {
          stakeId: stake.stakeId,
          quoteId,
          amountNgn: quote.amountNgn,
          userId,
          requestId: req.requestId,
        })

        const response: StakeNgnResponse = {
          success: true,
          stakeId: stake.stakeId,
          status: stake.status === 'ngn_reserved' ? 'pending' : stake.status === 'failed' ? 'failed' : 'processing',
          timeline: stake.timeline.map(step => ({
            ...step,
            timestamp: step.timestamp?.toISOString() || null,
          })),
          amountNgn: stake.amountNgn,
          estimatedUsdc: stake.estimatedUsdc,
          createdAt: stake.createdAt.toISOString(),
        }

        res.status(201).json(stakeNgnResponseSchema.parse(response))
      } catch (error) {
        next(error)
      }
    },
  )

  /**
   * GET /api/staking/status/:stakeId
   * 
   * Get status of NGN staking operation.
   */
  router.get(
    '/status/:stakeId',
    authenticateToken,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { stakeId } = req.params
        const userId = req.user!.id

        const stake = ngnStakeStore.getById(stakeId)
        if (!stake) {
          throw new AppError(ErrorCode.NOT_FOUND, 404, 'Stake not found')
        }

        if (stake.userId !== userId) {
          throw new AppError(ErrorCode.FORBIDDEN, 403, 'Stake does not belong to user')
        }

        const response: StakingStatusResponse = {
          stakeId: stake.stakeId,
          status: stake.status,
          timeline: stake.timeline.map(step => ({
            ...step,
            timestamp: step.timestamp?.toISOString() || null,
          })),
          amountNgn: stake.amountNgn,
          amountUsdc: stake.amountUsdc,
          txHash: stake.txHash,
          createdAt: stake.createdAt.toISOString(),
          completedAt: stake.completedAt?.toISOString() || null,
        }

        res.json(stakingStatusResponseSchema.parse(response))
      } catch (error) {
        next(error)
      }
    },
  )

  return router
}

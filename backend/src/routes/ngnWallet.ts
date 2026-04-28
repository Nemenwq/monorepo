import { Router, type Request, type Response, type NextFunction } from 'express'
import { validate } from '../middleware/validate.js'
import { NgnWalletService } from '../services/ngnWalletService.js'
import { 
  withdrawalRequestSchema,
  withdrawalResponseSchema,
  withdrawalHistoryResponseSchema,
  ngnBalanceResponseSchema,
  ngnLedgerResponseSchema
} from '../schemas/ngnWallet.js'
import { logger } from '../utils/logger.js'
import { AppError } from '../errors/AppError.js'
import { ErrorCode } from '../errors/errorCodes.js'
import { authenticateToken, type AuthenticatedRequest } from '../middleware/auth.js'
import { requireNotFrozen } from '../middleware/risk.js'
import { ngnTopupInitiateSchema, type NgnTopupInitiateRequest } from '../schemas/ngnTopup.js'
import { durableIdempotency } from '../middleware/durableIdempotency.js'
import { initiateNgnTopup } from '../services/ngnTopupInitiateService.js'

export function createNgnWalletRouter(ngnWalletService: NgnWalletService): Router {
  const router = Router()

  /**
   * GET /api/wallet/ngn/balance
   * Returns the NGN balance for the authenticated user
   */
  router.get('/balance', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id
      
      logger.info('Getting NGN balance', { userId, requestId: req.requestId })
      
      const balance = await ngnWalletService.getBalance(userId)
      
      const response = {
        success: true,
        ...balance
      }
      
      logger.info('NGN balance retrieved', { userId, balance, requestId: req.requestId })
      res.json(ngnBalanceResponseSchema.parse(response))
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.status).json({ error: { code: error.code, message: error.message } })
      } else {
        next(error)
      }
    }
  })

  /**
   * GET /api/wallet/ngn/ledger
   * Returns the NGN ledger entries for the authenticated user
   */
  router.get('/ledger', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined
      const cursor = req.query.cursor as string | undefined
      
      logger.info('Getting NGN ledger', { userId, limit, cursor, requestId: req.requestId })
      
      const ledger = await ngnWalletService.getLedger(userId, { limit, cursor })
      
      const response = {
        success: true,
        ...ledger
      }
      
      logger.info('NGN ledger retrieved', { userId, entriesCount: ledger.entries.length, requestId: req.requestId })
      res.json(ngnLedgerResponseSchema.parse(response))
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.status).json({ error: { code: error.code, message: error.message } })
      } else {
        next(error)
      }
    }
  })

  /**
   * POST /api/wallet/ngn/withdraw/initiate
   * Initiates a new withdrawal request
   * Requires user to not be frozen
   */
  router.post(
    '/withdraw/initiate',
    authenticateToken,
    requireNotFrozen,
    validate(withdrawalRequestSchema, 'body'),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const userId = req.user!.id
        const withdrawalRequest = req.body
        
        logger.info('Initiating withdrawal', { userId, amount: withdrawalRequest.amountNgn, requestId: req.requestId })
        
        const withdrawal = await ngnWalletService.initiateWithdrawal(userId, withdrawalRequest)
        
        const response = {
          success: true,
          ...withdrawal
        }
        
        logger.info('Withdrawal initiated successfully', { userId, withdrawalId: withdrawal.id, requestId: req.requestId })
        res.status(201).json(withdrawalResponseSchema.parse(response))
      } catch (error) {
        if (error instanceof AppError) {
          res.status(error.status).json({ error: { code: error.code, message: error.message } })
        } else {
          next(error)
        }
      }
    }
  )

  /**
   * GET /api/wallet/ngn/withdraw/history
   * Returns the withdrawal history for the authenticated user
   */
  router.get('/withdraw/history', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined
      const cursor = req.query.cursor as string | undefined
      
      logger.info('Getting withdrawal history', { userId, limit, cursor, requestId: req.requestId })
      
      const history = await ngnWalletService.getWithdrawalHistory(userId, { limit, cursor })
      
      const response = {
        success: true,
        ...history
      }
      
      logger.info('Withdrawal history retrieved', { userId, entriesCount: history.entries.length, requestId: req.requestId })
      res.json(withdrawalHistoryResponseSchema.parse(response))
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.status).json({ error: { code: error.code, message: error.message } })
      } else {
        next(error)
      }
    }
  })

  router.get('/withdrawals', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined
      const cursor = req.query.cursor as string | undefined

      logger.info('Getting withdrawals', { userId, limit, cursor, requestId: req.requestId })

      const history = await ngnWalletService.listWithdrawals(userId, { limit, cursor })

      const response = {
        success: true,
        ...history,
      }

      logger.info('Withdrawals retrieved', { userId, entriesCount: history.entries.length, requestId: req.requestId })
      res.json(withdrawalHistoryResponseSchema.parse(response))
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.status).json({ error: { code: error.code, message: error.message } })
      } else {
        next(error)
      }
    }
  })

  router.post(
    '/topup/initiate',
    authenticateToken,
    validate(ngnTopupInitiateSchema, 'body'),
    durableIdempotency((req) => `user:${(req as AuthenticatedRequest).user!.id}:ngn-topup`),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const userId = req.user!.id
        const body = req.body as NgnTopupInitiateRequest
        const idempotencyKeyRaw = req.header('x-idempotency-key')
        const idempotencyKey = typeof idempotencyKeyRaw === 'string' && idempotencyKeyRaw.trim() !== '' ? idempotencyKeyRaw.trim() : null

        const { status, body: out } = await initiateNgnTopup({
          userId,
          body,
          idempotencyKey,
          requestId: req.requestId,
        })
        res.status(status).json(out)
      } catch (error) {
        if (error instanceof AppError) {
          res.status(error.status).json({ error: { code: error.code, message: error.message } })
        } else {
          next(error)
        }
      }
    },
  )

  return router
}

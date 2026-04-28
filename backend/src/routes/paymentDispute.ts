import { Router, type Request, type Response, type NextFunction } from 'express'
import { paymentDisputeCreateSchema } from '../schemas/paymentDispute.js'
import { paymentDisputeRepository } from '../repositories/PaymentDisputeRepository.js'
import { authenticateToken } from '../middleware/auth.js'
import { AppError } from '../errors/AppError.js'
import { ErrorCode } from '../errors/errorCodes.js'
import { auditLog, extractAuditContext, type AuditEventType } from '../utils/auditLogger.js'
import { logger } from '../utils/logger.js'

function requireAdmin(req: Request): void {
  const user = (req as any).user
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    throw new AppError(ErrorCode.FORBIDDEN, 403, 'Admin access required')
  }
}

const router = Router()

router.post(
  '/',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = paymentDisputeCreateSchema.safeParse(req.body)
      if (!parsed.success) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'Invalid dispute data')
      }

      const userId = (req as any).user.id as string
      const data = parsed.data

      const existing = await paymentDisputeRepository.findByPaymentId(data.paymentId)
      const pending = existing.filter(d => d.status === 'pending')
      if (pending.length > 0) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'Dispute already pending for this payment')
      }

      const dispute = await paymentDisputeRepository.create(userId, data)

      auditLog('DISPUTE_CREATED' as AuditEventType, extractAuditContext(req, 'user'), {
        disputeId: dispute.id,
        paymentId: data.paymentId,
        reason: data.reason,
      })

      res.status(201).json({ success: true, disputeId: dispute.id })
    } catch (error) {
      next(error)
    }
  },
)

router.get(
  '/my',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user.id as string
      const disputes = await paymentDisputeRepository.findByUserId(userId)

      res.json({ disputes })
    } catch (error) {
      next(error)
    }
  },
)

router.get(
  '/admin',
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, userId, page, pageSize } = req.query
      const result = await paymentDisputeRepository.list({
        status: status as any,
        userId: userId as string,
        page: parseInt(page as string) || 1,
        pageSize: parseInt(pageSize as string) || 50,
      })

      res.json(result)
    } catch (error) {
      next(error)
    }
  },
)

router.post(
  '/admin/:disputeId/resolve',
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { disputeId } = req.params
      const adminId = (req as any).user.id as string
      const { status, resolution } = req.body as { status: string; resolution?: string }

      if (!['resolved', 'rejected'].includes(status)) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'Invalid status')
      }

      const dispute = await paymentDisputeRepository.findById(disputeId)
      if (!dispute) {
        throw new AppError(ErrorCode.NOT_FOUND, 404, 'Dispute not found')
      }

      const newStatus = status === 'resolved' ? 'resolved' : 'rejected'
      await paymentDisputeRepository.updateStatus(disputeId, newStatus, resolution, adminId)

      auditLog('DISPUTE_RESOLVED' as AuditEventType, extractAuditContext(req, 'admin'), {
        disputeId,
        status: newStatus,
        resolution,
      })

      res.json({ success: true })
    } catch (error) {
      next(error)
    }
  },
)

export function createPaymentDisputeRouter(): Router {
  return router
}
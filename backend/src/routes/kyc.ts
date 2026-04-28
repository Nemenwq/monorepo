import { Router, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { kycSubmissionSchema, kycStatusSchema } from '../schemas/kyc.js'
import { kycRepository } from '../repositories/KycRepository.js'
import { createKycProvider } from '../services/kycProvider.js'
import { authenticateToken } from '../middleware/auth.js'
import { AppError } from '../errors/AppError.js'
import { ErrorCode } from '../errors/errorCodes.js'
import { auditLog, extractAuditContext, type AuditEventType } from '../utils/auditLogger.js'
import { emitKycStatusChanged } from '../services/index.js'
import { logger } from '../utils/logger.js'

function requireAdmin(req: Request): void {
  const user = (req as any).user
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    throw new AppError(ErrorCode.FORBIDDEN, 403, 'Admin access required')
  }
}

const router = Router()
const kycProvider = createKycProvider()

router.post(
  '/',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = kycSubmissionSchema.safeParse(req.body)
      if (!parsed.success) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'Invalid submission')
      }

      const userId = (req as any).user.id as string
      const submission = parsed.data

      const existing = await kycRepository.findByUserId(userId)
      if (existing && existing.status === 'pending') {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'KYC already pending')
      }
      if (existing && existing.status === 'in_review') {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'KYC currently in review')
      }

      const record = await kycRepository.create(userId, submission)

      try {
        const result = await kycProvider.submit(submission)
        if (result.success && result.externalId) {
          await kycRepository.updateStatus(
            record.id,
            'in_review',
            kycProvider.name,
            result.externalId,
          )
        }
      } catch (providerError) {
        logger.warn('kyc.provider_error', { error: providerError })
      }

      auditLog('KYC_SUBMITTED' as AuditEventType, extractAuditContext(req, 'user'), {
        recordId: record.id,
        documentType: submission.documentType,
      })

      res.status(201).json({ success: true, recordId: record.id })
    } catch (error) {
      next(error)
    }
  },
)

router.get(
  '/status',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user.id as string
      const record = await kycRepository.findByUserId(userId)

      if (!record) {
        return res.json({ status: 'not_submitted' })
      }

      res.json({
        status: record.status,
        documentType: record.documentType,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        expiresAt: record.expiresAt,
      })
    } catch (error) {
      next(error)
    }
  },
)

router.post(
  '/webhook',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payload = req.body

      if (!kycProvider.webhookAuthenticate(payload)) {
        logger.warn('kyc.webhook_unauthorized', { payload })
        return res.status(401).json({ error: 'Unauthorized' })
      }

      const { id, status, reason } = payload as { id: string; status: string; reason?: string }
      const record = await kycRepository.findById(id)

      if (!record) {
        logger.warn('kyc.webhook_record_not_found', { id })
        return res.status(404).json({ error: 'Not found' })
      }

      const newStatus = kycStatusSchema.parse(status)
      await kycRepository.updateStatus(record.id, newStatus, undefined, undefined, reason)

      await emitKycStatusChanged(record.userId, newStatus)

      res.json({ received: true })
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
      const result = await kycRepository.list({
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
  '/admin/:recordId/approve',
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { recordId } = req.params
      const adminId = (req as any).user.id as string
      const { reason } = req.body as { reason?: string }

      const record = await kycRepository.findById(recordId)
      if (!record) {
        throw new AppError(ErrorCode.NOT_FOUND, 404, 'KYC record not found')
      }

      if (record.status !== 'pending' && record.status !== 'in_review') {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'Cannot approve in current state')
      }

      await kycRepository.updateStatus(recordId, 'approved', undefined, undefined, reason, adminId)

      auditLog('KYC_APPROVED' as AuditEventType, extractAuditContext(req, 'admin'), {
        recordId,
        userId: record.userId,
      })

      await emitKycStatusChanged(record.userId, 'approved')

      res.json({ success: true })
    } catch (error) {
      next(error)
    }
  },
)

router.post(
  '/admin/:recordId/reject',
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { recordId } = req.params
      const adminId = (req as any).user.id as string
      const { reason } = req.body as { reason?: string }

      const record = await kycRepository.findById(recordId)
      if (!record) {
        throw new AppError(ErrorCode.NOT_FOUND, 404, 'KYC record not found')
      }

      if (record.status !== 'pending' && record.status !== 'in_review') {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'Cannot reject in current state')
      }

      await kycRepository.updateStatus(recordId, 'rejected', undefined, undefined, reason, adminId)

      auditLog('KYC_REJECTED' as AuditEventType, extractAuditContext(req, 'admin'), {
        recordId,
        userId: record.userId,
        reason,
      })

      await emitKycStatusChanged(record.userId, 'rejected')

      res.json({ success: true })
    } catch (error) {
      next(error)
    }
  },
)

export function createKycRouter(): Router {
  return router
}
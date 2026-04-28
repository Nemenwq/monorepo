import type { Request, Response, NextFunction } from 'express'
import { extractAuditContext, auditLog, type AuditEventType, type ActorType } from '../utils/auditLogger.js'

const STATE_CHANGING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE']

const METHOD_TO_EVENT_TYPE: Record<string, AuditEventType> = {
  POST: 'STATE_CHANGED',
  PUT: 'STATE_CHANGED',
  PATCH: 'STATE_CHANGED',
  DELETE: 'STATE_DELETED',
}

interface AuditMiddlewareOptions {
  getActorType?: (req: Request) => ActorType
  getEventType?: (req: Request) => AuditEventType
  getMetadata?: (req: Request, res: Response) => Record<string, unknown>
}

export function createAuditMiddleware(options: AuditMiddlewareOptions = {}) {
  const {
    getActorType = (req: Request): ActorType => {
      const user = (req as any).user
      if (user?.role === 'admin' || user?.role === 'super_admin') return 'admin'
      if (user) return 'user'
      return 'system'
    },
    getEventType = (req: Request): AuditEventType => {
      const baseType = METHOD_TO_EVENT_TYPE[req.method] || 'STATE_CHANGED'
      const path = req.path
      if (path.includes('/auth/')) return baseType
      if (path.includes('/wallet')) return baseType
      if (path.includes('/deals')) return baseType
      if (path.includes('/staking')) return baseType
      if (path.includes('/deposits')) return baseType
      if (path.includes('/kyc')) return baseType
      if (path.includes('/admin/')) return 'ADMIN_OPERATION'
      return baseType
    },
    getMetadata = (_req: Request, res: Response): Record<string, unknown> => {
      return {
        statusCode: res.statusCode,
      }
    },
  } = options

  return function auditMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (!STATE_CHANGING_METHODS.includes(req.method)) {
      return next()
    }

    const originalSend = res.send
    res.send = function (body?: unknown): Response {
      const statusCode = res.statusCode
      const isSuccess = statusCode >= 200 && statusCode < 400

      if (isSuccess) {
        const actorType = getActorType(req)
        const eventType = getEventType(req)
        const metadata = getMetadata(req, res)

        auditLog(eventType, extractAuditContext(req, actorType), metadata)
      }

      return originalSend.call(this, body)
    }

    next()
  }
}

export const auditMiddleware = createAuditMiddleware()
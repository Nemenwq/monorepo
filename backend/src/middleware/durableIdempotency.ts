import type { Request, Response, NextFunction } from 'express'
import { durableIdempotencyService } from '../services/durableIdempotencyService.js'
import { ErrorCode } from '../errors/errorCodes.js'
import type { ErrorResponse } from '../errors/errorCodes.js'

/**
 * Durable idempotency (Postgres when DATABASE_URL is set, else in-memory).
 * Requires `x-idempotency-key`. Replays return cached JSON with `x-idempotent-replay: true`.
 */
export function durableIdempotency(
  getScope: (req: Request) => string | Promise<string>,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const raw = req.headers['x-idempotency-key']
    if (typeof raw !== 'string' || !raw.trim()) {
      const body: ErrorResponse = {
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Missing or empty x-idempotency-key header',
        },
      }
      return res.status(400).json(body)
    }
    if (raw.trim().length > 256) {
      const body: ErrorResponse = {
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'x-idempotency-key must not exceed 256 characters',
        },
      }
      return res.status(400).json(body)
    }

    const scope = await Promise.resolve(getScope(req))
    const h = durableIdempotencyService.payloadHash(req.body)
    const s = await durableIdempotencyService.start({
      scope,
      idempotencyKey: raw,
      requestBodyHash: h,
    })

    if (s.type === 'replay') {
      res.setHeader('x-idempotent-replay', 'true')
      return res.status(s.httpStatus).json(s.body)
    }
    if (s.type === 'conflict') {
      const body: ErrorResponse = {
        error: {
          code: ErrorCode.CONFLICT,
          message: 'Idempotency key was already used with a different request body',
        },
      }
      return res.status(409).json(body)
    }
    if (s.type === 'in_flight') {
      const body: ErrorResponse = {
        error: {
          code: ErrorCode.CONFLICT,
          message: 'A request with this idempotency key is still being processed',
        },
      }
      return res.status(409).json(body)
    }

    const idemKey = raw.trim()
    const origJson = res.json.bind(res)
    res.json = (b: unknown) => {
      void durableIdempotencyService.complete({
        scope,
        idempotencyKey: idemKey,
        httpStatus: res.statusCode,
        body: b,
      })
      return origJson(b)
    }
    next()
  }
}

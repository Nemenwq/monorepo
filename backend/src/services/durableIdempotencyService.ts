import { createHash } from 'node:crypto'
import { getPool } from '../db.js'
import { logger } from '../utils/logger.js'
import { recordKPI } from '../utils/appMetrics.js'

const DEFAULT_TTL_MS = parseInt(process.env.API_IDEMPOTENCY_TTL_MS ?? String(24 * 60 * 60 * 1000), 10)
const PROCESSING_LEASE_MS = parseInt(process.env.API_IDEMPOTENCY_LEASE_MS ?? '120000', 10)
const STALE_AGE_MS = parseInt(process.env.API_IDEMPOTENCY_STALE_MS ?? String(15 * 60 * 1000), 10)

type StartResult =
  | { type: 'proceed' }
  | { type: 'replay'; httpStatus: number; body: unknown }
  | { type: 'conflict' }
  | { type: 'in_flight' }

type MemRow = {
  status: 'processing' | 'completed' | 'failed'
  requestBodyHash: string
  httpStatus: number | null
  responseBody: unknown
  processingStartedAt: number
}

const memory = new Map<string, MemRow>()

function memKey(scope: string, k: string) {
  return `${scope}::${k}`
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

function startMemory(scope: string, idempotencyKey: string, requestBodyHash: string): StartResult {
  const k = memKey(scope, idempotencyKey)
  const existing = memory.get(k)
  if (existing) {
    if (existing.requestBodyHash !== requestBodyHash) {
      return { type: 'conflict' }
    }
    if (existing.status === 'completed') {
      recordKPI('idempotencyCacheHit')
      return { type: 'replay', httpStatus: existing.httpStatus ?? 200, body: existing.responseBody }
    }
    if (existing.status === 'failed') {
      memory.delete(k)
    } else if (existing.status === 'processing') {
      if (Date.now() - existing.processingStartedAt < PROCESSING_LEASE_MS) {
        return { type: 'in_flight' }
      }
      recordKPI('idempotencyLeaseReclaimed')
      existing.processingStartedAt = Date.now()
      return { type: 'proceed' }
    }
  }
  memory.set(k, {
    status: 'processing',
    requestBodyHash,
    httpStatus: null,
    responseBody: null,
    processingStartedAt: Date.now(),
  })
  return { type: 'proceed' }
}

export const durableIdempotencyService = {
  payloadHash(reqBody: unknown): string {
    return sha256(JSON.stringify(reqBody ?? null))
  },

  async start(input: { scope: string; idempotencyKey: string; requestBodyHash: string }): Promise<StartResult> {
    const { scope, idempotencyKey, requestBodyHash } = input
    const key = idempotencyKey.trim()
    if (!key || key.length > 256) {
      return { type: 'conflict' }
    }

    const pool = await getPool()
    if (!pool) {
      return startMemory(scope, key, requestBodyHash)
    }

    const expires = new Date(Date.now() + DEFAULT_TTL_MS).toISOString()
    const ins = await pool.query(
      `INSERT INTO api_idempotency (
          scope, idempotency_key, request_body_hash, status, processing_started_at, expires_at
        ) VALUES ($1, $2, $3, 'processing', NOW(), $4::timestamptz)
        ON CONFLICT (scope, idempotency_key) DO NOTHING
        RETURNING id`,
      [scope, key, requestBodyHash, expires],
    )
    if (ins.rows.length > 0) {
      return { type: 'proceed' }
    }

    const { rows } = await pool.query(
      `SELECT status, request_body_hash, http_status, response_body, processing_started_at
       FROM api_idempotency WHERE scope = $1 AND idempotency_key = $2`,
      [scope, key],
    )
    const row = rows[0] as
      | {
          status: string
          request_body_hash: string
          http_status: number | null
          response_body: unknown
          processing_started_at: string
        }
      | undefined
    if (!row) {
      return { type: 'proceed' }
    }
    if (row.request_body_hash !== requestBodyHash) {
      return { type: 'conflict' }
    }
    if (row.status === 'completed' && row.response_body !== null && row.response_body !== undefined) {
      recordKPI('idempotencyCacheHit')
      return {
        type: 'replay',
        httpStatus: row.http_status ?? 200,
        body: row.response_body,
      }
    }
    if (row.status === 'failed') {
      await pool.query(
        `UPDATE api_idempotency
         SET status = 'processing', processing_started_at = NOW(), request_body_hash = $3, expires_at = $4::timestamptz, completed_at = NULL, http_status = NULL, response_body = NULL
         WHERE scope = $1 AND idempotency_key = $2`,
        [scope, key, requestBodyHash, expires],
      )
      return { type: 'proceed' }
    }
    if (row.status === 'processing') {
      const age = Date.now() - new Date(row.processing_started_at).getTime()
      if (age < PROCESSING_LEASE_MS) {
        return { type: 'in_flight' }
      }
      await pool.query(
        `UPDATE api_idempotency SET processing_started_at = NOW() WHERE scope = $1 AND idempotency_key = $2`,
        [scope, key],
      )
      recordKPI('idempotencyLeaseReclaimed')
    }
    return { type: 'proceed' }
  },

  async complete(input: { scope: string; idempotencyKey: string; httpStatus: number; body: unknown }): Promise<void> {
    const k = memKey(input.scope, input.idempotencyKey.trim())
    const pool = await getPool()
    if (!pool) {
      const row = memory.get(k)
      if (row) {
        row.status = 'completed'
        row.httpStatus = input.httpStatus
        row.responseBody = input.body
      }
      return
    }
    await pool.query(
      `UPDATE api_idempotency
       SET status = 'completed', http_status = $3, response_body = $4::jsonb, completed_at = NOW()
       WHERE scope = $1 AND idempotency_key = $2`,
      [input.scope, input.idempotencyKey.trim(), input.httpStatus, JSON.stringify(input.body ?? null)],
    )
  },

  async fail(input: { scope: string; idempotencyKey: string; message?: string }): Promise<void> {
    const k = memKey(input.scope, input.idempotencyKey.trim())
    const pool = await getPool()
    if (!pool) {
      memory.delete(k)
      return
    }
    await pool.query(
      `UPDATE api_idempotency SET status = 'failed', completed_at = NOW()
       WHERE scope = $1 AND idempotency_key = $2`,
      [input.scope, input.idempotencyKey.trim()],
    )
    if (input.message) {
      logger.warn('idempotency request failed', { message: input.message, scope: input.scope })
    }
  },

  async reconcileStale(): Promise<{ reclaimed: number }> {
    const pool = await getPool()
    if (!pool) {
      const cutoff = Date.now() - STALE_AGE_MS
      let reclaimed = 0
      for (const [k, row] of memory) {
        if (row.status === 'processing' && row.processingStartedAt < cutoff) {
          memory.delete(k)
          reclaimed++
        }
      }
      if (reclaimed) recordKPI('idempotencyStaleReclaimed')
      return { reclaimed }
    }
    const r = await pool.query(
      `DELETE FROM api_idempotency
       WHERE status = 'processing'
         AND processing_started_at < NOW() - ($1::numeric * INTERVAL '1 millisecond')
       RETURNING id`,
      [STALE_AGE_MS],
    )
    const reclaimed = r.rowCount ?? 0
    if (reclaimed) recordKPI('idempotencyStaleReclaimed')
    return { reclaimed }
  },
}

export function _resetDurableIdempotencyMemory() {
  memory.clear()
}

import { getPool } from '../db.js'
import { logger } from '../utils/logger.js'
import { executeSettlementEvent, getSettlementMemoryQueue, type SettlementOutboxRow } from './enqueueSideEffects.js'
import { recordKPI } from '../utils/appMetrics.js'

const MAX_ATTEMPTS = 5
const BASE_BACKOFF_MS = 2000

export class SettlementOutboxWorker {
  private timer: ReturnType<typeof setInterval> | null = null

  start(intervalMs = 4000) {
    if (this.timer) return
    this.timer = setInterval(() => {
      void this.tick()
    }, intervalMs)
    if (this.timer.unref) this.timer.unref()
    logger.info('SettlementOutboxWorker started', { intervalMs })
  }

  async stop() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  async tick() {
    const pool = await getPool()
    if (pool) {
      for (let i = 0; i < 8; i++) {
        const done = await this.claimAndProcessOne(pool)
        if (!done) break
      }
    } else {
      const q = getSettlementMemoryQueue()
      for (const row of q.filter((r) => r.status === 'pending')) {
        try {
          await executeSettlementEvent(mapMemRow(row))
          row.status = 'done'
        } catch (e) {
          row.attempts += 1
          row.status = row.attempts >= MAX_ATTEMPTS ? 'dead' : 'pending'
          if (row.status === 'dead') recordKPI('settlementOutboxDead')
        }
      }
    }
  }

  private async claimAndProcessOne(pool: NonNullable<Awaited<ReturnType<typeof getPool>>>): Promise<boolean> {
    const client = await pool.connect()
    let row: SettlementOutboxRow | null = null
    try {
      await client.query('BEGIN')
      const { rows } = await client.query(
        `SELECT id, deal_id AS "dealId", period, event_type AS "eventType", idempotency_key AS "idempotencyKey",
                payload, status, attempts, next_retry_at AS "nextRetryAt", last_error AS "lastError"
         FROM settlement_outbox
         WHERE status = 'pending' AND (next_retry_at IS NULL OR next_retry_at <= NOW())
         ORDER BY created_at
         FOR UPDATE SKIP LOCKED
         LIMIT 1`,
      )
      if (rows.length === 0) {
        await client.query('COMMIT')
        return false
      }
      row = mapRow(rows[0]!)
      await client.query(
        `UPDATE settlement_outbox SET status = 'processing', updated_at = NOW() WHERE id = $1`,
        [row.id],
      )
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {})
      throw e
    } finally {
      client.release()
    }

    if (!row) return false

    try {
      await executeSettlementEvent(row)
      await pool.query(`UPDATE settlement_outbox SET status = 'done', updated_at = NOW() WHERE id = $1`, [row.id])
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const attempts = row.attempts + 1
      if (attempts >= MAX_ATTEMPTS) {
        await pool.query(
          `INSERT INTO settlement_outbox_dlq (id, deal_id, period, event_type, idempotency_key, payload, last_error, failed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
          [row.id, row.dealId, row.period, row.eventType, row.idempotencyKey, JSON.stringify(row.payload), msg],
        )
        await pool.query(`DELETE FROM settlement_outbox WHERE id = $1`, [row.id])
        recordKPI('settlementOutboxDead')
        logger.error('settlement outbox dead', { id: row.id, idempotencyKey: row.idempotencyKey, msg })
      } else {
        const next = new Date(Date.now() + BASE_BACKOFF_MS * Math.pow(2, attempts - 1))
        await pool.query(
          `UPDATE settlement_outbox
           SET status = 'pending', attempts = $2, last_error = $3, next_retry_at = $4, updated_at = NOW()
           WHERE id = $1`,
          [row.id, attempts, msg, next.toISOString()],
        )
      }
    }
    return true
  }
}

function mapRow(raw: Record<string, unknown>): SettlementOutboxRow {
  return {
    id: String(raw.id),
    dealId: String(raw.dealId),
    period: Number(raw.period),
    eventType: String(raw.eventType),
    idempotencyKey: String(raw.idempotencyKey),
    payload: (raw.payload as Record<string, unknown>) ?? {},
    status: String(raw.status),
    attempts: Number(raw.attempts),
    nextRetryAt: raw.nextRetryAt ? new Date(String(raw.nextRetryAt)) : null,
    lastError: raw.lastError ? String(raw.lastError) : null,
  }
}

function mapMemRow(row: {
  id: string
  dealId: string
  period: number
  eventType: string
  idempotencyKey: string
  payload: Record<string, unknown>
  status: string
  attempts: number
}): SettlementOutboxRow {
  return {
    id: row.id,
    dealId: row.dealId,
    period: row.period,
    eventType: row.eventType,
    idempotencyKey: row.idempotencyKey,
    payload: row.payload,
    status: row.status,
    attempts: row.attempts,
    nextRetryAt: null,
    lastError: null,
  }
}

import { randomUUID } from 'node:crypto'

type SqlClient = {
  query: (text: string, params?: unknown[]) => Promise<unknown>
}
import { recordKPI } from '../utils/appMetrics.js'
import { logger } from '../utils/logger.js'
import { notificationService } from '../services/notificationService.js'

export type SettlementEventType = 'receipt_recorded' | 'notification_fanout' | 'audit_publish'

export interface EnqueueContext {
  dealId: string
  period: number
  tenantId: string
  landlordId: string
  amountNgn: number
}

const memQueue: {
  id: string
  dealId: string
  period: number
  eventType: SettlementEventType
  idempotencyKey: string
  payload: Record<string, unknown>
  status: 'pending' | 'processing' | 'done' | 'failed' | 'dead'
  attempts: number
}[] = []

let memId = 0

function buildRows(ctx: EnqueueContext) {
  const { dealId, period, tenantId, landlordId, amountNgn } = ctx
  const base = { dealId, period, tenantId, landlordId, amountNgn }
  return [
    {
      eventType: 'receipt_recorded' as const,
      idempotencyKey: `deal:${dealId}:p${period}:receipt_recorded`,
      payload: { ...base, event: 'receipt_recorded' },
    },
    {
      eventType: 'notification_fanout' as const,
      idempotencyKey: `deal:${dealId}:p${period}:notification_fanout`,
      payload: { ...base, event: 'notification_fanout' },
    },
    {
      eventType: 'audit_publish' as const,
      idempotencyKey: `deal:${dealId}:p${period}:audit_publish`,
      payload: { ...base, event: 'audit_publish' },
    },
  ]
}

export async function enqueueSettlementSideEffectsInTransaction(
  client: SqlClient,
  ctx: EnqueueContext,
): Promise<void> {
  for (const row of buildRows(ctx)) {
    const id = randomUUID()
    await client.query(
      `INSERT INTO settlement_outbox (id, deal_id, period, event_type, idempotency_key, payload, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [id, ctx.dealId, ctx.period, row.eventType, row.idempotencyKey, JSON.stringify(row.payload)],
    )
  }
  logger.info('Enqueued settlement side effects', { dealId: ctx.dealId, period: ctx.period })
}

export function enqueueSettlementSideEffectsMemory(ctx: EnqueueContext): void {
  for (const row of buildRows(ctx)) {
    if (memQueue.some((m) => m.idempotencyKey === row.idempotencyKey)) continue
    memId += 1
    memQueue.push({
      id: `mem-${memId}`,
      dealId: ctx.dealId,
      period: ctx.period,
      eventType: row.eventType,
      idempotencyKey: row.idempotencyKey,
      payload: row.payload,
      status: 'pending',
      attempts: 0,
    })
  }
}

export function getSettlementMemoryQueue() {
  return memQueue
}

export function _clearSettlementMemoryQueue() {
  memQueue.length = 0
  memId = 0
}

export type SettlementOutboxRow = {
  id: string
  dealId: string
  period: number
  eventType: string
  idempotencyKey: string
  payload: Record<string, unknown>
  status: string
  attempts: number
  nextRetryAt: Date | null
  lastError: string | null
}

/**
 * Idempotent side-effect execution (at-least-once safe via notification dedupe and stable idempotency_key).
 */
export async function executeSettlementEvent(row: SettlementOutboxRow): Promise<void> {
  if (row.eventType === 'receipt_recorded') {
    // Stub: official receipt record would upsert with idempotency_key; metrics only here
    recordKPI('settlementOutboxDone')
  } else if (row.eventType === 'notification_fanout') {
    const tenantId = String(row.payload.tenantId ?? '')
    const dedupe = `settlement:${row.dealId}:p${row.period}:rent_paid`
    await notificationService.create(tenantId, {
      category: 'transaction',
      title: 'Rent payment received',
      body: `Period ${row.period} for deal ${row.dealId} was marked paid.`,
      data: { dealId: row.dealId, period: row.period },
      dedupeKey: dedupe,
    })
    recordKPI('settlementOutboxDone')
  } else if (row.eventType === 'audit_publish') {
    logger.info('settlement.audit', { idempotencyKey: row.idempotencyKey, dealId: row.dealId, period: row.period })
    recordKPI('settlementOutboxDone')
  }
}

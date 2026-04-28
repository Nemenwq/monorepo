import { randomUUID } from 'node:crypto'
import { getPool, type PgPoolLike } from '../db.js'
import type { CreateSettlementLedgerEntryInput, SettlementLedgerEntry, SettlementLedgerEventType } from './settlementLedger.js'

interface SettlementLedgerStorePort {
  insertMany(entries: CreateSettlementLedgerEntryInput[]): Promise<SettlementLedgerEntry[]>
  listByDealId(dealId: string, eventType?: SettlementLedgerEventType): Promise<SettlementLedgerEntry[]>
  clear(): Promise<void>
}

class InMemorySettlementLedgerStore implements SettlementLedgerStorePort {
  private entries: SettlementLedgerEntry[] = []

  async insertMany(entries: CreateSettlementLedgerEntryInput[]): Promise<SettlementLedgerEntry[]> {
    const now = new Date()
    const inserted: SettlementLedgerEntry[] = entries.map((e) => ({
      ...e,
      entryId: randomUUID(),
      createdAt: now,
    }))
    this.entries.push(...inserted)
    return inserted
  }

  async listByDealId(dealId: string, eventType?: SettlementLedgerEventType): Promise<SettlementLedgerEntry[]> {
    return this.entries
      .filter((e) => e.dealId === dealId && (!eventType || e.eventType === eventType))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  async clear(): Promise<void> {
    this.entries = []
  }
}

type SettlementLedgerEntryRow = {
  entry_id: string
  deal_id: string
  event_type: string
  beneficiary_type: string
  beneficiary_id: string | null
  amount_ngn: string | number
  currency: string
  rationale: string
  split_config_version: string
  split_config_snapshot: unknown
  created_at: Date
}

class PostgresSettlementLedgerStore implements SettlementLedgerStorePort {
  private async pool(): Promise<PgPoolLike> {
    const pool = await getPool()
    if (!pool) {
      throw new Error('Database pool is not available (DATABASE_URL/pg not configured)')
    }
    return pool
  }

  async isAvailable(): Promise<boolean> {
    return (await getPool()) !== null
  }

  async insertMany(entries: CreateSettlementLedgerEntryInput[]): Promise<SettlementLedgerEntry[]> {
    const pool = await this.pool()
    if (entries.length === 0) return []

    const inserted: SettlementLedgerEntry[] = []

    for (const e of entries) {
      const entryId = randomUUID()
      const { rows } = await pool.query(
        `INSERT INTO settlement_ledger_entries (
          entry_id,
          deal_id,
          event_type,
          beneficiary_type,
          beneficiary_id,
          amount_ngn,
          currency,
          rationale,
          split_config_version,
          split_config_snapshot
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (deal_id, event_type, beneficiary_type, COALESCE(beneficiary_id, '')) DO NOTHING
        RETURNING *`,
        [
          entryId,
          e.dealId,
          e.eventType,
          e.beneficiaryType,
          e.beneficiaryId ?? null,
          e.amountNgn,
          e.currency,
          e.rationale,
          e.splitConfigVersion,
          JSON.stringify(e.splitConfigSnapshot),
        ],
      )
      if (rows.length > 0) {
        inserted.push(this.mapRow(rows[0] as SettlementLedgerEntryRow))
      }
    }

    return inserted
  }

  async listByDealId(dealId: string, eventType?: SettlementLedgerEventType): Promise<SettlementLedgerEntry[]> {
    const pool = await this.pool()
    const params: unknown[] = [dealId]
    let where = 'deal_id = $1'
    if (eventType) {
      params.push(eventType)
      where += ` AND event_type = $${params.length}`
    }
    const { rows } = await pool.query(
      `SELECT * FROM settlement_ledger_entries WHERE ${where} ORDER BY created_at DESC`,
      params,
    )
    return rows.map((r) => this.mapRow(r as SettlementLedgerEntryRow))
  }

  async clear(): Promise<void> {
    const pool = await this.pool()
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('settlementLedgerStore.clear() is only supported in test env when using Postgres')
    }
    await pool.query('TRUNCATE settlement_ledger_entries RESTART IDENTITY CASCADE')
  }

  private mapRow(row: SettlementLedgerEntryRow): SettlementLedgerEntry {
    const snapshotValue = row.split_config_snapshot
    let splitConfigSnapshot: SettlementLedgerEntry['splitConfigSnapshot']
    if (snapshotValue && typeof snapshotValue === 'string') {
      splitConfigSnapshot = JSON.parse(snapshotValue)
    } else {
      splitConfigSnapshot = snapshotValue as SettlementLedgerEntry['splitConfigSnapshot']
    }

    return {
      entryId: row.entry_id,
      dealId: row.deal_id,
      eventType: row.event_type as SettlementLedgerEntry['eventType'],
      beneficiaryType: row.beneficiary_type as SettlementLedgerEntry['beneficiaryType'],
      beneficiaryId: row.beneficiary_id ?? undefined,
      amountNgn: toNumber(row.amount_ngn),
      currency: (row.currency as 'NGN') ?? 'NGN',
      rationale: row.rationale,
      splitConfigVersion: row.split_config_version,
      splitConfigSnapshot,
      createdAt: new Date(row.created_at),
    }
  }
}

class HybridSettlementLedgerStore implements SettlementLedgerStorePort {
  private memory = new InMemorySettlementLedgerStore()
  private postgres = new PostgresSettlementLedgerStore()

  private async adapter(): Promise<SettlementLedgerStorePort> {
    if (await this.postgres.isAvailable()) {
      return this.postgres
    }
    return this.memory
  }

  async insertMany(entries: CreateSettlementLedgerEntryInput[]): Promise<SettlementLedgerEntry[]> {
    const adapter = await this.adapter()
    return adapter.insertMany(entries)
  }

  async listByDealId(dealId: string, eventType?: SettlementLedgerEventType): Promise<SettlementLedgerEntry[]> {
    const adapter = await this.adapter()
    return adapter.listByDealId(dealId, eventType)
  }

  async clear(): Promise<void> {
    const adapter = await this.adapter()
    return adapter.clear()
  }
}

function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value)
}

export const settlementLedgerStore = new HybridSettlementLedgerStore()

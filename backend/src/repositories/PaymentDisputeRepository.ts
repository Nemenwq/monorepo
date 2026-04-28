import { getPool } from '../db.js'
import type { PaymentDispute, PaymentDisputeStatus, PaymentDisputeCreate } from '../schemas/paymentDispute.js'
import { logger } from '../utils/logger.js'

export class PaymentDisputeRepository {
  private async pool() {
    const pool = await getPool()
    return pool
  }

  async create(userId: string, data: PaymentDisputeCreate): Promise<PaymentDispute> {
    const pool = await this.pool()
    if (!pool) throw new Error('Database not configured')

    const evidenceKeys = data.evidenceKeys ?? []

    const { rows } = await pool.query(
      `INSERT INTO payment_disputes (user_id, payment_id, reason, description, evidence_keys, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [userId, data.paymentId, data.reason, data.description, evidenceKeys],
    )

    return this.mapRowToDispute(rows[0])
  }

  async findById(id: string): Promise<PaymentDispute | null> {
    const pool = await this.pool()
    if (!pool) throw new Error('Database not configured')

    const { rows } = await pool.query(`SELECT * FROM payment_disputes WHERE id = $1`, [id])
    if (rows.length === 0) return null
    return this.mapRowToDispute(rows[0])
  }

  async findByPaymentId(paymentId: string): Promise<PaymentDispute[]> {
    const pool = await this.pool()
    if (!pool) throw new Error('Database not configured')

    const { rows } = await pool.query(
      `SELECT * FROM payment_disputes WHERE payment_id = $1 ORDER BY created_at DESC`,
      [paymentId],
    )

    return rows.map(this.mapRowToDispute)
  }

  async findByUserId(userId: string): Promise<PaymentDispute[]> {
    const pool = await this.pool()
    if (!pool) throw new Error('Database not configured')

    const { rows } = await pool.query(
      `SELECT * FROM payment_disputes WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    )

    return rows.map(this.mapRowToDispute)
  }

  async updateStatus(
    id: string,
    status: PaymentDisputeStatus,
    resolution?: string,
    resolvedBy?: string,
  ): Promise<PaymentDispute> {
    const pool = await this.pool()
    if (!pool) throw new Error('Database not configured')

    await pool.query(
      `UPDATE payment_disputes 
       SET status = $2, resolution = $3, resolved_by = $4, updated_at = NOW()
       WHERE id = $1`,
      [id, status, resolution ?? null, resolvedBy ?? null],
    )

    const dispute = await this.findById(id)
    if (!dispute) throw new Error('Dispute not found')
    return dispute
  }

  async list(filter?: { status?: PaymentDisputeStatus; userId?: string; page?: number; pageSize?: number }) {
    const pool = await this.pool()
    if (!pool) throw new Error('Database not configured')

    const conditions: string[] = []
    const params: unknown[] = []
    let paramIndex = 1

    if (filter?.status) {
      conditions.push(`status = $${paramIndex++}`)
      params.push(filter.status)
    }
    if (filter?.userId) {
      conditions.push(`user_id = $${paramIndex++}`)
      params.push(filter.userId)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const page = filter?.page ?? 1
    const pageSize = Math.min(200, filter?.pageSize ?? 50)
    const offset = (page - 1) * pageSize

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM payment_disputes ${where}`,
      params,
    )
    const total = countResult.rows[0].total

    const dataResult = await pool.query(
      `SELECT * FROM payment_disputes ${where} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, pageSize, offset],
    )

    return {
      disputes: dataResult.rows.map(this.mapRowToDispute),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  }

  private mapRowToDispute(row: Record<string, unknown>): PaymentDispute {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      paymentId: row.payment_id as string,
      reason: row.reason as any,
      description: row.description as string,
      evidenceKeys: (row.evidence_keys as string[]) ?? [],
      status: row.status as PaymentDisputeStatus,
      resolution: row.resolution as string | null,
      resolvedBy: row.resolved_by as string | null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    }
  }
}

export const paymentDisputeRepository = new PaymentDisputeRepository()
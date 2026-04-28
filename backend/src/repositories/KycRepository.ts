import { getPool } from '../db.js'
import type { KycRecord, KycStatus, KycDocumentType } from '../schemas/kyc.js'
import { logger } from '../utils/logger.js'

export class KycRepository {
  private async pool() {
    const pool = await getPool()
    return pool
  }

  async create(userId: string, submission: { documentType: string; frontImageKey: string; backImageKey?: string; livenessSignal?: string }): Promise<KycRecord> {
    const pool = await this.pool()
    if (!pool) throw new Error('Database not configured')

    const frontKey = submission.frontImageKey
    const backKey = submission.backImageKey ?? null

    const { rows } = await pool.query(
      `INSERT INTO kyc_documents (user_id, document_type, front_image_key, back_image_key, liveness_signal, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [userId, submission.documentType, frontKey, backKey, submission.livenessSignal ?? null],
    )

    return this.mapRowToRecord(rows[0])
  }

  async findByUserId(userId: string): Promise<KycRecord | null> {
    const pool = await this.pool()
    if (!pool) throw new Error('Database not configured')

    const { rows } = await pool.query(
      `SELECT * FROM kyc_documents WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId],
    )

    if (rows.length === 0) return null
    return this.mapRowToRecord(rows[0])
  }

  async findById(id: string): Promise<KycRecord | null> {
    const pool = await this.pool()
    if (!pool) throw new Error('Database not configured')

    const { rows } = await pool.query(`SELECT * FROM kyc_documents WHERE id = $1`, [id])
    if (rows.length === 0) return null
    return this.mapRowToRecord(rows[0])
  }

  async updateStatus(
    id: string,
    status: KycStatus,
    providerId?: string,
    externalId?: string,
    reason?: string,
    reviewedBy?: string,
  ): Promise<KycRecord> {
    const pool = await this.pool()
    if (!pool) throw new Error('Database not configured')

    await pool.query(
      `UPDATE kyc_documents 
       SET status = $2, provider_id = COALESCE($3, provider_id), external_id = COALESCE($4, external_id),
           rejection_reason = $5, reviewed_by = $6, updated_at = NOW()
       WHERE id = $1`,
      [id, status, providerId ?? null, externalId ?? null, reason ?? null, reviewedBy ?? null],
    )

    const record = await this.findById(id)
    if (!record) throw new Error('Record not found')
    return record
  }

  async list(filter?: { status?: KycStatus; userId?: string; page?: number; pageSize?: number }) {
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
      `SELECT COUNT(*)::int AS total FROM kyc_documents ${where}`,
      params,
    )
    const total = countResult.rows[0].total

    const dataResult = await pool.query(
      `SELECT * FROM kyc_documents ${where} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, pageSize, offset],
    )

    return {
      records: dataResult.rows.map(this.mapRowToRecord),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  }

  private mapRowToRecord(row: Record<string, unknown>): KycRecord {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      documentType: row.document_type as KycDocumentType,
      frontImageKey: row.front_image_key as string,
      backImageKey: row.back_image_key ? (row.back_image_key as string) : null,
      livenessSignal: row.liveness_signal as string | null,
      status: row.status as KycStatus,
      providerId: row.provider_id as string | null,
      externalId: row.external_id as string | null,
      rejectionReason: row.rejection_reason as string | null,
      reviewedBy: row.reviewed_by as string | null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
      expiresAt: row.expires_at ? new Date(row.expires_at as string) : null,
    }
  }
}

export const kycRepository = new KycRepository()
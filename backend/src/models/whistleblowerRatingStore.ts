import { randomUUID } from 'node:crypto'
import { getPool, type PgPoolLike } from '../db.js'
import type {
  CreateWhistleblowerRatingInput,
  WhistleblowerRating,
  WhistleblowerRatingAggregate,
} from './whistleblowerRating.js'

interface WhistleblowerRatingStorePort {
  create(input: CreateWhistleblowerRatingInput): Promise<WhistleblowerRating>
  listByWhistleblower(
    whistleblowerId: string,
    opts?: { limit?: number },
  ): Promise<WhistleblowerRating[]>
  getAggregate(whistleblowerId: string): Promise<WhistleblowerRatingAggregate>
  hasTenantRatedDeal(dealId: string, tenantId: string): Promise<boolean>
  clear(): Promise<void>
}

class InMemoryWhistleblowerRatingStore implements WhistleblowerRatingStorePort {
  private ratings: WhistleblowerRating[] = []

  async create(input: CreateWhistleblowerRatingInput): Promise<WhistleblowerRating> {
    const created: WhistleblowerRating = {
      ratingId: randomUUID(),
      whistleblowerId: input.whistleblowerId,
      tenantId: input.tenantId,
      dealId: input.dealId,
      rating: input.rating,
      reviewText: input.reviewText,
      createdAt: new Date(),
    }
    this.ratings.unshift(created)
    return created
  }

  async listByWhistleblower(
    whistleblowerId: string,
    opts: { limit?: number } = {},
  ): Promise<WhistleblowerRating[]> {
    const limit = opts.limit && opts.limit > 0 ? opts.limit : 20
    return this.ratings
      .filter((r) => r.whistleblowerId === whistleblowerId)
      .slice(0, limit)
      .map((r) => ({ ...r }))
  }

  async getAggregate(whistleblowerId: string): Promise<WhistleblowerRatingAggregate> {
    const items = this.ratings.filter((r) => r.whistleblowerId === whistleblowerId)
    const count = items.length
    const sum = items.reduce((acc, r) => acc + r.rating, 0)
    const avg = count === 0 ? 0 : sum / count
    const breakdown: Record<1 | 2 | 3 | 4 | 5, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    }
    for (const r of items) {
      const key = r.rating as 1 | 2 | 3 | 4 | 5
      breakdown[key] = (breakdown[key] ?? 0) + 1
    }
    return { whistleblowerId, count, average: avg, breakdown }
  }

  async hasTenantRatedDeal(dealId: string, tenantId: string): Promise<boolean> {
    return this.ratings.some((r) => r.dealId === dealId && r.tenantId === tenantId)
  }

  async clear(): Promise<void> {
    this.ratings = []
  }
}

type RatingRow = {
  rating_id: string
  whistleblower_id: string
  tenant_id: string
  deal_id: string
  rating: number
  review_text: string | null
  created_at: Date
}

class PostgresWhistleblowerRatingStore implements WhistleblowerRatingStorePort {
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

  async hasTenantRatedDeal(dealId: string, tenantId: string): Promise<boolean> {
    const pool = await this.pool()
    const { rows } = await pool.query(
      `SELECT 1 FROM whistleblower_ratings WHERE deal_id = $1 AND tenant_id = $2 LIMIT 1`,
      [dealId, tenantId],
    )
    return rows.length > 0
  }

  async create(input: CreateWhistleblowerRatingInput): Promise<WhistleblowerRating> {
    const pool = await this.pool()
    const ratingId = randomUUID()

    const { rows } = await pool.query(
      `INSERT INTO whistleblower_ratings (
        rating_id,
        whistleblower_id,
        tenant_id,
        deal_id,
        rating,
        review_text
      ) VALUES ($1, $2, $3, $4::uuid, $5, $6)
      RETURNING *`,
      [
        ratingId,
        input.whistleblowerId,
        input.tenantId,
        input.dealId,
        input.rating,
        input.reviewText ?? null,
      ],
    )

    return this.mapRow(rows[0] as RatingRow)
  }

  async listByWhistleblower(
    whistleblowerId: string,
    opts: { limit?: number } = {},
  ): Promise<WhistleblowerRating[]> {
    const pool = await this.pool()
    const limit = opts.limit && opts.limit > 0 ? Math.min(opts.limit, 100) : 20
    const { rows } = await pool.query(
      `SELECT * FROM whistleblower_ratings
       WHERE whistleblower_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [whistleblowerId, limit],
    )
    return rows.map((r) => this.mapRow(r as RatingRow))
  }

  async getAggregate(whistleblowerId: string): Promise<WhistleblowerRatingAggregate> {
    const pool = await this.pool()
    const { rows } = await pool.query(
      `SELECT
        COUNT(*)::int AS count,
        COALESCE(AVG(rating), 0)::float AS average,
        SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END)::int AS c1,
        SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END)::int AS c2,
        SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END)::int AS c3,
        SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END)::int AS c4,
        SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END)::int AS c5
      FROM whistleblower_ratings
      WHERE whistleblower_id = $1`,
      [whistleblowerId],
    )
    const row = rows[0] as any
    return {
      whistleblowerId,
      count: Number(row?.count ?? 0),
      average: Number(row?.average ?? 0),
      breakdown: {
        1: Number(row?.c1 ?? 0),
        2: Number(row?.c2 ?? 0),
        3: Number(row?.c3 ?? 0),
        4: Number(row?.c4 ?? 0),
        5: Number(row?.c5 ?? 0),
      },
    }
  }

  async clear(): Promise<void> {
    const pool = await this.pool()
    if (process.env.NODE_ENV !== 'test') {
      throw new Error(
        'whistleblowerRatingStore.clear() is only supported in test env when using Postgres',
      )
    }
    await pool.query('TRUNCATE whistleblower_ratings RESTART IDENTITY CASCADE')
  }

  private mapRow(row: RatingRow): WhistleblowerRating {
    return {
      ratingId: row.rating_id,
      whistleblowerId: row.whistleblower_id,
      tenantId: row.tenant_id,
      dealId: row.deal_id,
      rating: row.rating,
      reviewText: row.review_text ?? undefined,
      createdAt: new Date(row.created_at),
    }
  }
}

class HybridWhistleblowerRatingStore implements WhistleblowerRatingStorePort {
  private memory = new InMemoryWhistleblowerRatingStore()
  private postgres = new PostgresWhistleblowerRatingStore()

  private async adapter(): Promise<WhistleblowerRatingStorePort> {
    if (await this.postgres.isAvailable()) return this.postgres
    return this.memory
  }

  async create(input: CreateWhistleblowerRatingInput): Promise<WhistleblowerRating> {
    return (await this.adapter()).create(input)
  }

  async listByWhistleblower(
    whistleblowerId: string,
    opts?: { limit?: number },
  ): Promise<WhistleblowerRating[]> {
    return (await this.adapter()).listByWhistleblower(whistleblowerId, opts)
  }

  async getAggregate(whistleblowerId: string): Promise<WhistleblowerRatingAggregate> {
    return (await this.adapter()).getAggregate(whistleblowerId)
  }

  async hasTenantRatedDeal(dealId: string, tenantId: string): Promise<boolean> {
    return (await this.adapter()).hasTenantRatedDeal(dealId, tenantId)
  }

  async clear(): Promise<void> {
    return (await this.adapter()).clear()
  }
}

export const whistleblowerRatingStore = new HybridWhistleblowerRatingStore()


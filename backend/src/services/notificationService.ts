import { randomUUID } from 'node:crypto'
import { getPool } from '../db.js'
import { recordKPI } from '../utils/appMetrics.js'

export type CreateNotificationInput = {
  category: string
  title: string
  body: string
  data?: Record<string, unknown>
  dedupeKey?: string
}

const mem: {
  id: string
  userId: string
  category: string
  title: string
  body: string
  data: Record<string, unknown> | null
  readAt: string | null
  createdAt: string
  dedupeKey: string | null
}[] = []

export const notificationService = {
  async create(userId: string, input: CreateNotificationInput): Promise<string> {
    const pool = await getPool()
    if (!pool) {
      if (input.dedupeKey) {
        const d = mem.find((m) => m.userId === userId && m.dedupeKey === input.dedupeKey)
        if (d) return d.id
      }
      const id = randomUUID()
      const now = new Date().toISOString()
      mem.push({
        id,
        userId,
        category: input.category,
        title: input.title,
        body: input.body,
        data: input.data ?? null,
        readAt: null,
        createdAt: now,
        dedupeKey: input.dedupeKey ?? null,
      })
      recordKPI('notificationCreated')
      return id
    }
    if (input.dedupeKey) {
      const { rows: ex } = await pool.query(
        `SELECT id FROM user_notifications WHERE user_id = $1 AND dedupe_key = $2 LIMIT 1`,
        [userId, input.dedupeKey],
      )
      if (ex.length) return (ex[0] as { id: string }).id
    }
    const { rows } = await pool.query(
      `INSERT INTO user_notifications (user_id, category, title, body, data, dedupe_key)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)
       RETURNING id`,
      [
        userId,
        input.category,
        input.title,
        input.body,
        input.data ? JSON.stringify(input.data) : null,
        input.dedupeKey ?? null,
      ],
    )
    recordKPI('notificationCreated')
    return (rows[0] as { id: string }).id
  },
}

export function _resetNotificationMemory() {
  mem.length = 0
}

export function _getNotificationMemory() {
  return mem
}

import { getPool } from '../db.js'
import { logger } from '../utils/logger.js'

class WebhookEventDedupeStore {
  private memory = new Map<string, { payloadHash: string }>()

  /**
   * @returns 'new' if this is the first time we see (rail, providerEventId);
   *          'duplicate' if the event was already recorded (replay).
   */
  async tryClaim(input: {
    rail: string
    providerEventId: string
    payloadHash: string
  }): Promise<'new' | 'duplicate'> {
    const pool = await getPool()
    if (!pool) {
      const k = `${input.rail}:${input.providerEventId}`
      const existing = this.memory.get(k)
      if (existing) {
        if (existing.payloadHash !== input.payloadHash) {
          logger.warn('Webhook dedupe: same providerEventId with different payload (in-memory)', {
            rail: input.rail,
            providerEventId: input.providerEventId,
          })
        }
        return 'duplicate'
      }
      this.memory.set(k, { payloadHash: input.payloadHash })
      return 'new'
    }

    const { rows } = await pool.query(
      `INSERT INTO webhook_event_dedupe (rail, provider_event_id, payload_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (rail, provider_event_id) DO NOTHING
       RETURNING id`,
      [input.rail, input.providerEventId, input.payloadHash],
    )
    if (rows.length > 0) {
      return 'new'
    }

    const { rows: prev } = await pool.query(
      `SELECT payload_hash FROM webhook_event_dedupe
       WHERE rail = $1 AND provider_event_id = $2`,
      [input.rail, input.providerEventId],
    )
    const ph = (prev[0] as { payload_hash: string } | undefined)?.payload_hash
    if (ph && ph !== input.payloadHash) {
      logger.warn('Webhook dedupe: same providerEventId with different payload (postgres)', {
        rail: input.rail,
        providerEventId: input.providerEventId,
      })
    }
    return 'duplicate'
  }

  clear(): void {
    this.memory.clear()
  }
}

export const webhookEventDedupeStore = new WebhookEventDedupeStore()

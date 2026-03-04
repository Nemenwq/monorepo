import { pool } from "../db.js";
import { OutboxItem } from "../outbox/types.js";




export class OutboxRepository {
  async add(item: OutboxItem) {
    await pool.query(
      `INSERT INTO outbox_items (aggregate_type, aggregate_id, event_type, payload)
       VALUES ($1,$2,$3,$4)`,
      [item.aggregateType, item.aggregateId, item.eventType, item.payload]
    );
  }

  async fetchPending() {
    const { rows } = await pool.query(`
      SELECT *
      FROM outbox_items
      WHERE status='PENDING' AND (next_retry_at IS NULL OR next_retry_at <= NOW())
      ORDER BY created_at
      LIMIT 50
      FOR UPDATE SKIP LOCKED
    `);
    return rows;
  }

  async markProcessed(id: string) {
    await pool.query(
      `UPDATE outbox_items SET status='PROCESSED', processed_at=NOW() WHERE id=$1`,
      [id]
    );
  }

  async markRetry(id: string) {
    await pool.query(
      `UPDATE outbox_items
       SET retry_count = retry_count+1,
           next_retry_at = NOW() + INTERVAL '5 minutes'
       WHERE id=$1`,
      [id]
    );
  }
}
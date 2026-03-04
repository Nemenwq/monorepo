
import { pool } from "../db.js";
import { Deal } from "../outbox/types.js";



export class DealRepository {
  async create(deal: Deal) {
    await pool.query(
      `INSERT INTO deals (id, canonical_external_ref_v1, status, payload)
       VALUES ($1, $2, $3, $4)`,
      [deal.id, deal.canonicalRef, deal.status, deal.payload]
    );
  }

  async findByCanonicalRef(ref: string) {
    const { rows } = await pool.query(
      `SELECT * FROM deals WHERE canonical_external_ref_v1 = $1`,
      [ref]
    );
    return rows[0] ?? null;
  }

  async updateStatus(id: string, status: string) {
    await pool.query(
      `UPDATE deals SET status=$2, updated_at=NOW() WHERE id=$1`,
      [id, status]
    );
  }
}


const repo = new DealRepository();

await repo.create({
  id: "uuid-1",
  canonicalRef: "test-ref",
  status: "NEW",
  payload: {}
});


const deal = await repo.findByCanonicalRef("test-ref");
console.log(deal);
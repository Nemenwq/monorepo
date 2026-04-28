import { createHash } from 'node:crypto'

export function sha256Hex(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

/** Stable JSON + SHA-256 (body hashing for idempotency / webhooks). */
export function jsonPayloadSha256Hex(value: unknown): string {
  return sha256Hex(JSON.stringify(value ?? null))
}

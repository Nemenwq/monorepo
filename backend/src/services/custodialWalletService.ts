import { createHmac, randomBytes } from 'node:crypto'

export interface EncryptedKeyRecord {
  cipherText: Buffer
  keyId: string
}

export interface KeyStore {
  getEncryptedKey(userId: string): Promise<EncryptedKeyRecord>
  getPublicAddress(userId: string): Promise<string>
}

export interface Decryptor {
  decrypt(input: Buffer, keyId: string): Promise<Buffer>
}

export interface CustodialWalletService {
  getAddress(userId: string): Promise<string>
  signSorobanTx(
    userId: string,
    xdrOrPayload: unknown,
  ): Promise<{ signature: string; publicKey: string }>
  signMessage(
    userId: string,
    message: string,
  ): Promise<{ signature: string; publicKey: string }>
}

export class CustodialWalletServiceImpl implements CustodialWalletService {
  constructor(private store: KeyStore, private decryptor: Decryptor) {}

  async getAddress(userId: string): Promise<string> {
    return this.store.getPublicAddress(userId)
  }

  async signMessage(
    userId: string,
    message: string,
  ): Promise<{ signature: string; publicKey: string }> {
    const { cipherText, keyId } = await this.store.getEncryptedKey(userId)
    const privateMaterial = await this.decryptor.decrypt(cipherText, keyId)
    const signature = this.hmacSha256(privateMaterial, Buffer.from(message))
    const publicKey = await this.store.getPublicAddress(userId)
    return { signature, publicKey }
  }

  async signSorobanTx(
    userId: string,
    xdrOrPayload: unknown,
  ): Promise<{ signature: string; publicKey: string }> {
    const { cipherText, keyId } = await this.store.getEncryptedKey(userId)
    const privateMaterial = await this.decryptor.decrypt(cipherText, keyId)
    const payloadBytes = this.normalizePayload(xdrOrPayload)
    const signature = this.hmacSha256(privateMaterial, payloadBytes)
    const publicKey = await this.store.getPublicAddress(userId)
    return { signature, publicKey }
  }

  private normalizePayload(xdrOrPayload: unknown): Buffer {
    if (xdrOrPayload == null) return Buffer.alloc(0)
    if (typeof xdrOrPayload === 'string') return Buffer.from(xdrOrPayload)
    if (xdrOrPayload instanceof Uint8Array) return Buffer.from(xdrOrPayload)
    return Buffer.from(JSON.stringify(xdrOrPayload))
  }

  private hmacSha256(secret: Buffer, data: Buffer): string {
    const h = createHmac('sha256', secret)
    h.update(data)
    return h.digest('base64')
  }
}

export class InMemoryDecryptor implements Decryptor {
  constructor(private keyMap: Map<string, Buffer>) {}
  async decrypt(input: Buffer, keyId: string): Promise<Buffer> {
    const k = this.keyMap.get(keyId)
    if (!k) throw new Error(`Missing decrypt key for ${keyId}`)
    const ivLen = Math.min(16, input.length)
    const iv = input.subarray(0, ivLen)
    const payload = input.subarray(ivLen)
    const out = Buffer.alloc(payload.length)
    for (let i = 0; i < payload.length; i++) {
      out[i] = payload[i] ^ k[i % k.length] ^ iv[i % iv.length]
    }
    return out
  }
}

export function createEncryptedKeyRecord(plain: Buffer, keyId: string): EncryptedKeyRecord {
  const iv = randomBytes(16)
  const mask = randomBytes(32)
  const enc = Buffer.alloc(plain.length)
  for (let i = 0; i < plain.length; i++) {
    enc[i] = plain[i] ^ mask[i % mask.length]
  }
  return { cipherText: Buffer.concat([iv, enc]), keyId }
}

import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { createPaymentsRouter } from '../routes/payments.js'
import { StubSorobanAdapter } from '../soroban/stub-adapter.js'
import {
  CustodialWalletServiceImpl,
  type KeyStore,
  type EncryptedKeyRecord,
  type Decryptor,
} from './custodialWalletService.js'
import { TxType } from '../outbox/types.js'

class MockStore implements KeyStore {
  constructor(private records: Map<string, { plain: Buffer; address: string }>) {}
  async getEncryptedKey(userId: string): Promise<EncryptedKeyRecord> {
    const r = this.records.get(userId)
    if (!r) throw new Error('missing user')
    const iv = Buffer.alloc(16, 1)
    const cipherText = Buffer.concat([iv, r.plain])
    return { cipherText, keyId: `kid-${userId}` }
  }
  async getPublicAddress(userId: string): Promise<string> {
    const r = this.records.get(userId)
    if (!r) throw new Error('missing user')
    return r.address
  }
}

class MockDecryptor implements Decryptor {
  calls = 0
  async decrypt(input: Buffer): Promise<Buffer> {
    this.calls++
    return input.subarray(16)
  }
}

describe('CustodialWalletService boundary', () => {
  let store: MockStore
  let decryptor: MockDecryptor
  let service: CustodialWalletServiceImpl

  beforeEach(() => {
    store = new MockStore(
      new Map([
        ['user-1', { plain: Buffer.from('supersecret'), address: 'GTESTADDR1' }],
      ]),
    )
    decryptor = new MockDecryptor()
    service = new CustodialWalletServiceImpl(store, decryptor)
  })

  it('decrypts only inside service and signs message', async () => {
    const res = await service.signMessage('user-1', 'hello')
    expect(res.publicKey).toBe('GTESTADDR1')
    expect(typeof res.signature).toBe('string')
    expect(decryptor.calls).toBe(1)
  })

  it('routes never touch decrypted keys', async () => {
    const app = express()
    app.use(express.json())
    const adapter = new StubSorobanAdapter({
      rpcUrl: 'http://localhost:1337',
      networkPassphrase: 'Test',
    })
    app.use('/api/payments', createPaymentsRouter(adapter))
    const baselineCalls = decryptor.calls
    const body = {
      dealId: 'deal-123',
      txType: TxType.TENANT_REPAYMENT,
      amountUsdc: '1.00',
      tokenAddress: 'USDC-ADDR',
      externalRefSource: 'stripe',
      externalRef: 'pi_abc123',
    }
    const resp = await request(app).post('/api/payments/confirm').send(body)
    expect([200, 202]).toContain(resp.status)
    expect(decryptor.calls).toBe(baselineCalls)
  })
})

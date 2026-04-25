import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MetricsSorobanAdapter } from './metrics-adapter.js'
import { SorobanAdapter, RecordReceiptParams } from './adapter.js'
import { SorobanConfig } from './client.js'
import { RawReceiptEvent } from '../indexer/event-parser.js'

vi.mock('../utils/metrics.js', () => ({
  recordSorobanRpcCall: vi.fn(),
}))

import { recordSorobanRpcCall } from '../utils/metrics.js'

const baseConfig: SorobanConfig = {
  rpcUrl: 'http://localhost:8000',
  networkPassphrase: 'Test SDF Network ; September 2015',
}

function makeWrapped(overrides: Partial<SorobanAdapter> = {}): SorobanAdapter {
  return {
    getBalance: vi.fn().mockResolvedValue(BigInt(0)),
    credit: vi.fn().mockResolvedValue(undefined),
    debit: vi.fn().mockResolvedValue(undefined),
    getStakedBalance: vi.fn().mockResolvedValue(BigInt(0)),
    getClaimableRewards: vi.fn().mockResolvedValue(BigInt(0)),
    recordReceipt: vi.fn().mockResolvedValue(undefined),
    getConfig: vi.fn().mockReturnValue(baseConfig),
    getReceiptEvents: vi.fn().mockResolvedValue([]),
    getTimelockEvents: vi.fn().mockResolvedValue([]),
    executeTimelock: vi.fn().mockResolvedValue('tx-hash'),
    cancelTimelock: vi.fn().mockResolvedValue('tx-hash'),
    ...overrides,
  }
}

describe('MetricsSorobanAdapter - optional admin operations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('pause', () => {
    it('delegates to wrapped adapter and tracks the call', async () => {
      const wrapped = makeWrapped({
        pause: vi.fn().mockResolvedValue('pause-tx'),
      })
      const adapter = new MetricsSorobanAdapter(wrapped)

      const result = await adapter.pause!('contract-id')

      expect(result).toBe('pause-tx')
      expect(wrapped.pause).toHaveBeenCalledWith('contract-id')
      expect(recordSorobanRpcCall).toHaveBeenCalledWith('pause', expect.any(Number), true, undefined)
    })

    it('tracks failure when wrapped adapter throws', async () => {
      const wrapped = makeWrapped({
        pause: vi.fn().mockRejectedValue(new TypeError('network error')),
      })
      const adapter = new MetricsSorobanAdapter(wrapped)

      await expect(adapter.pause!('contract-id')).rejects.toThrow('network error')
      expect(recordSorobanRpcCall).toHaveBeenCalledWith('pause', expect.any(Number), false, 'TypeError')
    })

    it('throws when wrapped adapter does not implement pause', async () => {
      const wrapped = makeWrapped()
      const adapter = new MetricsSorobanAdapter(wrapped)

      await expect(adapter.pause!('contract-id')).rejects.toThrow('pause not implemented')
    })
  })

  describe('unpause', () => {
    it('delegates to wrapped adapter and tracks the call', async () => {
      const wrapped = makeWrapped({
        unpause: vi.fn().mockResolvedValue('unpause-tx'),
      })
      const adapter = new MetricsSorobanAdapter(wrapped)

      const result = await adapter.unpause!('contract-id')

      expect(result).toBe('unpause-tx')
      expect(wrapped.unpause).toHaveBeenCalledWith('contract-id')
      expect(recordSorobanRpcCall).toHaveBeenCalledWith('unpause', expect.any(Number), true, undefined)
    })

    it('tracks failure when wrapped adapter throws', async () => {
      const wrapped = makeWrapped({
        unpause: vi.fn().mockRejectedValue(new RangeError('timeout')),
      })
      const adapter = new MetricsSorobanAdapter(wrapped)

      await expect(adapter.unpause!('contract-id')).rejects.toThrow('timeout')
      expect(recordSorobanRpcCall).toHaveBeenCalledWith('unpause', expect.any(Number), false, 'RangeError')
    })

    it('throws when wrapped adapter does not implement unpause', async () => {
      const wrapped = makeWrapped()
      const adapter = new MetricsSorobanAdapter(wrapped)

      await expect(adapter.unpause!('contract-id')).rejects.toThrow('unpause not implemented')
    })
  })

  describe('setOperator', () => {
    it('delegates to wrapped adapter with operator address and tracks the call', async () => {
      const wrapped = makeWrapped({
        setOperator: vi.fn().mockResolvedValue('set-op-tx'),
      })
      const adapter = new MetricsSorobanAdapter(wrapped)

      const result = await adapter.setOperator!('contract-id', 'operator-addr')

      expect(result).toBe('set-op-tx')
      expect(wrapped.setOperator).toHaveBeenCalledWith('contract-id', 'operator-addr')
      expect(recordSorobanRpcCall).toHaveBeenCalledWith('setOperator', expect.any(Number), true, undefined)
    })

    it('delegates with null operator address', async () => {
      const wrapped = makeWrapped({
        setOperator: vi.fn().mockResolvedValue('clear-op-tx'),
      })
      const adapter = new MetricsSorobanAdapter(wrapped)

      const result = await adapter.setOperator!('contract-id', null)

      expect(result).toBe('clear-op-tx')
      expect(wrapped.setOperator).toHaveBeenCalledWith('contract-id', null)
    })

    it('tracks failure when wrapped adapter throws', async () => {
      const wrapped = makeWrapped({
        setOperator: vi.fn().mockRejectedValue(new Error('unauthorized')),
      })
      const adapter = new MetricsSorobanAdapter(wrapped)

      await expect(adapter.setOperator!('contract-id', 'op')).rejects.toThrow('unauthorized')
      expect(recordSorobanRpcCall).toHaveBeenCalledWith('setOperator', expect.any(Number), false, 'Error')
    })

    it('throws when wrapped adapter does not implement setOperator', async () => {
      const wrapped = makeWrapped()
      const adapter = new MetricsSorobanAdapter(wrapped)

      await expect(adapter.setOperator!('contract-id', 'op')).rejects.toThrow('setOperator not implemented')
    })
  })

  describe('init', () => {
    it('delegates to wrapped adapter with admin and operator and tracks the call', async () => {
      const wrapped = makeWrapped({
        init: vi.fn().mockResolvedValue('init-tx'),
      })
      const adapter = new MetricsSorobanAdapter(wrapped)

      const result = await adapter.init!('contract-id', 'admin-addr', 'operator-addr')

      expect(result).toBe('init-tx')
      expect(wrapped.init).toHaveBeenCalledWith('contract-id', 'admin-addr', 'operator-addr')
      expect(recordSorobanRpcCall).toHaveBeenCalledWith('init', expect.any(Number), true, undefined)
    })

    it('delegates to wrapped adapter without optional operator', async () => {
      const wrapped = makeWrapped({
        init: vi.fn().mockResolvedValue('init-tx'),
      })
      const adapter = new MetricsSorobanAdapter(wrapped)

      const result = await adapter.init!('contract-id', 'admin-addr')

      expect(result).toBe('init-tx')
      expect(wrapped.init).toHaveBeenCalledWith('contract-id', 'admin-addr', undefined)
    })

    it('tracks failure when wrapped adapter throws', async () => {
      const wrapped = makeWrapped({
        init: vi.fn().mockRejectedValue(new Error('already initialized')),
      })
      const adapter = new MetricsSorobanAdapter(wrapped)

      await expect(adapter.init!('contract-id', 'admin-addr')).rejects.toThrow('already initialized')
      expect(recordSorobanRpcCall).toHaveBeenCalledWith('init', expect.any(Number), false, 'Error')
    })

    it('throws when wrapped adapter does not implement init', async () => {
      const wrapped = makeWrapped()
      const adapter = new MetricsSorobanAdapter(wrapped)

      await expect(adapter.init!('contract-id', 'admin-addr')).rejects.toThrow('init not implemented')
    })
  })
})

import { describe, it, expect } from 'vitest'
import { createTestAgent, expectRequestId, expectErrorShape } from '../test-helpers.js'

describe('Integration Tests', () => {
  const request = createTestAgent()

  describe('GET /health', () => {
    it('should return 200 with correct response shape', async () => {
      const response = await request.get('/health')

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('status', 'ok')
      expect(response.body).toHaveProperty('uptimeSeconds')
      expect(typeof response.body.uptimeSeconds).toBe('number')
      expect(response.body).toHaveProperty('requestId')
      expect(typeof response.body.requestId).toBe('string')
    })

    it('should include x-request-id header', async () => {
      const response = await request.get('/health')

      expectRequestId(response)
    })

    it('should reuse client-provided x-request-id header', async () => {
      const clientRequestId = 'test-request-id-123'
      const response = await request
        .get('/health')
        .set('x-request-id', clientRequestId)

      expect(response.status).toBe(200)
      expect(response.headers['x-request-id']).toBe(clientRequestId)
      expect(response.body.requestId).toBe(clientRequestId)
    })
  })

  describe('GET /health/details', () => {
    it('should return 200 with correct response shape', async () => {
      const response = await request.get('/health/details')

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('version')
      expect(typeof response.body.version).toBe('string')
      expect(response.body).toHaveProperty('nodeEnv')
      expect(typeof response.body.nodeEnv).toBe('string')
      expect(response.body).toHaveProperty('uptimeSeconds')
      expect(typeof response.body.uptimeSeconds).toBe('number')
      expect(response.body).toHaveProperty('dbConnected')
      expect(typeof response.body.dbConnected).toBe('boolean')
      expect(response.body).toHaveProperty('requestId')
      expect(typeof response.body.requestId).toBe('string')
    })

    it('should include x-request-id header', async () => {
      const response = await request.get('/health/details')

      expectRequestId(response)
    })

    it('should not expose forbidden diagnostic fields', async () => {
      const response = await request.get('/health/details')

      expect(response.status).toBe(200)
      expect(response.body).not.toHaveProperty('process.env')
      expect(response.body).not.toHaveProperty('DATABASE_URL')
      expect(response.body).not.toHaveProperty('databaseEnabled')
      expect(response.body).not.toHaveProperty('databasePool')
      expect(response.body).not.toHaveProperty('sorobanAdapterMode')
    })
  })

  describe('GET /soroban/config', () => {
    it('should return 200 with correct config shape', async () => {
      const response = await request.get('/soroban/config')

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('rpcUrl')
      expect(typeof response.body.rpcUrl).toBe('string')
      expect(response.body).toHaveProperty('networkPassphrase')
      expect(typeof response.body.networkPassphrase).toBe('string')
      expect(response.body).toHaveProperty('contractId')
      // contractId can be string or null
      expect(
        typeof response.body.contractId === 'string' ||
        response.body.contractId === null
      ).toBe(true)
    })

    it('should include x-request-id header', async () => {
      const response = await request.get('/soroban/config')

      expectRequestId(response)
    })
  })

  describe('Error handling', () => {
    it('should return 404 with correct error shape for non-existent routes', async () => {
      const response = await request.get('/non-existent-route')

      expectErrorShape(response, 'NOT_FOUND', 404)
    })

    it('should include x-request-id header in 404 responses', async () => {
      const response = await request.get('/non-existent-route')

      expect(response.status).toBe(404)
      expectRequestId(response)
    })

    it('should return 400 with correct error shape for invalid JSON body', async () => {
      const response = await request
        .post('/api/example/echo')
        .set('Content-Type', 'application/json')
        .send('invalid json{{')

      expectErrorShape(response, 'VALIDATION_ERROR', 400)
    })

    it('should return 400 with validation error for invalid input', async () => {
      const response = await request
        .post('/api/example/echo')
        .send({ message: '' })

      expectErrorShape(response, 'VALIDATION_ERROR', 400)
      expect(response.body.error).toHaveProperty('details')
    })
  })
})

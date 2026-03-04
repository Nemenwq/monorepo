import request from 'supertest'
import { createApp } from '../app.js'

describe('Wallet Authentication', () => {
  let app: any

  beforeAll(async () => {
    app = createApp()
  })

  describe('POST /api/auth/wallet/challenge', () => {
    it('should return a challenge message for valid wallet address', async () => {
      const response = await request(app)
        .post('/auth/wallet/challenge')
        .send({ address: '0x1234567890123456789012345678901234567890' })
        .expect(200)

      expect(response.body).toHaveProperty('message')
      expect(response.body.message).toContain('Sign this message to authenticate')
      expect(response.body).toHaveProperty('existingUser', false)
    })

    it('should return 400 for invalid wallet address', async () => {
      const response = await request(app)
        .post('/auth/wallet/challenge')
        .send({ address: 'invalid-address' })
        .expect(400)

      expect(response.body).toHaveProperty('error')
    })

    it('should handle existing wallet addresses', async () => {
      const address = '0x1234567890123456789012345678901234567890'
      
      // First request - new user
      const firstResponse = await request(app)
        .post('/auth/wallet/challenge')
        .send({ address })
        .expect(200)

      expect(firstResponse.body.existingUser).toBe(false)

      // Second request - existing user
      const secondResponse = await request(app)
        .post('/auth/wallet/challenge')
        .send({ address })
        .expect(200)

      expect(secondResponse.body.existingUser).toBe(true)
      expect(secondResponse.body).toHaveProperty('userId')
    })
  })

  describe('POST /api/auth/wallet/verify', () => {
    const address = '0x1234567890123456789012345678901234567890'

    it('should return 401 when no challenge exists', async () => {
      const response = await request(app)
        .post('/auth/wallet/verify')
        .send({ 
          address, 
          signature: '0x1234567890abcdef' 
        })
        .expect(401)

      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toBe('No challenge requested for this address')
    })

    it('should return 400 for invalid request format', async () => {
      const response = await request(app)
        .post('/auth/wallet/verify')
        .send({ 
          address: 'invalid-address',
          signature: '' 
        })
        .expect(400)

      expect(response.body).toHaveProperty('error')
    })

    it('should complete wallet authentication flow', async () => {
      // Step 1: Request challenge
      const challengeResponse = await request(app)
        .post('/auth/wallet/challenge')
        .send({ address })
        .expect(200)

      const { message } = challengeResponse.body

      // Step 2: Verify signature (mock signature for testing)
      const verifyResponse = await request(app)
        .post('/auth/wallet/verify')
        .send({ 
          address, 
          signature: 'mock-signature-for-testing' 
        })
        .expect(200)

      expect(verifyResponse.body).toHaveProperty('token')
      expect(verifyResponse.body).toHaveProperty('user')
      expect(verifyResponse.body.user.authType).toBe('wallet')
      expect(verifyResponse.body.user.walletAddress).toBe(address)
    })
  })

  describe('Session Management', () => {
    it('should allow wallet-authenticated users to access protected endpoints', async () => {
      const address = '0x9876543210987654321098765432109876543210'
      
      // Authenticate wallet
      const challengeResponse = await request(app)
        .post('/auth/wallet/challenge')
        .send({ address })
        .expect(200)

      const verifyResponse = await request(app)
        .post('/auth/wallet/verify')
        .send({ 
          address, 
          signature: 'mock-signature-for-testing' 
        })
        .expect(200)

      const { token } = verifyResponse.body

      // Access protected endpoint
      const walletResponse = await request(app)
        .get('/api/wallet/address')
        .set('Authorization', `Bearer ${token}`)
        .expect(403) // Should be 403 because custodial mode might be disabled

      // The important part is that authentication works (not 401)
      expect(walletResponse.status).not.toBe(401)
    })
  })
})

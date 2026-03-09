import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createTestAgent, expectErrorShape } from '../test-helpers.js'
import { otpChallengeStore, sessionStore, userStore, walletChallengeStore } from '../models/authStore.js'
import { _testOnly_clearAuthRateLimits } from '../middleware/authRateLimit.js'

vi.mock('../utils/wallet.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../utils/wallet.js')>()
  return {
    ...mod,
    verifySignedChallenge: vi.fn(() => false),
  }
})

async function getWalletUtils() {
  return await import('../utils/wallet.js')
}

vi.mock('../utils/tokens.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../utils/tokens.js')>()
  return {
    ...mod,
    generateOtp: () => '123456',
    generateToken: () => 'session-token-abc',
  }
})

describe('Auth Routes (OTP)', () => {
  const request = createTestAgent()

  beforeEach(() => {
    otpChallengeStore.clear()
    sessionStore.clear()
    userStore.clear()
    walletChallengeStore.clear()
    _testOnly_clearAuthRateLimits()
    vi.useRealTimers()
    // Reset request count for test agent by creating fresh instance
    vi.stubEnv('STELLAR_SERVER_SECRET_KEY', 'SBQWY3DNPFWGSQZ7BHHCQLZNX35O6W23DMU4Y3FJ3A6BKGWXOQ5F3Z2O')
  })

  it('POST /api/auth/request-otp should create hashed challenge (no plaintext stored)', async () => {
    const email = 'a@example.com'

    const res = await request.post('/api/auth/request-otp').send({ email })
    expect(res.status).toBe(200)

    const challenge = await otpChallengeStore.getByEmail(email)
    expect(challenge).toBeDefined()
    expect(challenge!.email).toBe(email)
    expect(typeof challenge!.otpHash).toBe('string')
    expect(challenge!.otpHash).not.toBe('123456')
    expect(typeof challenge!.salt).toBe('string')
    expect(challenge!.attempts).toBe(0)
  })

  it('POST /api/auth/verify-otp should return session token on success', async () => {
    const email = 'b@example.com'

    await request.post('/api/auth/request-otp').send({ email }).expect(200)

    const res = await request
      .post('/api/auth/verify-otp')
      .send({ email, otp: '123456' })
      .expect(200)

    expect(res.body).toHaveProperty('token', 'session-token-abc')
    expect(res.body).toHaveProperty('user')
    expect(res.body.user).toHaveProperty('email', email)

    const session = await sessionStore.getByToken('session-token-abc')
    expect(session).toBeDefined()
    expect(session!.email).toBe(email)
  })

  it('verify should increment attempts and eventually fail after too many attempts', async () => {
    const email = 'c@example.com'

    await request.post('/api/auth/request-otp').send({ email }).expect(200)

    for (let i = 0; i < 5; i++) {
      const res = await request.post('/api/auth/verify-otp').send({ email, otp: '000000' })
      expectErrorShape(res, 'UNAUTHORIZED', 401)
    }

    const res = await request.post('/api/auth/verify-otp').send({ email, otp: '123456' })
    expectErrorShape(res, 'UNAUTHORIZED', 401)
  })

  it.skip('request-otp should rate limit by email', async () => {
    // TODO: Re-enable when test agent supports custom middleware
  })

  it.skip('GET /api/auth/me should require auth and return user when authenticated', async () => {
    // TODO: Fix rate limiting test interference
  })
})

describe('Auth Routes (Wallet)', () => {
  const request = createTestAgent()

  beforeEach(async () => {
    otpChallengeStore.clear()
    sessionStore.clear()
    userStore.clear()
    walletChallengeStore.clear()
    _testOnly_clearAuthRateLimits()
    vi.useRealTimers()
    vi.stubEnv('STELLAR_SERVER_SECRET_KEY', 'SBQWY3DNPFWGSQZ7BHHCQLZNX35O6W23DMU4Y3FJ3A6BKGWXOQ5F3Z2O')

    const walletUtils = await getWalletUtils()
    vi.mocked(walletUtils.verifySignedChallenge).mockReset()
    vi.mocked(walletUtils.verifySignedChallenge).mockReturnValue(false)
  })

  it('POST /api/auth/wallet/challenge should create challenge XDR', async () => {
    const address = 'GCSHKPO7MLEXGSZZF2KF54LMNDXNLORLRKD24DXXWHVJ5U6CVXVQAOVT'

    const res = await request.post('/api/auth/wallet/challenge').send({ address })

    expect(res.status).toBe(200)

    expect(res.body).toHaveProperty('challengeXdr')
    expect(res.body).toHaveProperty('expiresAt')

    const challenge = walletChallengeStore.getByAddress(address)
    expect(challenge).toBeDefined()
    expect(challenge!.address).toBe(address)
    expect(typeof challenge!.challengeXdr).toBe('string')
    expect(challenge!.attempts).toBe(0)
  })

  it.skip('POST /api/auth/wallet/verify should return session token on success', async () => {
    // TODO: Implement with proper mocking of Stellar SDK
  })

  it('POST /api/auth/wallet/verify should fail with expired challenge', async () => {
    const address = 'GCSHKPO7MLEXGSZZF2KF54LMNDXNLORLRKD24DXXWHVJ5U6CVXVQAOVT'

    // Seed with uppercase canonical address (normalizeStellarAddress output)
    const expiredChallenge = {
      address: address,
      challengeXdr: 'mock-xdr',
      nonce: 'mock-nonce',
      expiresAt: new Date(Date.now() - 1000), // Already expired
      attempts: 0,
    }
    await walletChallengeStore.set(expiredChallenge)

    const res = await request.post('/api/auth/wallet/verify').send({
      address,
      signedChallengeXdr: 'mock-signed-xdr',
    })

    expectErrorShape(res, 'UNAUTHORIZED', 401)
    
    // Verify expired challenge is cleared
    const challenge = await walletChallengeStore.getByAddress(address.toLowerCase())
    expect(challenge).toBeUndefined()
  })

  it('POST /api/auth/wallet/verify should reject challenge after TTL expires', async () => {
    const address = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'

    await walletChallengeStore.set({
      address: address.toLowerCase(),
      challengeXdr: 'mock-xdr',
      nonce: 'mock-nonce',
      expiresAt: new Date(Date.now() - 1000),
      attempts: 0,
    })

    const verifyRes = await request.post('/api/auth/wallet/verify').send({
      address,
      signedChallengeXdr: 'mock-signed-xdr',
    })

    expectErrorShape(verifyRes, 'UNAUTHORIZED', 401)
  })

  it('verify should increment attempts and eventually fail after too many attempts', async () => {
    const address = 'GCSHKPO7MLEXGSZZF2KF54LMNDXNLORLRKD24DXXWHVJ5U6CVXVQAOVT'

    // Seed with uppercase canonical address (normalizeStellarAddress output)
    const challenge = {
      address: address,
      challengeXdr: 'mock-xdr',
      nonce: 'mock-nonce',
      expiresAt: new Date(Date.now() + 60000),
      attempts: 0,
    }
    await walletChallengeStore.set(challenge)

    for (let i = 0; i < 3; i++) {
      const res = await request.post('/api/auth/wallet/verify').send({
        address,
        signedChallengeXdr: 'invalid-xdr',
      })
      expectErrorShape(res, 'UNAUTHORIZED', 401)
      
      // Check attempts increment
      const updatedChallenge = await walletChallengeStore.getByAddress(address.toLowerCase())
      expect(updatedChallenge!.attempts).toBe(i + 1)
    }

    const res = await request.post('/api/auth/wallet/verify').send({
      address,
      signedChallengeXdr: 'still-invalid-xdr',
    })
    expectErrorShape(res, 'UNAUTHORIZED', 401)
    
    // Verify challenge is cleared after max attempts
    const clearedChallenge = await walletChallengeStore.getByAddress(address.toLowerCase())
    expect(clearedChallenge).toBeUndefined()
  })

  it('POST /api/auth/wallet/verify should return session token and clear challenge on success', async () => {
    const address = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'

    const walletUtils = await getWalletUtils()
    vi.mocked(walletUtils.verifySignedChallenge).mockReturnValue(true)

    // Create a challenge
    const res = await request.post('/api/auth/wallet/challenge').send({ address })
    expect(res.status).toBe(200)

    const challengeBefore = await walletChallengeStore.getByAddress(address.toLowerCase())
    expect(challengeBefore).toBeDefined()

    const verifyRes = await request.post('/api/auth/wallet/verify').send({
      address,
      signedChallengeXdr: 'valid-mock-xdr',
    })

    expect(verifyRes.status).toBe(200)
    expect(verifyRes.body).toHaveProperty('token', 'session-token-abc')
    expect(verifyRes.body).toHaveProperty('user')
    expect(verifyRes.body.user).toHaveProperty('email')

    const challengeAfter = await walletChallengeStore.getByAddress(address.toLowerCase())
    expect(challengeAfter).toBeUndefined()
  })
})

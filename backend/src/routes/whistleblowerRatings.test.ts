import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { sessionStore, userStore } from '../models/authStore.js'
import { generateToken } from '../utils/tokens.js'
import { whistleblowerRatingStore } from '../models/whistleblowerRatingStore.js'

describe('Whistleblower ratings API', () => {
  let app: any
  let token: string

  beforeEach(async () => {
    await whistleblowerRatingStore.clear()
    sessionStore.clear()
    userStore.clear()

    const tenant = await userStore.getOrCreateByEmail('tenant@test.com')
    token = generateToken()
    await sessionStore.create(tenant.email, token)

    app = createApp()
  })

  it('creates a rating and shows up in aggregate', async () => {
    const createRes = await request(app)
      .post('/api/whistleblower/ratings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        whistleblowerId: 'wb-001',
        dealId: '550e8400-e29b-41d4-a716-446655440000',
        rating: 5,
        reviewText: 'Great experience',
      })
      .expect(201)

    expect(createRes.body.success).toBe(true)
    expect(createRes.body.rating.rating).toBe(5)

    const aggRes = await request(app)
      .get('/api/whistleblower/wb-001/ratings/aggregate')
      .expect(200)

    expect(aggRes.body.success).toBe(true)
    expect(aggRes.body.aggregate.whistleblowerId).toBe('wb-001')
    expect(aggRes.body.aggregate.count).toBe(1)
    expect(aggRes.body.aggregate.average).toBe(5)
    expect(aggRes.body.aggregate.breakdown['5']).toBe(1)
  })

  it('rejects invalid rating values with structured validation errors', async () => {
    const res = await request(app)
      .post('/api/whistleblower/ratings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        whistleblowerId: 'wb-001',
        dealId: 'deal-1',
        rating: 6,
      })
      .expect(400)

    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.message).toBe('Invalid request data')
    expect(typeof res.body.error.details.rating).toBe('string')
  })

  it('prevents duplicate submissions for same deal by same tenant', async () => {
    const payload = {
      whistleblowerId: 'wb-001',
      dealId: 'deal-dup',
      rating: 4,
      reviewText: 'Solid',
    }

    await request(app)
      .post('/api/whistleblower/ratings')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(201)

    const res2 = await request(app)
      .post('/api/whistleblower/ratings')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(409)

    expect(res2.body.error.code).toBe('DUPLICATE_REQUEST')
  })
})


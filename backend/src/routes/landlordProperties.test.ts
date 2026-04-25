import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createTestAgent, expectErrorShape } from '../test-helpers.js'
import { landlordPropertyStore } from '../models/landlordPropertyStore.js'
import { userStore, sessionStore } from '../models/authStore.js'
import { PropertyStatus } from '../models/landlordProperty.js'

describe('Landlord Properties API', () => {
  const request = createTestAgent()
  const landlordId = 'test-landlord-id'
  const landlordEmail = 'landlord@test.com'
  const token = 'test-landlord-token'

  beforeEach(async () => {
    await landlordPropertyStore.clear()
    userStore.clear()
    sessionStore.clear()

    // Setup landlord user in fallback cache
    // @ts-ignore - reaching into private fallbackCache for testing
    userStore.fallbackCache.set(landlordEmail, {
      id: landlordId,
      email: landlordEmail,
      name: 'Test Landlord',
      role: 'landlord',
      createdAt: new Date(),
    })

    // Setup session in fallback cache
    // @ts-ignore - reaching into private fallbackCache for testing
    sessionStore.fallbackCache.set(token, {
      token,
      email: landlordEmail,
      createdAt: new Date(),
    })
    
    // Mock the postgres repo to fail so it uses fallback cache
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  describe('POST /api/landlord/properties', () => {
    const validProperty = {
      title: 'Luxury Apartment',
      address: '123 Victoria Island',
      city: 'Lagos',
      area: 'VI',
      bedrooms: 3,
      bathrooms: 3,
      sqm: 150,
      annualRentNgn: 5000000,
      description: 'A beautiful luxury apartment with ocean view',
      photos: [
        'https://example.com/p1.jpg',
        'https://example.com/p2.jpg',
        'https://example.com/p3.jpg',
      ],
    }

    it('should create a property successfully', async () => {
      const response = await request
        .post('/api/landlord/properties')
        .set('Authorization', `Bearer ${token}`)
        .send(validProperty)

      expect(response.status).toBe(201)
      expect(response.body.title).toBe(validProperty.title)
      expect(response.body.landlordId).toBe(landlordId)
      expect(response.body.status).toBe(PropertyStatus.PENDING)
    })

    it('accepts the frontend wizard payload shape', async () => {
      const response = await request
        .post('/api/landlord/properties')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Wizard Property',
          description: 'From wizard',
          propertyType: 'apartment',
          location: 'vi',
          address: '12 Test Street, VI',
          price: '3500000',
          beds: '3',
          baths: '2',
          sqm: '120',
          yearBuilt: '2020',
          amenities: ['24/7 Security', 'Parking Space'],
          images: [
            { id: 'living-1', roomType: 'living', preview: '/placeholder.svg?text=living' },
          ],
        })

      expect(response.status).toBe(201)
      expect(response.body.title).toBe('Wizard Property')
      expect(response.body.landlordId).toBe(landlordId)
      expect(response.body.bedrooms).toBe(3)
      expect(response.body.bathrooms).toBe(2)
      expect(response.body.annualRentNgn).toBe(3500000)
      expect(Array.isArray(response.body.photos)).toBe(true)
    })

    it('should return 401 without token', async () => {
      const response = await request
        .post('/api/landlord/properties')
        .send(validProperty)

      expectErrorShape(response, 'UNAUTHORIZED', 401)
    })

    it('should return 403 if user is not a landlord', async () => {
      const tenantEmail = 'tenant@test.com'
      const tenantToken = 'tenant-token'
      
      // @ts-ignore
      userStore.fallbackCache.set(tenantEmail, {
        id: 'test-tenant-id',
        email: tenantEmail,
        name: 'Test Tenant',
        role: 'tenant',
        createdAt: new Date(),
      })
      // @ts-ignore
      sessionStore.fallbackCache.set(tenantToken, {
        token: tenantToken,
        email: tenantEmail,
        createdAt: new Date(),
      })

      const response = await request
        .post('/api/landlord/properties')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send(validProperty)

      expectErrorShape(response, 'FORBIDDEN', 403)
    })

    it('should validate required fields', async () => {
      const response = await request
        .post('/api/landlord/properties')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: '', // Empty title
        })

      expectErrorShape(response, 'VALIDATION_ERROR', 400)
    })
  })

  describe('GET /api/landlord/properties', () => {
    beforeEach(async () => {
      await landlordPropertyStore.create({
        landlordId,
        title: 'Prop 1',
        address: 'Addr 1',
        bedrooms: 1,
        bathrooms: 1,
        annualRentNgn: 1000000,
        photos: ['https://ex.com/1.jpg'],
      })
      await landlordPropertyStore.create({
        landlordId: 'other-landlord',
        title: 'Other Prop',
        address: 'Addr 2',
        bedrooms: 2,
        bathrooms: 2,
        annualRentNgn: 2000000,
        photos: ['https://ex.com/2.jpg'],
      })
    })

    it('should list only landlord-owned properties', async () => {
      const response = await request
        .get('/api/landlord/properties')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.properties).toHaveLength(1)
      expect(response.body.properties[0].landlordId).toBe(landlordId)
      expect(response.body.total).toBe(1)
    })

    it('should filter by query', async () => {
      const response = await request
        .get('/api/landlord/properties?query=Prop')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.properties).toHaveLength(1)
    })
  })

  describe('PATCH /api/landlord/properties/:id', () => {
    it('should update a property successfully', async () => {
      const property = await landlordPropertyStore.create({
        landlordId,
        title: 'Original Title',
        address: 'Address',
        bedrooms: 1,
        bathrooms: 1,
        annualRentNgn: 1000000,
        photos: ['https://ex.com/1.jpg'],
      })

      const response = await request
        .patch(`/api/landlord/properties/${property.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'New Title', status: PropertyStatus.ACTIVE })

      expect(response.status).toBe(200)
      expect(response.body.title).toBe('New Title')
      expect(response.body.status).toBe(PropertyStatus.ACTIVE)
    })

    it('should not allow updating another landlord\'s property', async () => {
      const otherProperty = await landlordPropertyStore.create({
        landlordId: 'other-landlord',
        title: 'Other Prop',
        address: 'Addr',
        bedrooms: 1,
        bathrooms: 1,
        annualRentNgn: 1000000,
        photos: ['https://ex.com/1.jpg'],
      })

      const response = await request
        .patch(`/api/landlord/properties/${otherProperty.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Tried to change' })

      expectErrorShape(response, 'FORBIDDEN', 403)
    })
  })

  describe('DELETE /api/landlord/properties/:id', () => {
    it('should delete a property successfully', async () => {
      const property = await landlordPropertyStore.create({
        landlordId,
        title: 'To Delete',
        address: 'Addr',
        bedrooms: 1,
        bathrooms: 1,
        annualRentNgn: 1000000,
        photos: ['https://ex.com/1.jpg'],
      })

      const response = await request
        .delete(`/api/landlord/properties/${property.id}`)
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(204)
      const deleted = await landlordPropertyStore.getById(property.id)
      expect(deleted).toBeNull()
    })
  })
})

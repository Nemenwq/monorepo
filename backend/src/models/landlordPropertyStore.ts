import { randomUUID } from 'node:crypto'
import { getPool, type PgPoolLike } from '../db.js'
import {
  LandlordProperty,
  PropertyStatus,
  CreatePropertyInput,
  UpdatePropertyInput,
  PropertyFilters,
  PaginatedProperties,
} from './landlordProperty.js'

interface LandlordPropertyStorePort {
  create(input: CreatePropertyInput): Promise<LandlordProperty>
  getById(id: string): Promise<LandlordProperty | null>
  list(filters?: PropertyFilters): Promise<PaginatedProperties>
  update(id: string, input: UpdatePropertyInput): Promise<LandlordProperty | null>
  delete(id: string): Promise<boolean>
  incrementViews(id: string): Promise<void>
  incrementInquiries(id: string): Promise<void>
  clear(): Promise<void>
}

class InMemoryLandlordPropertyStore implements LandlordPropertyStorePort {
  private properties = new Map<string, LandlordProperty>()

  async create(input: CreatePropertyInput): Promise<LandlordProperty> {
    const now = new Date()
    const property: LandlordProperty = {
      id: randomUUID(),
      landlordId: input.landlordId,
      title: input.title,
      address: input.address,
      city: input.city,
      area: input.area,
      bedrooms: input.bedrooms,
      bathrooms: input.bathrooms,
      sqm: input.sqm,
      annualRentNgn: input.annualRentNgn,
      description: input.description,
      photos: input.photos,
      status: PropertyStatus.PENDING,
      views: 0,
      inquiries: 0,
      createdAt: now,
      updatedAt: now,
    }

    this.properties.set(property.id, property)
    return property
  }

  async getById(id: string): Promise<LandlordProperty | null> {
    return this.properties.get(id) ?? null
  }

  async list(filters: PropertyFilters = {}): Promise<PaginatedProperties> {
    const { landlordId, status, query, page = 1, pageSize = 20 } = filters
    let filtered = Array.from(this.properties.values())

    if (landlordId) {
      filtered = filtered.filter((p) => p.landlordId === landlordId)
    }

    if (status) {
      filtered = filtered.filter((p) => p.status === status)
    }

    if (query && query.trim()) {
      const searchTerm = query.toLowerCase()
      filtered = filtered.filter(
        (p) =>
          p.title.toLowerCase().includes(searchTerm) ||
          p.address.toLowerCase().includes(searchTerm) ||
          p.city?.toLowerCase().includes(searchTerm) ||
          p.area?.toLowerCase().includes(searchTerm) ||
          p.description?.toLowerCase().includes(searchTerm),
      )
    }

    filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

    const total = filtered.length
    const totalPages = Math.ceil(total / pageSize)
    const start = (page - 1) * pageSize
    const end = start + pageSize
    const properties = filtered.slice(start, end)

    return {
      properties,
      total,
      page,
      pageSize,
      totalPages,
    }
  }

  async update(id: string, input: UpdatePropertyInput): Promise<LandlordProperty | null> {
    const property = this.properties.get(id)
    if (!property) return null

    const updated: LandlordProperty = {
      ...property,
      ...input,
      updatedAt: new Date(),
    }

    this.properties.set(id, updated)
    return updated
  }

  async delete(id: string): Promise<boolean> {
    return this.properties.delete(id)
  }

  async incrementViews(id: string): Promise<void> {
    const property = this.properties.get(id)
    if (property) {
      property.views += 1
      this.properties.set(id, property)
    }
  }

  async incrementInquiries(id: string): Promise<void> {
    const property = this.properties.get(id)
    if (property) {
      property.inquiries += 1
      this.properties.set(id, property)
    }
  }

  async clear(): Promise<void> {
    this.properties.clear()
  }
}

type PropertyRow = {
  id: string
  landlord_id: string
  title: string
  address: string
  city: string | null
  area: string | null
  bedrooms: number
  bathrooms: number
  sqm: number | null
  annual_rent_ngn: string | number
  description: string | null
  photos: unknown
  status: PropertyStatus
  views: number
  inquiries: number
  created_at: Date
  updated_at: Date
}

class PostgresLandlordPropertyStore implements LandlordPropertyStorePort {
  private async pool(): Promise<PgPoolLike> {
    const pool = await getPool()
    if (!pool) {
      throw new Error('Database pool is not available')
    }
    return pool
  }

  async isAvailable(): Promise<boolean> {
    return (await getPool()) !== null
  }

  async create(input: CreatePropertyInput): Promise<LandlordProperty> {
    const pool = await this.pool()
    const id = randomUUID()
    const { rows } = await pool.query(
      `INSERT INTO landlord_properties (
        id, landlord_id, title, address, city, area, 
        bedrooms, bathrooms, sqm, annual_rent_ngn, description, photos
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
      RETURNING *`,
      [
        id,
        input.landlordId,
        input.title,
        input.address,
        input.city ?? null,
        input.area ?? null,
        input.bedrooms,
        input.bathrooms,
        input.sqm ?? null,
        input.annualRentNgn,
        input.description ?? null,
        JSON.stringify(input.photos),
      ],
    )

    return this.mapRow(rows[0] as PropertyRow)
  }

  async getById(id: string): Promise<LandlordProperty | null> {
    const pool = await this.pool()
    const { rows } = await pool.query(
      'SELECT * FROM landlord_properties WHERE id = $1',
      [id],
    )

    if (rows.length === 0) return null
    return this.mapRow(rows[0] as PropertyRow)
  }

  async list(filters: PropertyFilters = {}): Promise<PaginatedProperties> {
    const pool = await this.pool()
    const where: string[] = []
    const values: unknown[] = []

    if (filters.landlordId) {
      values.push(filters.landlordId)
      where.push(`landlord_id = $${values.length}`)
    }

    if (filters.status) {
      values.push(filters.status)
      where.push(`status = $${values.length}`)
    }

    if (filters.query && filters.query.trim()) {
      values.push(`%${filters.query.trim()}%`)
      const idx = values.length
      where.push(`(
        title ILIKE $${idx} OR
        address ILIKE $${idx} OR
        COALESCE(city, '') ILIKE $${idx} OR
        COALESCE(area, '') ILIKE $${idx} OR
        COALESCE(description, '') ILIKE $${idx}
      )`)
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const page = filters.page && filters.page > 0 ? filters.page : 1
    const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : 20
    const offset = (page - 1) * pageSize

    const countResult = await pool.query(
      `SELECT COUNT(*) AS count FROM landlord_properties ${whereClause}`,
      values,
    )

    const queryValues = [...values, pageSize, offset]
    const propertyRows = await pool.query(
      `SELECT * FROM landlord_properties ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      queryValues,
    )

    const total = Number((countResult.rows[0] as { count: string }).count)
    const properties = propertyRows.rows.map((row) => this.mapRow(row as PropertyRow))

    return {
      properties,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  }

  async update(id: string, input: UpdatePropertyInput): Promise<LandlordProperty | null> {
    const pool = await this.pool()
    const updates: string[] = []
    const values: unknown[] = [id]
    
    let paramIdx = 2
    Object.entries(input).forEach(([key, value]) => {
      if (value !== undefined) {
        const dbKey = key === 'annualRentNgn' ? 'annual_rent_ngn' : key
        if (key === 'photos') {
          updates.push(`${dbKey} = $${paramIdx}::jsonb`)
          values.push(JSON.stringify(value))
        } else {
          updates.push(`${dbKey} = $${paramIdx}`)
          values.push(value)
        }
        paramIdx++
      }
    })

    if (updates.length === 0) return this.getById(id)

    const { rows } = await pool.query(
      `UPDATE landlord_properties
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      values,
    )

    if (rows.length === 0) return null
    return this.mapRow(rows[0] as PropertyRow)
  }

  async delete(id: string): Promise<boolean> {
    const pool = await this.pool()
    const { rowCount } = await pool.query(
      'DELETE FROM landlord_properties WHERE id = $1',
      [id],
    )
    return rowCount > 0
  }

  async incrementViews(id: string): Promise<void> {
    const pool = await this.pool()
    await pool.query(
      'UPDATE landlord_properties SET views = views + 1 WHERE id = $1',
      [id],
    )
  }

  async incrementInquiries(id: string): Promise<void> {
    const pool = await this.pool()
    await pool.query(
      'UPDATE landlord_properties SET inquiries = inquiries + 1 WHERE id = $1',
      [id],
    )
  }

  async clear(): Promise<void> {
    const pool = await this.pool()
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('landlordPropertyStore.clear() is only supported in test env')
    }
    await pool.query('TRUNCATE landlord_properties RESTART IDENTITY CASCADE')
  }

  private mapRow(row: PropertyRow): LandlordProperty {
    const photosValue = row.photos
    const photos = Array.isArray(photosValue)
      ? (photosValue as string[])
      : typeof photosValue === 'string'
        ? (JSON.parse(photosValue) as string[])
        : []

    return {
      id: row.id,
      landlordId: row.landlord_id,
      title: row.title,
      address: row.address,
      city: row.city ?? undefined,
      area: row.area ?? undefined,
      bedrooms: row.bedrooms,
      bathrooms: row.bathrooms,
      sqm: row.sqm ? Number(row.sqm) : undefined,
      annualRentNgn: typeof row.annual_rent_ngn === 'string' ? Number(row.annual_rent_ngn) : row.annual_rent_ngn,
      description: row.description ?? undefined,
      photos,
      status: row.status,
      views: row.views,
      inquiries: row.inquiries,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }
  }
}

class HybridLandlordPropertyStore implements LandlordPropertyStorePort {
  private memory = new InMemoryLandlordPropertyStore()
  private postgres = new PostgresLandlordPropertyStore()

  private async adapter(): Promise<LandlordPropertyStorePort> {
    if (await this.postgres.isAvailable()) {
      return this.postgres
    }
    return this.memory
  }

  async create(input: CreatePropertyInput): Promise<LandlordProperty> {
    const adapter = await this.adapter()
    return adapter.create(input)
  }

  async getById(id: string): Promise<LandlordProperty | null> {
    const adapter = await this.adapter()
    return adapter.getById(id)
  }

  async list(filters: PropertyFilters = {}): Promise<PaginatedProperties> {
    const adapter = await this.adapter()
    return adapter.list(filters)
  }

  async update(id: string, input: UpdatePropertyInput): Promise<LandlordProperty | null> {
    const adapter = await this.adapter()
    return adapter.update(id, input)
  }

  async delete(id: string): Promise<boolean> {
    const adapter = await this.adapter()
    return adapter.delete(id)
  }

  async incrementViews(id: string): Promise<void> {
    const adapter = await this.adapter()
    return adapter.incrementViews(id)
  }

  async incrementInquiries(id: string): Promise<void> {
    const adapter = await this.adapter()
    return adapter.incrementInquiries(id)
  }

  async clear(): Promise<void> {
    const adapter = await this.adapter()
    return adapter.clear()
  }
}

export const landlordPropertyStore = new HybridLandlordPropertyStore()

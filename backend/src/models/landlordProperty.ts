/**
 * Landlord Property model and types
 */

export enum PropertyStatus {
  ACTIVE = 'active',
  PENDING = 'pending',
  INACTIVE = 'inactive',
}

export interface LandlordProperty {
  id: string
  landlordId: string
  title: string
  address: string
  city?: string
  area?: string
  bedrooms: number
  bathrooms: number
  sqm?: number
  annualRentNgn: number
  description?: string
  photos: string[]
  status: PropertyStatus
  views: number
  inquiries: number
  createdAt: Date
  updatedAt: Date
}

export interface CreatePropertyInput {
  landlordId: string
  title: string
  address: string
  city?: string
  area?: string
  bedrooms: number
  bathrooms: number
  sqm?: number
  annualRentNgn: number
  description?: string
  photos: string[]
}

export interface UpdatePropertyInput {
  title?: string
  address?: string
  city?: string
  area?: string
  bedrooms?: number
  bathrooms?: number
  sqm?: number
  annualRentNgn?: number
  description?: string
  photos?: string[]
  status?: PropertyStatus
}

export interface PropertyFilters {
  landlordId?: string
  status?: PropertyStatus
  query?: string
  page?: number
  pageSize?: number
}

export interface PaginatedProperties {
  properties: LandlordProperty[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

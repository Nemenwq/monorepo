import { z } from 'zod'
import { PropertyStatus } from '../models/landlordProperty.js'

/**
 * Accepts either:
 * - canonical API fields (annualRentNgn, bedrooms, photos, ...)
 * - frontend wizard fields (price, beds, baths, images[], location, propertyType, amenities, yearBuilt)
 *
 * This keeps the wizard flow working without inventing a new endpoint.
 */
export const createPropertySchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required'),
    address: z.string().trim().min(1, 'Address is required'),

    // Canonical API fields
    city: z.string().trim().optional(),
    area: z.string().trim().optional(),
    bedrooms: z.number().int().min(0, 'Bedrooms must be 0 or greater').optional(),
    bathrooms: z.number().int().min(0, 'Bathrooms must be 0 or greater').optional(),
    sqm: z.union([z.number(), z.string()]).optional(),
    annualRentNgn: z.number().positive('Annual rent must be greater than 0').optional(),
    description: z.string().optional(),
    photos: z.array(z.string().url()).optional(),

    // Wizard fields
    propertyType: z.string().trim().optional(),
    location: z.string().trim().optional(),
    price: z.union([z.string(), z.number()]).optional(),
    beds: z.union([z.string(), z.number()]).optional(),
    baths: z.union([z.string(), z.number()]).optional(),
    yearBuilt: z.union([z.string(), z.number()]).optional(),
    amenities: z.array(z.string()).optional(),
    images: z
      .array(
        z.object({
          id: z.string(),
          roomType: z.string(),
          preview: z.string(),
        }),
      )
      .optional(),
  })
  .superRefine((val, ctx) => {
    const bedrooms = val.bedrooms ?? (val.beds !== undefined ? Number(val.beds) : undefined)
    const bathrooms = val.bathrooms ?? (val.baths !== undefined ? Number(val.baths) : undefined)
    const annualRentNgn =
      val.annualRentNgn ?? (val.price !== undefined ? Number(val.price) : undefined)

    if (bedrooms === undefined || Number.isNaN(bedrooms)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Bedrooms is required',
        path: ['bedrooms'],
      })
    }

    if (bathrooms === undefined || Number.isNaN(bathrooms)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Bathrooms is required',
        path: ['bathrooms'],
      })
    }

    if (annualRentNgn === undefined || Number.isNaN(annualRentNgn) || annualRentNgn <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Annual rent must be greater than 0',
        path: ['annualRentNgn'],
      })
    }
  })
  .transform((val) => {
    const bedrooms = val.bedrooms ?? Number(val.beds)
    const bathrooms = val.bathrooms ?? Number(val.baths)
    const annualRentNgn = val.annualRentNgn ?? Number(val.price)
    const sqm = val.sqm === undefined ? undefined : Number(val.sqm)

    const photos =
      val.photos ??
      (val.images ? val.images.map((img) => img.preview).filter(Boolean) : []) ??
      []

    // Store wizard-only metadata in description for now (near follow-up can move to jsonb metadata column)
    const wizardMeta =
      val.propertyType || val.location || val.yearBuilt || val.amenities || val.images
        ? {
            propertyType: val.propertyType,
            location: val.location,
            yearBuilt: val.yearBuilt !== undefined ? Number(val.yearBuilt) : undefined,
            amenities: val.amenities,
            images: val.images,
          }
        : undefined

    const description = wizardMeta
      ? `${val.description ?? ''}${val.description ? '\n\n' : ''}metadata:${JSON.stringify(wizardMeta)}`
      : val.description

    return {
      title: val.title,
      address: val.address,
      city: val.city,
      area: val.area ?? val.location,
      bedrooms,
      bathrooms,
      sqm,
      annualRentNgn,
      description,
      photos,
    }
  })

export const updatePropertySchema = z.object({
  title: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  city: z.string().optional(),
  area: z.string().optional(),
  bedrooms: z.number().int().min(0).optional(),
  bathrooms: z.number().int().min(0).optional(),
  sqm: z.number().positive().optional(),
  annualRentNgn: z.number().positive().optional(),
  description: z.string().optional(),
  photos: z.array(z.string().url()).optional(),
  status: z.nativeEnum(PropertyStatus).optional(),
})

export const propertyFiltersSchema = z.object({
  status: z.nativeEnum(PropertyStatus).optional(),
  query: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

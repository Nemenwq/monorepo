import { Router, Response } from 'express'
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js'
import { landlordPropertyStore } from '../models/landlordPropertyStore.js'
import { validate } from '../middleware/validate.js'
import {
  createPropertySchema,
  updatePropertySchema,
  propertyFiltersSchema,
} from '../schemas/landlordProperty.js'
import { AppError } from '../errors/AppError.js'
import { ErrorCode } from '../errors/errorCodes.js'
import { logger } from '../utils/logger.js'

const router = Router()

/**
 * List landlord's properties
 * GET /api/landlord/properties
 */
router.get(
  '/',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      if (req.user?.role !== 'landlord') {
        throw new AppError(ErrorCode.FORBIDDEN, 403, 'Only landlords can access this resource')
      }

      const filters = propertyFiltersSchema.parse(req.query)
      const result = await landlordPropertyStore.list({
        ...filters,
        landlordId: req.user.id,
      })

      res.json(result)
    } catch (error) {
      next(error)
    }
  }
)

/**
 * Get a single property
 * GET /api/landlord/properties/:id
 */
router.get(
  '/:id',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      if (req.user?.role !== 'landlord') {
        throw new AppError(ErrorCode.FORBIDDEN, 403, 'Only landlords can access this resource')
      }

      const property = await landlordPropertyStore.getById(req.params.id)
      if (!property) {
        throw new AppError(ErrorCode.NOT_FOUND, 404, 'Property not found')
      }

      if (property.landlordId !== req.user.id) {
        throw new AppError(ErrorCode.FORBIDDEN, 403, 'You do not have permission to view this property')
      }

      res.json(property)
    } catch (error) {
      next(error)
    }
  }
)

/**
 * Create a new property
 * POST /api/landlord/properties
 */
router.post(
  '/',
  authenticateToken,
  validate(createPropertySchema, 'body'),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      if (req.user?.role !== 'landlord') {
        throw new AppError(ErrorCode.FORBIDDEN, 403, 'Only landlords can create properties')
      }

      const property = await landlordPropertyStore.create({
        ...(req.body as any),
        landlordId: req.user.id,
      })

      logger.info('Property created', { propertyId: property.id, landlordId: req.user.id })
      res.status(201).json(property)
    } catch (error) {
      next(error)
    }
  }
)

/**
 * Update a property
 * PATCH /api/landlord/properties/:id
 */
router.patch(
  '/:id',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      if (req.user?.role !== 'landlord') {
        throw new AppError(ErrorCode.FORBIDDEN, 403, 'Only landlords can update properties')
      }

      const existing = await landlordPropertyStore.getById(req.params.id)
      if (!existing) {
        throw new AppError(ErrorCode.NOT_FOUND, 404, 'Property not found')
      }

      if (existing.landlordId !== req.user.id) {
        throw new AppError(ErrorCode.FORBIDDEN, 403, 'You do not have permission to update this property')
      }

      const input = updatePropertySchema.parse(req.body)
      const updated = await landlordPropertyStore.update(req.params.id, input)

      logger.info('Property updated', { propertyId: req.params.id, landlordId: req.user.id })
      res.json(updated)
    } catch (error) {
      next(error)
    }
  }
)

/**
 * Delete a property
 * DELETE /api/landlord/properties/:id
 */
router.delete(
  '/:id',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      if (req.user?.role !== 'landlord') {
        throw new AppError(ErrorCode.FORBIDDEN, 403, 'Only landlords can delete properties')
      }

      const existing = await landlordPropertyStore.getById(req.params.id)
      if (!existing) {
        throw new AppError(ErrorCode.NOT_FOUND, 404, 'Property not found')
      }

      if (existing.landlordId !== req.user.id) {
        throw new AppError(ErrorCode.FORBIDDEN, 403, 'You do not have permission to delete this property')
      }

      await landlordPropertyStore.delete(req.params.id)
      logger.info('Property deleted', { propertyId: req.params.id, landlordId: req.user.id })
      res.status(204).end()
    } catch (error) {
      next(error)
    }
  }
)

export function createLandlordPropertiesRouter(): Router {
  return router
}

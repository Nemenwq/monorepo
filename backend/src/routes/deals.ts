/**
 * Deal management routes
 */

import { Router, Request, Response } from 'express'
import { dealStore } from '../models/dealStore.js'
import { listingStore } from '../models/listingStore.js'
import { ListingStatus } from '../models/listing.js'
import { 
  createDealSchema, 
  dealFiltersSchema, 
  updateDealStatusSchema,
  updateScheduleItemSchema,
  CreateDealRequest,
  DealFiltersRequest,
  UpdateDealStatusRequest,
  UpdateScheduleItemRequest
} from '../schemas/deal.js'
import { AppError } from '../errors/AppError.js'
import { ErrorCode } from '../errors/errorCodes.js'
import { outboxStore } from '../outbox/index.js'
import { TxType } from '../outbox/types.js'
import { computeDealProgress } from '../services/dealProgress.js'

const router = Router()

/**
 * POST /api/deals
 * Create a new deal with repayment schedule
 * 
 * RACE CONDITION HANDLING (MVP):
 * This implementation uses synchronous validation and locking for the in-memory store.
 * While this prevents most race conditions in single-threaded Node.js execution,
 * it does NOT provide true atomicity guarantees.
 * 
 * Known limitations:
 * - Multiple concurrent requests could theoretically pass validation before any locks
 * - No distributed locking mechanism for multi-instance deployments
 * 
 * Production recommendations:
 * - Use database transactions (BEGIN/COMMIT) to ensure atomic read-check-update
 * - Implement optimistic locking with version numbers on the listing record
 * - Use distributed locks (Redis, etc.) for multi-instance deployments
 * - Add unique constraint on listing.dealId at database level
 */
router.post('/', async (req: Request, res: Response, next) => {
  try {
    const validatedData: CreateDealRequest = createDealSchema.parse(req.body)
    
    // Validate listing if listingId is provided
    if (validatedData.listingId) {
      const listing = await listingStore.getById(validatedData.listingId)
      
      // Check if listing exists
      if (!listing) {
        throw new AppError(
          ErrorCode.NOT_FOUND,
          404,
          `Listing with ID ${validatedData.listingId} not found`
        )
      }
      
      // Check if listing is already rented
      if (listing.status === ListingStatus.RENTED) {
        throw new AppError(
          ErrorCode.LISTING_ALREADY_RENTED,
          409,
          `Listing with ID ${validatedData.listingId} is already rented`
        )
      }
      
      // Check if listing already has a dealId
      if (listing.dealId) {
        throw new AppError(
          ErrorCode.LISTING_ALREADY_RENTED,
          409,
          `Listing with ID ${validatedData.listingId} is already linked to deal ${listing.dealId}`
        )
      }
      
      // Check if listing is approved
      if (listing.status !== ListingStatus.APPROVED) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          400,
          `Listing must be approved to create a deal. Current status: ${listing.status}`
        )
      }
    }
    
    const deal = await dealStore.create(validatedData as any)
    
    // Lock listing to deal if listingId is provided
    if (validatedData.listingId) {
      await listingStore.lockToDeal(validatedData.listingId, deal.dealId)
    }
    
    res.status(201).json({
      success: true,
      data: deal
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return next(new AppError(ErrorCode.VALIDATION_ERROR, 400, error.message))
    }
    next(error)
  }
})

/**
 * GET /api/deals/:dealId/progress
 * Get a deal's payment progress computed from on-chain receipts
 */
router.get('/:dealId/progress', async (req: Request, res: Response, next) => {
  try {
    const { dealId } = req.params

    if (!dealId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'Deal ID is required')
    }

    const deal = await dealStore.findById(dealId)

    if (!deal) {
      throw new AppError(ErrorCode.NOT_FOUND, 404, `Deal with ID ${dealId} not found`)
    }

    // Fetch all outbox items for this deal filtered to TENANT_REPAYMENT
    const receipts = await outboxStore.listByDealId(dealId, TxType.TENANT_REPAYMENT)

    const progress = computeDealProgress(deal, receipts)

    res.json({
      success: true,
      data: progress,
    })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /api/deals/:dealId
 * Get a specific deal by ID with schedule
 */
router.get('/:dealId', async (req: Request, res: Response, next) => {
  try {
    const { dealId } = req.params
    
    if (!dealId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'Deal ID is required')
    }
    
    const deal = await dealStore.findById(dealId)
    
    if (!deal) {
      throw new AppError(ErrorCode.NOT_FOUND, 404, `Deal with ID ${dealId} not found`)
    }
    
    res.json({
      success: true,
      data: deal
    })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /api/deals
 * Get deals with optional filtering
 */
router.get('/', async (req: Request, res: Response, next) => {
  try {
    const validatedFilters: DealFiltersRequest = dealFiltersSchema.parse(req.query)
    
    const result = await dealStore.findMany(validatedFilters)
    
    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return next(new AppError(ErrorCode.VALIDATION_ERROR, 400, error.message))
    }
    next(error)
  }
})

/**
 * PATCH /api/deals/:dealId/status
 * Update deal status
 */
router.patch('/:dealId/status', async (req: Request, res: Response, next) => {
  const { dealId } = req.params
  
  if (!dealId) {
    return next(new AppError(ErrorCode.VALIDATION_ERROR, 400, 'Deal ID is required'))
  }
  
  try {
    const validatedData: UpdateDealStatusRequest = updateDealStatusSchema.parse(req.body)
    
    const deal = await dealStore.updateStatus(dealId, validatedData.status)
    
    if (!deal) {
      throw new AppError(ErrorCode.NOT_FOUND, 404, `Deal with ID ${dealId} not found`)
    }
    
    res.json({
      success: true,
      data: deal
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return next(new AppError(ErrorCode.VALIDATION_ERROR, 400, error.message))
    }
    next(error)
  }
})

/**
 * PATCH /api/deals/:dealId/schedule/:period
 * Update schedule item status
 */
router.patch('/:dealId/schedule/:period', async (req: Request, res: Response, next) => {
  const { dealId } = req.params
  const period = parseInt(req.params.period, 10)
  
  if (!dealId || isNaN(period)) {
    return next(new AppError(ErrorCode.VALIDATION_ERROR, 400, 'Deal ID and period are required'))
  }
  
  try {
    const validatedData: UpdateScheduleItemRequest = updateScheduleItemSchema.parse({
      ...req.body,
      period
    })
    
    const deal = await dealStore.updateScheduleItemStatus(
      dealId, 
      validatedData.period, 
      validatedData.status as any
    )
    
    if (!deal) {
      throw new AppError(ErrorCode.NOT_FOUND, 404, `Deal with ID ${dealId} not found`)
    }
    
    res.json({
      success: true,
      data: deal
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return next(new AppError(ErrorCode.VALIDATION_ERROR, 400, error.message))
    }
    next(error)
  }
})

export function createDealsRouter(): Router {
  return router
}

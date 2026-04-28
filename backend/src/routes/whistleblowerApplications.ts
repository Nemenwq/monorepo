/**
 * Public Routes for Whistleblower Applications
 *
 * Provides endpoints for:
 * - Submitting new whistleblower signup applications
 * - Checking application status
 */

import { Router, type Request, type Response, type NextFunction } from 'express'
import { validate } from '../middleware/validate.js'
import { logger } from '../utils/logger.js'
import { AppError, notFound } from '../errors/AppError.js'
import { ErrorCode } from '../errors/errorCodes.js'
import { whistleblowerApplicationStore } from '../models/whistleblowerApplicationStore.js'
import { WhistleblowerApplicationStatus } from '../models/whistleblowerApplication.js'
import {
  createWhistleblowerApplicationSchema,
  getWhistleblowerApplicationSchema,
} from '../schemas/whistleblowerApplication.js'

/**
 * Factory function to create whistleblower applications router
 */
export function createWhistleblowerApplicationsRouter(): Router {
  const router = Router()

  /**
   * POST /api/whistleblower-applications
   *
   * Submit a new whistleblower signup application.
   * Validates required fields and prevents duplicate submissions by email.
   * Returns the created application with pending status.
   */
  router.post(
    '/',
    validate(createWhistleblowerApplicationSchema, 'body'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const {
          fullName,
          email,
          phone,
          address,
          linkedinProfile,
          facebookProfile,
          instagramProfile,
        } = req.body as {
          fullName: string
          email: string
          phone: string
          address: string
          linkedinProfile: string
          facebookProfile: string
          instagramProfile: string
        }

        logger.info('New whistleblower application submission', {
          email,
          fullName,
          requestId: req.requestId,
        })

        // Check for existing application with same email
        const existingApplication = await whistleblowerApplicationStore.getByEmail(email)
        if (existingApplication) {
          throw new AppError(
            ErrorCode.CONFLICT,
            409,
            'An application with this email already exists',
            {
              existingApplicationId: existingApplication.applicationId,
              existingStatus: existingApplication.status,
            }
          )
        }

        // Create the application
        const application = await whistleblowerApplicationStore.create({
          fullName,
          email,
          phone,
          address,
          linkedinProfile,
          facebookProfile,
          instagramProfile,
        })

        logger.info('Whistleblower application created successfully', {
          applicationId: application.applicationId,
          email,
          requestId: req.requestId,
        })

        res.status(201).json({
          success: true,
          application: {
            applicationId: application.applicationId,
            fullName: application.fullName,
            email: application.email,
            phone: application.phone,
            address: application.address,
            linkedinProfile: application.linkedinProfile,
            facebookProfile: application.facebookProfile,
            instagramProfile: application.instagramProfile,
            status: application.status,
            createdAt: application.createdAt.toISOString(),
            updatedAt: application.updatedAt.toISOString(),
          },
          data: {
            applicationId: application.applicationId,
            status: application.status,
            createdAt: application.createdAt.toISOString(),
          },
          message: 'Application submitted successfully. You will be notified via email once reviewed.',
        })
      } catch (error) {
        next(error)
      }
    }
  )

  /**
   * GET /api/whistleblower-applications/:applicationId/status
   *
   * Check the status of a submitted application.
   * Public endpoint for applicants to track their application.
   */
  router.get(
    '/:applicationId/status',
    validate(getWhistleblowerApplicationSchema, 'params'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { applicationId } = req.params

        logger.info('Checking whistleblower application status', {
          applicationId,
          requestId: req.requestId,
        })

        const application = await whistleblowerApplicationStore.getById(applicationId)
        if (!application) {
          throw notFound(`Whistleblower application with ID '${applicationId}'`)
        }

        // Return limited information for public status check
        res.json({
          success: true,
          status: application.status,
          submittedAt: application.createdAt.toISOString(),
          reviewedAt: application.reviewedAt?.toISOString(),
          message: getStatusMessage(application.status),
        })
      } catch (error) {
        next(error)
      }
    }
  )

  return router
}

/**
 * Returns a user-friendly status message based on application status
 */
function getStatusMessage(status: WhistleblowerApplicationStatus): string {
  switch (status) {
    case WhistleblowerApplicationStatus.PENDING:
      return 'Your application is pending review. You will receive an email notification once reviewed.'
    case WhistleblowerApplicationStatus.APPROVED:
      return 'Congratulations! Your application has been approved. Check your email for next steps.'
    case WhistleblowerApplicationStatus.REJECTED:
      return 'Your application was not approved. Please check your email for details.'
    default:
      return 'Application status unknown.'
  }
}

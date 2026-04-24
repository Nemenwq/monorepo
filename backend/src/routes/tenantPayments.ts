/**
 * Tenant Payments Routes
 * Handles tenant payment schedules, history, and wallet operations
 */

import { Router, Request, Response } from "express";
import { authenticateToken } from "../middleware/auth.js";
import { AppError } from "../errors/AppError.js";
import { ErrorCode } from "../errors/errorCodes.js";
import { NgnWalletService } from "../services/ngnWalletService.js";
import { z } from "zod";

const router = Router();
const ngnWalletService = new NgnWalletService();

/**
 * GET /api/tenant/payments/schedule
 * Get payment schedule for authenticated tenant
 *
 * @authenticated
 */
router.get(
  "/schedule",
  authenticateToken,
  async (req: Request, res: Response, next) => {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        throw new AppError(
          ErrorCode.UNAUTHORIZED,
          401,
          "User not authenticated",
        );
      }

      // Return empty schedule for now - to be implemented with real deal data
      res.json({
        success: true,
        data: {
          schedule: [],
          nextPayment: null,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/tenant/payments/history
 * Get payment history for authenticated tenant
 *
 * @authenticated
 */
router.get(
  "/history",
  authenticateToken,
  async (req: Request, res: Response, next) => {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        throw new AppError(
          ErrorCode.UNAUTHORIZED,
          401,
          "User not authenticated",
        );
      }

      // Return empty history for now
      res.json({
        success: true,
        data: {
          payments: [],
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/tenant/payments/wallet
 * Get wallet balance for authenticated tenant
 *
 * @authenticated
 */
router.get(
  "/wallet",
  authenticateToken,
  async (req: Request, res: Response, next) => {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        throw new AppError(
          ErrorCode.UNAUTHORIZED,
          401,
          "User not authenticated",
        );
      }

      const balance = await ngnWalletService.getBalance(userId);

      res.json({
        success: true,
        data: {
          balance: balance.availableNgn,
          availableNgn: balance.availableNgn,
          heldNgn: balance.heldNgn,
          totalNgn: balance.totalNgn,
          lastTopUp: new Date().toISOString(),
          autoPayEnabled: true,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/tenant/payments/quick-pay
 * Initiate a quick payment from wallet or card
 *
 * @authenticated
 */
const quickPaySchema = z.object({
  dealId: z.string().describe("Deal ID to pay for"),
  amount: z.number().positive().describe("Amount to pay in NGN"),
  paymentMethod: z.enum(["wallet", "card"]).describe("Payment method"),
});

router.post(
  "/quick-pay",
  authenticateToken,
  async (req: Request, res: Response, next) => {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        throw new AppError(
          ErrorCode.UNAUTHORIZED,
          401,
          "User not authenticated",
        );
      }

      const validatedData = quickPaySchema.parse(req.body);

      // Return pending status for now
      res.json({
        success: true,
        data: {
          paymentId: `PAY-${Date.now()}`,
          status: "pending",
          amount: validatedData.amount,
          method: validatedData.paymentMethod,
          message: "Payment initiated",
        },
      });
    } catch (error) {
      if (error instanceof Error && error.name === "ZodError") {
        return next(
          new AppError(ErrorCode.VALIDATION_ERROR, 400, error.message),
        );
      }
      next(error);
    }
  },
);

/**
 * POST /api/tenant/payments/wallet/topup
 * Initiate wallet top-up
 *
 * @authenticated
 */
const topUpSchema = z.object({
  amount: z.number().positive().min(1000).describe("Amount to top up in NGN"),
  paymentMethod: z
    .enum(["card", "bank_transfer"])
    .default("card")
    .describe("Top-up method"),
});

router.post(
  "/wallet/topup",
  authenticateToken,
  async (req: Request, res: Response, next) => {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        throw new AppError(
          ErrorCode.UNAUTHORIZED,
          401,
          "User not authenticated",
        );
      }

      const validatedData = topUpSchema.parse(req.body);

      // Return mock response for now - to be implemented with real NGN wallet integration
      res.json({
        success: true,
        data: {
          topUpId: `TOPUP-${Date.now()}`,
          amount: validatedData.amount,
          status: "pending",
          reference: `REF-${Date.now()}`,
          redirectUrl: null,
          bankTransfer: null,
          expiresAt: null,
        },
      });
    } catch (error) {
      if (error instanceof Error && error.name === "ZodError") {
        return next(
          new AppError(ErrorCode.VALIDATION_ERROR, 400, error.message),
        );
      }
      next(error);
    }
  },
);

export function createTenantPaymentsRouter(): Router {
  return router;
}

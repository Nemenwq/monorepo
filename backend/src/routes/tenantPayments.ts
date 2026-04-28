/**
 * Tenant Payments Routes
 * Uses durable idempotency for quick-pay and wallet top-up initiation.
 */

import { Router, type Response } from "express";
import { z } from "zod";
import { authenticateToken, type AuthenticatedRequest } from "../middleware/auth.js";
import { AppError } from "../errors/AppError.js";
import { ErrorCode } from "../errors/errorCodes.js";
import { NgnWalletService } from "../services/ngnWalletService.js";
import { durableIdempotency } from "../middleware/durableIdempotency.js";
import { validate } from "../middleware/validate.js";
import { ngnTopupInitiateSchema, ngnTopupInitiateResponseSchema } from "../schemas/ngnTopup.js";
import type { NgnTopupInitiateRequest } from "../schemas/ngnTopup.js";
import { initiateNgnTopup } from "../services/ngnTopupInitiateService.js";
import { generateId } from "../utils/tokens.js";

const router = Router();
const ngnWalletService = new NgnWalletService();

router.get(
  "/schedule",
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(ErrorCode.UNAUTHORIZED, 401, "User not authenticated");
      }
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

router.get(
  "/history",
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      if (!req.user?.id) {
        throw new AppError(ErrorCode.UNAUTHORIZED, 401, "User not authenticated");
      }
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

router.get(
  "/wallet",
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(ErrorCode.UNAUTHORIZED, 401, "User not authenticated");
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

const quickPaySchema = z.object({
  dealId: z.string().describe("Deal ID to pay for"),
  amount: z.number().positive().describe("Amount to pay in NGN"),
  paymentMethod: z.enum(["wallet", "card"]).describe("Payment method"),
});

router.post(
  "/quick-pay",
  authenticateToken,
  durableIdempotency((req) => `tenant:${(req as AuthenticatedRequest).user!.id}:quick-pay`),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(ErrorCode.UNAUTHORIZED, 401, "User not authenticated");
      }
      const validated = quickPaySchema.parse(req.body);
      const paymentId = generateId();
      res.json({
        success: true,
        data: {
          paymentId,
          status: "pending" as const,
          amount: validated.amount,
          method: validated.paymentMethod,
          dealId: validated.dealId,
          message: "Payment initiated",
        },
      });
    } catch (error) {
      if (error instanceof Error && error.name === "ZodError") {
        return next(new AppError(ErrorCode.VALIDATION_ERROR, 400, error.message));
      }
      next(error);
    }
  },
);

const topUpBodySchema = z
  .object({
    amount: z.number().positive().min(1000).describe("Amount to top up in NGN"),
    paymentMethod: z.enum(["card", "bank_transfer"]).default("card").describe("Top-up method"),
  })
  .transform(
    (v): NgnTopupInitiateRequest => ({
      amountNgn: v.amount,
      rail: v.paymentMethod === "bank_transfer" ? "bank_transfer" : "paystack",
    }),
  );

router.post(
  '/wallet/topup',
  authenticateToken,
  validate(topUpBodySchema, 'body'),
  durableIdempotency((req) => `tenant:${(req as AuthenticatedRequest).user!.id}:wallet-topup`),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        throw new AppError(ErrorCode.UNAUTHORIZED, 401, 'User not authenticated')
      }
      const body = req.body as NgnTopupInitiateRequest
      const idempotencyKeyRaw = req.header('x-idempotency-key')
      const idempotencyKey =
        typeof idempotencyKeyRaw === 'string' && idempotencyKeyRaw.trim() !== ''
          ? idempotencyKeyRaw.trim()
          : null
      if (!idempotencyKey) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          400,
          'Missing x-idempotency-key for top-up (required with durable idempotency)',
        )
      }
      const ngnBody = ngnTopupInitiateSchema.parse(body)
      const { status, body: out } = await initiateNgnTopup({
        userId,
        body: ngnBody,
        idempotencyKey,
        requestId: req.requestId,
      })
      res.status(status).json(ngnTopupInitiateResponseSchema.parse(out))
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.status).json({ error: { code: error.code, message: error.message } })
      }
      next(error)
    }
  },
)

router.get(
  '/disputes',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        throw new AppError(ErrorCode.UNAUTHORIZED, 401, 'User not authenticated')
      }

      const { paymentDisputeRepository } = await import('../repositories/PaymentDisputeRepository.js')
      const disputes = await paymentDisputeRepository.findByUserId(userId)

      res.json({
        success: true,
        data: { disputes },
      })
    } catch (error) {
      next(error)
    }
  },
)

router.post(
  '/disputes',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        throw new AppError(ErrorCode.UNAUTHORIZED, 401, 'User not authenticated')
      }

      const { paymentDisputeCreateSchema } = await import('../schemas/paymentDispute.js')
      const parsed = paymentDisputeCreateSchema.safeParse(req.body)
      if (!parsed.success) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'Invalid dispute data')
      }

      const { paymentDisputeRepository } = await import('../repositories/PaymentDisputeRepository.js')
      const dispute = await paymentDisputeRepository.create(userId, parsed.data)

      res.status(201).json({
        success: true,
        data: { dispute },
      })
    } catch (error) {
      next(error)
    }
  },
)

export function createTenantPaymentsRouter(): Router {
  return router;
}

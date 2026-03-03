import { Router, Request, Response, NextFunction } from 'express'
import { SorobanAdapter } from '../soroban/adapter.js'
import { AppError } from '../errors/AppError.js'
import { ErrorCode } from '../errors/errorCodes.js'

const USDC_DECIMALS = 7n
const USDC_DIVISOR = 10n ** USDC_DECIMALS
const NGN_PER_USDC = 1620n

function formatUsdc(raw: bigint): string {
     const whole = raw / USDC_DIVISOR
     const frac = (raw % USDC_DIVISOR).toString().padStart(Number(USDC_DECIMALS), '0')
     return `${whole}.${frac}`
}

/**
 * @openapi
 * /api/wallet/balance:
 *   get:
 *     summary: Get wallet balance from Soroban adapter
 *     tags: [Wallet]
 *     parameters:
 *       - in: query
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *           example: GABC123...
 *         description: Stellar wallet public key
 *     responses:
 *       200:
 *         description: Wallet balance
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 wallet:
 *                   type: string
 *                 balance:
 *                   type: object
 *                   properties:
 *                     usdc:
 *                       type: object
 *                       properties:
 *                         raw: { type: string }
 *                         formatted: { type: string }
 *                         symbol: { type: string }
 *                     ngn:
 *                       type: object
 *                       properties:
 *                         raw: { type: string }
 *                         formatted: { type: string }
 *                         symbol: { type: string }
 *                         display_note: { type: string }
 *                 meta:
 *                   type: object
 *                   properties:
 *                     source: { type: string }
 *                     computed_at: { type: string }
 *       400:
 *         description: Missing or invalid address
 *       500:
 *         description: Adapter error
 */
export function createWalletRouter(adapter: SorobanAdapter): Router {
     const router = Router()

     router.get('/balance', async (req: Request, res: Response, next: NextFunction) => {
          const address = req.query.address as string | undefined

          if (!address || typeof address !== 'string' || address.trim() === '') {
               return next(new AppError(ErrorCode.VALIDATION_ERROR, 400, 'Query param `address` is required'))
          }

          try {
               const raw = await adapter.getBalance(address)
               const ngnRaw = (raw * NGN_PER_USDC) / USDC_DIVISOR

               return res.json({
                    wallet: address,
                    balance: {
                         usdc: {
                              raw: raw.toString(),
                              formatted: formatUsdc(raw),
                              symbol: 'USDC',
                         },
                         ngn: {
                              raw: ngnRaw.toString(),
                              formatted: new Intl.NumberFormat('en-NG', {
                                   style: 'currency',
                                   currency: 'NGN',
                              }).format(Number(ngnRaw)),
                              symbol: 'NGN',
                              display_note: 'Display only. Rate: 1 USDC = ₦1,620',
                         },
                    },
                    meta: {
                         source: 'soroban_adapter',
                         computed_at: new Date().toISOString(),
                    },
               })
          } catch (err) {
               next(err)
          }
     })

     return router
}
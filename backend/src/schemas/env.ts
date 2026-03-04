import { z } from 'zod'

const sorobanNetworkEnum = z.enum(['local', 'testnet', 'mainnet'])

export const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.string().default('development'),
  VERSION: z.string().default('0.1.0'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  SOROBAN_RPC_URL: z.string().url().default('https://soroban-testnet.stellar.org'),
  SOROBAN_NETWORK_PASSPHRASE: z.string().default('Test SDF Network ; September 2015'),
  SOROBAN_CONTRACT_ID: z.string().optional(),
  SOROBAN_NETWORK: sorobanNetworkEnum.default('testnet'),
  USDC_TOKEN_ADDRESS: z.string().optional(),
  ENCRYPTION_KEY: z.string().min(32, 'Encryption key must be at least 32 characters'),
  CUSTODIAL_WALLET_MASTER_KEY_V1: z.string().optional(),
  CUSTODIAL_WALLET_MASTER_KEY_V2: z.string().optional(),
  CUSTODIAL_WALLET_MASTER_KEY_ACTIVE_VERSION: z.coerce.number().default(1),
  CUSTODIAL_MODE_ENABLED: z.coerce.boolean().default(true),
  CUSTODIAL_SIGNING_PAUSED: z.coerce.boolean().default(false),
}).refine((data) => {
  if (data.NODE_ENV !== 'development' && data.NODE_ENV !== 'test' && !data.USDC_TOKEN_ADDRESS) {
    return false
  }
  if (data.USDC_TOKEN_ADDRESS && !/^0x[a-fA-F0-9]{40}$/.test(data.USDC_TOKEN_ADDRESS)) {
    return false
  }
  return true
}, {
  message: 'USDC_TOKEN_ADDRESS is required outside development/test and must be a valid Ethereum address (0x followed by 40 hex characters)',
  path: ['USDC_TOKEN_ADDRESS'],
})
  .refine((data) => {
    if (data.NODE_ENV === 'development' || data.NODE_ENV === 'test') {
      return true
    }
    if (!data.CUSTODIAL_WALLET_MASTER_KEY_V1) {
      return false
    }
    const active = data.CUSTODIAL_WALLET_MASTER_KEY_ACTIVE_VERSION
    if (active === 2 && !data.CUSTODIAL_WALLET_MASTER_KEY_V2) {
      return false
    }
    if (active !== 1 && active !== 2) {
      return false
    }
    return true
  }, {
    message: 'Custodial wallet master keys must be configured for active encryption version',
    path: ['CUSTODIAL_WALLET_MASTER_KEY_ACTIVE_VERSION'],
  })

export type Env = z.infer<typeof envSchema>

export const env = envSchema.parse(process.env)

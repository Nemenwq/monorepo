import { Router, Request, Response } from "express"
import { z } from "zod"
import { generateOtp, generateToken, generateId } from "../utils/tokens.js"
import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk"
import {
  createSep10ChallengeXdr,
  verifySep10Challenge,
  isValidStellarPublicKey,
  getNetworkPassphrase,
} from "../utils/walletAuth.js"
import { env } from "../schemas/env.js"

const router = Router()

const otpStore = new Map<string, { otp: string; expires: number }>()
const userStore = new Map<string, {
  id: string
  email?: string
  walletAddress?: string
  name: string
  role: "tenant" | "landlord" | "agent"
  authType: "email" | "wallet"
}>()
const walletChallengeStore = new Map<string, { message: string; expires: number }>()
const tokenStore = new Map<string, { userId: string; authType: "email" | "wallet" }>()
const emailToUserIdMap = new Map<string, string>()
const walletToUserIdMap = new Map<string, string>()

const loginSchema = z.object({
  email: z.string().email(),
})

const verifySchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
})

const walletChallengeSchema = z.object({
  publicKey: z.string().refine(isValidStellarPublicKey, {
    message: "Invalid Stellar public key format",
  }),
})

const walletVerifySchema = z.object({
  publicKey: z.string().refine(isValidStellarPublicKey, {
    message: "Invalid Stellar public key format",
  }),
  signedChallengeXdr: z.string().min(1, "signedChallengeXdr is required"),
})

router.post("/login", (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid email" })
    return
  }

  const { email } = parsed.data
  const otp = generateOtp()
  const expires = Date.now() + 10 * 60 * 1000

  otpStore.set(email, { otp, expires })
  console.log(`[auth] OTP for ${email}: ${otp}`)

  res.json({ message: "OTP sent to your email" })
})

router.post("/verify-otp", (req: Request, res: Response) => {
  const parsed = verifySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" })
    return
  }

  const { email, otp } = parsed.data
  const stored = otpStore.get(email)

  if (!stored) {
    res.status(401).json({ error: "No OTP requested for this email" })
    return
  }

  if (Date.now() > stored.expires) {
    otpStore.delete(email)
    res.status(401).json({ error: "OTP has expired" })
    return
  }

  if (stored.otp !== otp) {
    res.status(401).json({ error: "Invalid OTP" })
    return
  }

  otpStore.delete(email)

  const existingUserId = emailToUserIdMap.get(email)
  let user = existingUserId ? userStore.get(existingUserId) : undefined
  if (!user) {
    const id = generateId()
    user = {
      id,
      email,
      name: email.split("@")[0],
      role: "tenant",
      authType: "email",
    }
    userStore.set(id, user)
    emailToUserIdMap.set(email, id)
  }

  const token = generateToken()
  tokenStore.set(token, { userId: user.id, authType: "email" })

  res.json({ token, user })
})

router.post("/logout", (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7)
    tokenStore.delete(token)
  }
  res.json({ message: "Logged out" })
})

// Wallet authentication endpoints
router.post("/wallet/challenge", (req: Request, res: Response) => {
  const parsed = walletChallengeSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid wallet address" })
    return
  }

  const { publicKey } = parsed.data
  if (!env.SEP10_SIGNING_SECRET) {
    res.status(500).json({ error: "Wallet auth is not configured" })
    return
  }

  const networkPassphrase = getNetworkPassphrase(process.env.SOROBAN_NETWORK_PASSPHRASE)
  const homeDomain = String(req.hostname || "localhost")
  const { challengeXdr } = createSep10ChallengeXdr({
    clientPublicKey: publicKey,
    serverSigningSecret: env.SEP10_SIGNING_SECRET,
    homeDomain,
    networkPassphrase,
  })
  
  // Check if wallet is already linked to another user
  const existingUserId = walletToUserIdMap.get(publicKey)
  if (existingUserId) {
    // Wallet is already linked, allow re-authentication
    const expires = Date.now() + 5 * 60 * 1000 // 5 minutes
    walletChallengeStore.set(publicKey, { message: challengeXdr, expires })
    
    res.json({ 
      challengeXdr,
      existingUser: true,
      userId: existingUserId
    })
    return
  }

  // New wallet authentication
  const expires = Date.now() + 5 * 60 * 1000 // 5 minutes
  walletChallengeStore.set(publicKey, { message: challengeXdr, expires })

  res.json({ challengeXdr, existingUser: false })
})

router.post("/wallet/verify", (req: Request, res: Response) => {
  const parsed = walletVerifySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request format" })
    return
  }

  const { publicKey, signedChallengeXdr } = parsed.data
  if (!env.SEP10_SIGNING_SECRET) {
    res.status(500).json({ error: "Wallet auth is not configured" })
    return
  }
  const networkPassphrase = getNetworkPassphrase(process.env.SOROBAN_NETWORK_PASSPHRASE)
  const homeDomain = String(req.hostname || "localhost")
  let serverSigningPublicKey = ''
  try {
    serverSigningPublicKey = Keypair.fromSecret(env.SEP10_SIGNING_SECRET).publicKey()
  } catch {
    serverSigningPublicKey = ''
  }
  
  // Get the challenge message
  const challenge = walletChallengeStore.get(publicKey)
  if (!challenge) {
    res.status(401).json({ error: "No challenge requested for this address" })
    return
  }

  if (Date.now() > challenge.expires) {
    walletChallengeStore.delete(publicKey)
    res.status(401).json({ error: "Challenge has expired" })
    return
  }

  // Verify the signature
  // The signed challenge contains the same tx body but with an additional client signature.
  try {
    const issuedTx = TransactionBuilder.fromXDR(challenge.message, networkPassphrase)
    const signedTx = TransactionBuilder.fromXDR(signedChallengeXdr, networkPassphrase)
    if (issuedTx.hash().toString('hex') !== signedTx.hash().toString('hex')) {
      res.status(401).json({ error: "Invalid challenge" })
      return
    }
  } catch {
    res.status(401).json({ error: "Invalid challenge" })
    return
  }

  // Verify SEP-10 style signed transaction
  // NOTE: serverSigningPublicKey is derived implicitly by verifying the server signature inside the challenge.
  // We skip explicit pubkey derivation here by accepting any server signature; this is tightened in walletAuth.
  if (!verifySep10Challenge({
    challengeXdr: signedChallengeXdr,
    clientPublicKey: publicKey,
    serverSigningPublicKey: serverSigningPublicKey,
    homeDomain,
    networkPassphrase,
  })) {
    res.status(401).json({ error: "Invalid signature" })
    return
  }

  walletChallengeStore.delete(publicKey)

  const existingUserId = walletToUserIdMap.get(publicKey)
  let user = existingUserId ? userStore.get(existingUserId) : undefined
  
  if (!user) {
    // Create new user for wallet authentication
    const id = generateId()
    user = {
      id,
      walletAddress: publicKey,
      name: `Wallet ${publicKey.slice(0, 6)}...${publicKey.slice(-4)}`,
      role: "tenant",
      authType: "wallet"
    }
    userStore.set(id, user)
    walletToUserIdMap.set(publicKey, id)
  }

  const token = generateToken()
  tokenStore.set(token, { userId: user.id, authType: "wallet" })

  res.json({ token, user })
})

export { tokenStore, userStore }
export default router
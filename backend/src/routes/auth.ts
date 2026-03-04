import { Router, Request, Response } from "express"
import { z } from "zod"
import { generateOtp, generateToken, generateId } from "../utils/tokens.js"
import { generateWalletChallenge, verifyWalletSignature, isValidEthereumAddress } from "../utils/walletAuth.js"

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
  address: z.string().refine(isValidEthereumAddress, {
    message: "Invalid Ethereum address format"
  })
})

const walletVerifySchema = z.object({
  address: z.string().refine(isValidEthereumAddress, {
    message: "Invalid Ethereum address format"
  }),
  signature: z.string().min(1, "Signature is required")
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

  const { address } = parsed.data
  
  // Check if wallet is already linked to another user
  const existingUserId = walletToUserIdMap.get(address)
  if (existingUserId) {
    // Wallet is already linked, allow re-authentication
    const message = generateWalletChallenge(address)
    const expires = Date.now() + 5 * 60 * 1000 // 5 minutes
    walletChallengeStore.set(address, { message, expires })
    
    res.json({ 
      message,
      existingUser: true,
      userId: existingUserId
    })
    return
  }

  // New wallet authentication
  const message = generateWalletChallenge(address)
  const expires = Date.now() + 5 * 60 * 1000 // 5 minutes
  walletChallengeStore.set(address, { message, expires })

  res.json({ message, existingUser: false })
})

router.post("/wallet/verify", (req: Request, res: Response) => {
  const parsed = walletVerifySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request format" })
    return
  }

  const { address, signature } = parsed.data
  
  // Get the challenge message
  const challenge = walletChallengeStore.get(address)
  if (!challenge) {
    res.status(401).json({ error: "No challenge requested for this address" })
    return
  }

  if (Date.now() > challenge.expires) {
    walletChallengeStore.delete(address)
    res.status(401).json({ error: "Challenge has expired" })
    return
  }

  // Verify the signature
  if (!verifyWalletSignature(address, challenge.message, signature)) {
    res.status(401).json({ error: "Invalid signature" })
    return
  }

  walletChallengeStore.delete(address)

  const existingUserId = walletToUserIdMap.get(address)
  let user = existingUserId ? userStore.get(existingUserId) : undefined
  
  if (!user) {
    // Create new user for wallet authentication
    const id = generateId()
    user = {
      id,
      walletAddress: address,
      name: `Wallet ${address.slice(0, 6)}...${address.slice(-4)}`,
      role: "tenant",
      authType: "wallet"
    }
    userStore.set(id, user)
    walletToUserIdMap.set(address, id)
  }

  const token = generateToken()
  tokenStore.set(token, { userId: user.id, authType: "wallet" })

  res.json({ token, user })
})

export { tokenStore, userStore }
export default router
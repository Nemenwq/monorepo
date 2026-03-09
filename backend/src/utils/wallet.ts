import { randomBytes } from 'node:crypto'
import {
  Account,
  Keypair,
  Networks,
  Operation,
  Transaction,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk'

export function generateNonce(): string {
  return randomBytes(16).toString('hex')
}

/**
 * Builds a SEP-0010-style challenge transaction.
 * The nonce is stored as a manageData operation value (not in the memo) to
 * avoid the 28-byte Stellar text memo limit.
 */
export function generateChallengeXdr(publicKey: string, nonce: string): string {
  const clientAccount = new Account(publicKey, '0')

  const transaction = new TransactionBuilder(clientAccount, {
    fee: '100',
    networkPassphrase: Networks.TESTNET,
    timebounds: {
      minTime: Math.floor(Date.now() / 1000),
      maxTime: Math.floor(Date.now() / 1000) + 300, // 5 minutes
    },
  })
    .addOperation(
      Operation.manageData({
        name: 'web_auth_domain',
        value: 'shelterflex.com',
      }),
    )
    .addOperation(
      Operation.manageData({
        name: 'nonce',
        value: nonce, // 32 hex chars = 32 bytes, fits manageData value (max 64 bytes)
      }),
    )
    .build()

  return transaction.toEnvelope().toXDR('base64')
}

export function verifySignedChallenge(publicKey: string, signedXdr: string, expectedNonce: string): boolean {
  try {
    const envelope = xdr.TransactionEnvelope.fromXDR(signedXdr, 'base64')
    const transaction = new Transaction(envelope, Networks.TESTNET)

    // Verify the transaction was signed by the public key
    const keypair = Keypair.fromPublicKey(publicKey)
    const txHash = transaction.hash()

    let signatures: xdr.DecoratedSignature[] = []
    if (envelope.switch().name === 'envelopeTypeTx') {
      signatures = envelope.v1().signatures()
    } else if (envelope.switch().name === 'envelopeTypeTxV0') {
      signatures = envelope.v0().signatures()
    }

    const validSignature = signatures.some((sig: xdr.DecoratedSignature) => {
      try {
        return keypair.verify(txHash, sig.signature())
      } catch {
        return false
      }
    })
    if (!validSignature) return false

    // Extract nonce from manageData operations
    let foundNonce: string | undefined
    for (const op of transaction.operations) {
      if (op.type === 'manageData' && op.name === 'nonce' && op.value) {
        foundNonce = op.value.toString('utf8')
        break
      }
    }
    if (foundNonce !== expectedNonce) return false

    // Verify time bounds
    const timeBounds = transaction.timeBounds
    if (!timeBounds) return false

    const now = Math.floor(Date.now() / 1000)
    const minTime = parseInt(timeBounds.minTime)
    const maxTime = parseInt(timeBounds.maxTime)
    if (now < minTime || now > maxTime) return false

    return true
  } catch (error) {
    console.error('Challenge verification failed:', error)
    return false
  }
}

export function isValidStellarPublicKey(publicKey: string): boolean {
  try {
    Keypair.fromPublicKey(publicKey)
    return true
  } catch {
    return false
  }
}

/**
 * Returns the canonical form of a Stellar public key:
 * - Trims surrounding whitespace
 * - Converts to uppercase (base32 is case-insensitive but the SDK expects uppercase)
 * - Validates that the result is a proper Stellar public key (starts with "G")
 *
 * Throws an Error with a descriptive message if the address is invalid.
 * All wallet auth paths must call this instead of .toLowerCase().
 */
export function normalizeStellarAddress(address: string): string {
  const trimmed = address.trim().toUpperCase()
  if (!isValidStellarPublicKey(trimmed)) {
    throw new Error(`Invalid Stellar public key: "${address}". Must be a valid G... StrKey.`)
  }
  return trimmed
}

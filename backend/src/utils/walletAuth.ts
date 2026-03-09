import { randomBytes } from 'node:crypto'
import {
  Account,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
  StrKey,
  xdr,
} from '@stellar/stellar-sdk'

export function isValidStellarPublicKey(publicKey: string): boolean {
  return StrKey.isValidEd25519PublicKey(publicKey)
}

export function getNetworkPassphrase(networkPassphrase?: string): string {
  return networkPassphrase || Networks.TESTNET
}

export function createSep10ChallengeXdr(params: {
  clientPublicKey: string
  serverSigningSecret: string
  homeDomain: string
  networkPassphrase: string
  timeoutSeconds?: number
}): { challengeXdr: string } {
  const { clientPublicKey, serverSigningSecret, homeDomain, networkPassphrase } = params

  if (!isValidStellarPublicKey(clientPublicKey)) {
    throw new Error('Invalid Stellar public key')
  }

  const serverKp = Keypair.fromSecret(serverSigningSecret)
  const clientAccount = new Account(clientPublicKey, '-1')
  const timeoutSeconds = params.timeoutSeconds ?? 300

  const nonce = randomBytes(48).toString('base64')

  const tx = new TransactionBuilder(clientAccount, {
    fee: '100',
    networkPassphrase,
  })
    .addOperation(
      Operation.manageData({
        name: `${homeDomain} auth`,
        value: nonce,
        source: clientPublicKey,
      }),
    )
    .addOperation(
      Operation.manageData({
        name: 'web_auth_domain',
        value: homeDomain,
        source: serverKp.publicKey(),
      }),
    )
    .setTimeout(timeoutSeconds)
    .setTimebounds(0, Math.floor(Date.now() / 1000) + timeoutSeconds)
    .build()

  tx.sign(serverKp)

  return { challengeXdr: tx.toXDR() }
}

export function verifySep10Challenge(params: {
  challengeXdr: string
  clientPublicKey: string
  serverSigningPublicKey: string
  homeDomain: string
  networkPassphrase: string
}): boolean {
  const { challengeXdr, clientPublicKey, serverSigningPublicKey, homeDomain, networkPassphrase } = params

  if (!isValidStellarPublicKey(clientPublicKey)) return false
  if (!isValidStellarPublicKey(serverSigningPublicKey)) return false

  let tx: xdr.TransactionEnvelope
  try {
    tx = xdr.TransactionEnvelope.fromXDR(challengeXdr, 'base64')
  } catch {
    return false
  }

  try {
    const stellarTx = TransactionBuilder.fromXDR(challengeXdr, networkPassphrase)
    const ops = stellarTx.operations
    if (ops.length < 1) return false

    // Require server signature
    const serverKp = Keypair.fromPublicKey(serverSigningPublicKey)
    if (!stellarTx.signatures.some((sig) => {
      try {
        return serverKp.verify(stellarTx.hash(), sig.signature())
      } catch {
        return false
      }
    })) {
      return false
    }

    // Require client signature
    const clientKp = Keypair.fromPublicKey(clientPublicKey)
    if (!stellarTx.signatures.some((sig) => {
      try {
        return clientKp.verify(stellarTx.hash(), sig.signature())
      } catch {
        return false
      }
    })) {
      return false
    }

    // Basic op checks
    const firstOp = ops[0] as any
    if (firstOp.type !== 'manageData') return false
    if (firstOp.source !== clientPublicKey) return false
    if (typeof firstOp.name !== 'string' || firstOp.name !== `${homeDomain} auth`) return false

    // Ensure web_auth_domain op exists
    const hasWebAuth = ops.some((op: any) => op.type === 'manageData' && op.name === 'web_auth_domain')
    if (!hasWebAuth) return false

    return true
  } catch {
    return false
  }
}

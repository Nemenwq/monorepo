import { randomBytes } from 'node:crypto'
import { verifyMessage, getAddress } from 'ethers'

export function generateWalletChallenge(address: string): string {
  const timestamp = Date.now().toString()
  const nonce = randomBytes(16).toString('hex')
  return `Sign this message to authenticate with Shelterflex. Address: ${address}, Nonce: ${nonce}, Timestamp: ${timestamp}`
}

export function verifyWalletSignature(address: string, message: string, signature: string): boolean {
  try {
    const recovered = verifyMessage(message, signature)
    return getAddress(recovered) === getAddress(address)
  } catch {
    return false
  }
}

export function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

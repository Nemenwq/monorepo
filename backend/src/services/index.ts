import { EventEmitter } from 'events'
import type { KycStatus } from '../schemas/kyc.js'

export { type CustodialWalletService } from './CustodialWalletService.js'
export { CustodialWalletServiceImpl } from './CustodialWalletServiceImpl.js'

class KycStatusEmitter extends EventEmitter {
  emitStatusChanged(userId: string, status: KycStatus): void {
    this.emit('statusChanged', userId, status)
  }
}

export const kycStatusEmitter = new KycStatusEmitter()

export async function emitKycStatusChanged(
  userId: string,
  status: KycStatus
): Promise<void> {
  kycStatusEmitter.emitStatusChanged(userId, status)
}
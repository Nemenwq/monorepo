import type { KycSubmission, KycStatus, KycDocumentType } from '../schemas/kyc.js'
import { logger } from '../utils/logger.js'

export interface KycProviderResult {
  success: boolean
  externalId?: string
  status?: KycStatus
  error?: string
}

export interface KycProvider {
  readonly name: string

  submit(submission: KycSubmission): Promise<KycProviderResult>

  checkStatus(externalId: string): Promise<KycStatus | null>

  webhookAuthenticate(payload: Record<string, unknown>): boolean
}

export class StubKycProvider implements KycProvider {
  readonly name = 'stub'

  async submit(submission: KycSubmission): Promise<KycProviderResult> {
    logger.info('kyc.stub.submit', { documentType: submission.documentType })
    return {
      success: true,
      externalId: `stub_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      status: 'approved',
    }
  }

  async checkStatus(externalId: string): Promise<KycStatus | null> {
    logger.info('kyc.stub.checkStatus', { externalId })
    return 'approved'
  }

  webhookAuthenticate(payload: Record<string, unknown>): boolean {
    const signature = payload.signature as string | undefined
    return signature === 'stub_valid_signature'
  }
}

export class RealKycProvider implements KycProvider {
  readonly name = 'real'
  private readonly apiKey: string
  private readonly baseUrl: string

  constructor() {
    this.apiKey = process.env.KYC_PROVIDER_API_KEY || ''
    this.baseUrl = process.env.KYC_PROVIDER_BASE_URL || ''
    if (!this.apiKey || !this.baseUrl) {
      throw new Error('KYC_PROVIDER_API_KEY and KYC_PROVIDER_BASE_URL must be set')
    }
  }

  async submit(submission: KycSubmission): Promise<KycProviderResult> {
    const response = await fetch(`${this.baseUrl}/v1/verifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        document_type: submission.documentType,
        front_image_key: submission.frontImageKey,
        back_image_key: submission.backImageKey,
        liveness_signal: submission.livenessSignal,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      logger.error('kyc.provider.submit_failed', { error })
      return { success: false, error }
    }

    const data = await response.json() as { id: string; status: string }
    return {
      success: true,
      externalId: data.id,
      status: mapProviderStatus(data.status),
    }
  }

  async checkStatus(externalId: string): Promise<KycStatus | null> {
    const response = await fetch(`${this.baseUrl}/v1/verifications/${externalId}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json() as { status: string }
    return mapProviderStatus(data.status)
  }

  webhookAuthenticate(payload: Record<string, unknown>): boolean {
    const signature = payload.signature as string | undefined
    const expected = require('crypto')
      .createHmac('sha256', this.apiKey)
      .update(JSON.stringify(payload))
      .digest('hex')
    return signature === expected
  }
}

function mapProviderStatus(providerStatus: string): KycStatus {
  const statusMap: Record<string, KycStatus> = {
    pending: 'pending',
    in_progress: 'in_review',
    approved: 'approved',
    rejected: 'rejected',
    expired: 'expired',
  }
  return statusMap[providerStatus] || 'pending'
}

export function createKycProvider(): KycProvider {
  const providerType = process.env.KYC_PROVIDER_TYPE || 'stub'
  if (providerType === 'real') {
    return new RealKycProvider()
  }
  return new StubKycProvider()
}
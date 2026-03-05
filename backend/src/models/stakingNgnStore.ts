import { randomUUID } from 'node:crypto'
import type { StakingQuoteResponse, StakingStatusResponse } from '../schemas/stakingNgn.js'

export interface StakingQuote {
  quoteId: string
  amountNgn: number
  estimatedUsdc: number
  fxRate: number
  fees: {
    conversion: number
    staking: number
    total: number
  }
  totalUsdcAfterFees: number
  expiresAt: Date
  createdAt: Date
  userId: string
}

export interface NgnStake {
  stakeId: string
  quoteId: string
  userId: string
  amountNgn: number
  estimatedUsdc: number
  status: 'ngn_reserved' | 'conversion_processing' | 'usdc_staked' | 'receipt_recorded' | 'failed'
  timeline: {
    step: string
    status: 'pending' | 'completed' | 'failed'
    timestamp: Date | null
    description: string
  }[]
  amountUsdc: number | null
  txHash: string | null
  createdAt: Date
  completedAt: Date | null
}

class StakingQuoteStore {
  private readonly quotes: Map<string, StakingQuote> = new Map()

  create(quote: Omit<StakingQuote, 'quoteId' | 'createdAt'>): StakingQuote {
    const newQuote: StakingQuote = {
      ...quote,
      quoteId: randomUUID(),
      createdAt: new Date(),
    }
    this.quotes.set(newQuote.quoteId, newQuote)
    return newQuote
  }

  getById(quoteId: string): StakingQuote | undefined {
    return this.quotes.get(quoteId)
  }

  deleteById(quoteId: string): boolean {
    return this.quotes.delete(quoteId)
  }

  deleteExpired(): void {
    const now = new Date()
    for (const [quoteId, quote] of this.quotes.entries()) {
      if (quote.expiresAt < now) {
        this.quotes.delete(quoteId)
      }
    }
  }

  clear(): void {
    this.quotes.clear()
  }
}

class NgnStakeStore {
  private readonly stakes: Map<string, NgnStake> = new Map()

  create(stake: Omit<NgnStake, 'stakeId' | 'createdAt' | 'timeline'>): NgnStake {
    const newStake: NgnStake = {
      ...stake,
      stakeId: randomUUID(),
      createdAt: new Date(),
      timeline: [
        {
          step: 'NGN reserved',
          status: 'pending',
          timestamp: null,
          description: 'NGN funds reserved for staking conversion',
        },
        {
          step: 'Conversion processing',
          status: 'pending',
          timestamp: null,
          description: 'Converting NGN to USDC at current market rate',
        },
        {
          step: 'USDC staked on-chain',
          status: 'pending',
          timestamp: null,
          description: 'USDC tokens being staked in the protocol',
        },
        {
          step: 'Receipt recorded',
          status: 'pending',
          timestamp: null,
          description: 'Staking receipt recorded on blockchain',
        },
      ],
    }
    this.stakes.set(newStake.stakeId, newStake)
    return newStake
  }

  getById(stakeId: string): NgnStake | undefined {
    return this.stakes.get(stakeId)
  }

  updateStatus(stakeId: string, status: NgnStake['status'], additionalData?: Partial<NgnStake>): NgnStake | undefined {
    const stake = this.stakes.get(stakeId)
    if (!stake) return undefined

    stake.status = status
    if (additionalData) {
      Object.assign(stake, additionalData)
    }

    // Update timeline
    const stepMap: Record<NgnStake['status'], number> = {
      'ngn_reserved': 0,
      'conversion_processing': 1,
      'usdc_staked': 2,
      'receipt_recorded': 3,
      'failed': -1,
    }

    const stepIndex = stepMap[status]
    if (stepIndex >= 0 && stepIndex < stake.timeline.length) {
      stake.timeline[stepIndex].status = 'completed'
      stake.timeline[stepIndex].timestamp = new Date()
    }

    if (status === 'failed') {
      stake.timeline.forEach(step => {
        if (step.status === 'pending') {
          step.status = 'failed'
          step.timestamp = new Date()
        }
      })
    }

    if (status === 'receipt_recorded') {
      stake.completedAt = new Date()
    }

    return stake
  }

  getByUserId(userId: string): NgnStake[] {
    return Array.from(this.stakes.values()).filter(stake => stake.userId === userId)
  }

  clear(): void {
    this.stakes.clear()
  }
}

export const stakingQuoteStore = new StakingQuoteStore()
export const ngnStakeStore = new NgnStakeStore()

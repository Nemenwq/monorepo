import { RewardsDataLayer, RewardRecord, PayoutStatus } from './earnings.js'
import { rewardStore } from '../models/rewardStore.js'
import { RewardStatus } from '../models/reward.js'

/**
 * Persistent implementation of RewardsDataLayer using PostgresRewardStore.
 * Provides real database-backed reward queries for production environments.
 */
export class PostgresRewardsDataLayer implements RewardsDataLayer {
  async getRewardsByWhistleblower(whistleblowerId: string): Promise<RewardRecord[]> {
    const rewards = await rewardStore.listAll()
    const whistleblowerRewards = rewards.filter(r => r.whistleblowerId === whistleblowerId)
    
    return whistleblowerRewards.map(reward => this.mapToRewardRecord(reward))
  }

  async whistleblowerExists(whistleblowerId: string): Promise<boolean> {
    const rewards = await rewardStore.listAll()
    return rewards.some(r => r.whistleblowerId === whistleblowerId)
  }

  /**
   * Map Reward model to RewardRecord interface used by earnings service.
   */
  private mapToRewardRecord(reward: import('../models/reward.js').Reward): RewardRecord {
    return {
      id: reward.rewardId,
      whistleblowerId: reward.whistleblowerId,
      listingId: reward.listingId,
      dealId: reward.dealId,
      amountUsdc: BigInt(Math.floor(reward.amountUsdc * 1_000_000)), // Convert to smallest unit
      status: this.mapPayoutStatus(reward.status),
      createdAt: reward.createdAt,
      paidAt: reward.paidAt || null,
    }
  }

  /**
   * Map RewardStatus to PayoutStatus.
   */
  private mapPayoutStatus(status: RewardStatus): PayoutStatus {
    switch (status) {
      case RewardStatus.PAID:
        return 'paid'
      case RewardStatus.PAYABLE:
        return 'payable'
      case RewardStatus.PENDING:
        return 'pending'
      case RewardStatus.CANCELLED:
        return 'pending' // Treat cancelled as pending for earnings purposes
      default:
        return 'pending'
    }
  }
}

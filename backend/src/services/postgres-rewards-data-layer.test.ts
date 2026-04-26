import { describe, it, expect, beforeEach } from 'vitest'
import { PostgresRewardsDataLayer } from './postgres-rewards-data-layer.js'
import { rewardStore } from '../models/rewardStore.js'
import { RewardStatus } from '../models/reward.js'

describe('PostgresRewardsDataLayer', () => {
  beforeEach(async () => {
    await rewardStore.clear()
  })

  it('should return empty array for whistleblower with no rewards', async () => {
    const dataLayer = new PostgresRewardsDataLayer()
    const rewards = await dataLayer.getRewardsByWhistleblower('non-existent-whistleblower')
    expect(rewards).toEqual([])
  })

  it('should return rewards for existing whistleblower', async () => {
    const dataLayer = new PostgresRewardsDataLayer()
    const whistleblowerId = 'test-whistleblower-1'

    // Create test rewards
    await rewardStore.create({
      whistleblowerId,
      dealId: 'deal-1',
      listingId: 'listing-1',
      amountUsdc: 50,
    })

    await rewardStore.create({
      whistleblowerId,
      dealId: 'deal-2',
      listingId: 'listing-2',
      amountUsdc: 100,
    })

    const rewards = await dataLayer.getRewardsByWhistleblower(whistleblowerId)
    expect(rewards).toHaveLength(2)
    expect(rewards[0].whistleblowerId).toBe(whistleblowerId)
    expect(rewards[1].whistleblowerId).toBe(whistleblowerId)
  })

  it('should return false for non-existent whistleblower', async () => {
    const dataLayer = new PostgresRewardsDataLayer()
    const exists = await dataLayer.whistleblowerExists('non-existent-whistleblower')
    expect(exists).toBe(false)
  })

  it('should return true for existing whistleblower', async () => {
    const dataLayer = new PostgresRewardsDataLayer()
    const whistleblowerId = 'test-whistleblower-1'

    await rewardStore.create({
      whistleblowerId,
      dealId: 'deal-1',
      listingId: 'listing-1',
      amountUsdc: 50,
    })

    const exists = await dataLayer.whistleblowerExists(whistleblowerId)
    expect(exists).toBe(true)
  })

  it('should map reward status correctly', async () => {
    const dataLayer = new PostgresRewardsDataLayer()
    const whistleblowerId = 'test-whistleblower-1'

    // Create reward with PAID status
    const reward = await rewardStore.create({
      whistleblowerId,
      dealId: 'deal-1',
      listingId: 'listing-1',
      amountUsdc: 50,
    })

    await rewardStore.markAsPaid(
      reward.rewardId,
      'payment-tx-1',
      'external-source',
      'external-ref-1',
    )

    const rewards = await dataLayer.getRewardsByWhistleblower(whistleblowerId)
    expect(rewards).toHaveLength(1)
    expect(rewards[0].status).toBe('paid')
    expect(rewards[0].paidAt).not.toBeNull()
  })

  it('should convert amountUsdc to smallest unit (bigint)', async () => {
    const dataLayer = new PostgresRewardsDataLayer()
    const whistleblowerId = 'test-whistleblower-1'

    await rewardStore.create({
      whistleblowerId,
      dealId: 'deal-1',
      listingId: 'listing-1',
      amountUsdc: 50.5, // 50.5 USDC
    })

    const rewards = await dataLayer.getRewardsByWhistleblower(whistleblowerId)
    expect(rewards).toHaveLength(1)
    expect(rewards[0].amountUsdc).toBe(50500000n) // 50.5 * 1_000_000
  })
})

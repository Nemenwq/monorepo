import { describe, expect, it, vi } from "vitest";
import { EarningsServiceImpl, RewardRecord, RewardsDataLayer } from "./earnings.js";

function createReward(partial: Partial<RewardRecord>): RewardRecord {
  return {
    id: partial.id ?? "reward-1",
    whistleblowerId: partial.whistleblowerId ?? "wb-1",
    listingId: partial.listingId ?? "listing-1",
    dealId: partial.dealId ?? "deal-1",
    amountUsdc: partial.amountUsdc ?? 1_000_000n,
    status: partial.status ?? "pending",
    createdAt: partial.createdAt ?? new Date("2026-01-01T00:00:00.000Z"),
    paidAt: partial.paidAt ?? null,
  };
}

describe("EarningsServiceImpl", () => {
  it("aggregates mixed payout states and keeps totals invariant", async () => {
    const rewards = [
      createReward({
        id: "r1",
        amountUsdc: 20_500_000n,
        status: "pending",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
      createReward({
        id: "r2",
        amountUsdc: 5_250_000n,
        status: "payable",
        createdAt: new Date("2026-01-03T00:00:00.000Z"),
      }),
      createReward({
        id: "r3",
        amountUsdc: 4_250_000n,
        status: "paid",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        paidAt: new Date("2026-01-04T00:00:00.000Z"),
      }),
    ];
    const dataLayer: RewardsDataLayer = {
      whistleblowerExists: vi.fn().mockResolvedValue(true),
      getRewardsByWhistleblower: vi.fn().mockResolvedValue(rewards),
    };
    const service = new EarningsServiceImpl(dataLayer, { usdcToNgnRate: 1600 });

    const result = await service.getEarnings("wb-1");

    expect(result.totals.totalUsdc).toBe(30);
    expect(result.totals.pendingUsdc).toBe(25.75);
    expect(result.totals.paidUsdc).toBe(4.25);
    expect(result.totals.pendingUsdc + result.totals.paidUsdc).toBe(
      result.totals.totalUsdc,
    );
    expect(result.totals.totalNgn).toBe(48_000);
    expect(result.history.map((item) => item.rewardId)).toEqual(["r2", "r3", "r1"]);
    expect(result.history[1].paidAt).toBe("2026-01-04T00:00:00.000Z");
  });

  it("returns zero totals and empty history for empty rewards", async () => {
    const dataLayer: RewardsDataLayer = {
      whistleblowerExists: vi.fn().mockResolvedValue(true),
      getRewardsByWhistleblower: vi.fn().mockResolvedValue([]),
    };
    const service = new EarningsServiceImpl(dataLayer, { usdcToNgnRate: 1600 });

    const result = await service.getEarnings("wb-empty");

    expect(result.history).toEqual([]);
    expect(result.totals).toEqual({
      totalNgn: 0,
      pendingNgn: 0,
      paidNgn: 0,
      totalUsdc: 0,
      pendingUsdc: 0,
      paidUsdc: 0,
    });
  });

  it("throws not found for unknown whistleblower", async () => {
    const dataLayer: RewardsDataLayer = {
      whistleblowerExists: vi.fn().mockResolvedValue(false),
      getRewardsByWhistleblower: vi.fn(),
    };
    const service = new EarningsServiceImpl(dataLayer, { usdcToNgnRate: 1600 });

    await expect(service.getEarnings("wb-missing")).rejects.toMatchObject({
      name: "AppError",
      status: 404,
    });
  });
});

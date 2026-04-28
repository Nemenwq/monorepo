import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PayoutBreakdown } from "./PayoutBreakdown";
import type { PayoutBreakdown as PayoutBreakdownType } from "@/lib/paymentApi";

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => {
    // Simple mock that returns the key or a mapped value
    const messages: Record<string, Record<string, string>> = {
      payment: {
        paymentConfirmed: "Payment confirmed",
        rewardDistribution: "Reward distribution",
        platformFee: "Platform fee",
        platformFeeSubLabel: "Covers platform operations",
        reporterReward: "Reporter reward",
        reporterRewardSubLabel: "Paid to the property reporter",
        noReporter: "No reporter on this listing",
        landlordPayout: "Landlord payout",
        totalCharged: "Total charged",
      },
    };
    return (key: string) => messages[namespace]?.[key] || key;
  },
}));

const baseBreakdown: PayoutBreakdownType = {
  totalAmount: 500_000,
  platformShare: 25_000,
  reporterShare: 10_000,
  landlordAmount: 465_000,
  currency: "NGN",
};

describe("PayoutBreakdown", () => {
  it("renders all line items with reporter present", () => {
    render(<PayoutBreakdown breakdown={baseBreakdown} />);

    expect(screen.getByText("Platform fee")).toBeInTheDocument();
    expect(screen.getByText("Reporter reward")).toBeInTheDocument();
    expect(screen.getByText("Landlord payout")).toBeInTheDocument();
    expect(screen.getByText("Total charged")).toBeInTheDocument();
  });

  it("shows dash when reporter is null", () => {
    render(<PayoutBreakdown breakdown={{ ...baseBreakdown, reporterShare: null }} />);

    expect(screen.getByText("No reporter on this listing")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows confirmed badge when confirmed=true", () => {
    render(<PayoutBreakdown breakdown={baseBreakdown} confirmed />);

    expect(screen.getByText("Payment confirmed")).toBeInTheDocument();
  });

  it("does not show confirmed badge by default", () => {
    render(<PayoutBreakdown breakdown={baseBreakdown} />);

    expect(screen.queryByText("Payment confirmed")).not.toBeInTheDocument();
  });

  it("formats amounts as NGN currency with decimals", () => {
    render(<PayoutBreakdown breakdown={baseBreakdown} />);

    // Total should be formatted — Intl formats 500000 as ₦500,000.00
    // We use a regex to match both the number and the decimals
    expect(screen.getByText(/500,000\.00/)).toBeInTheDocument();
  });
});

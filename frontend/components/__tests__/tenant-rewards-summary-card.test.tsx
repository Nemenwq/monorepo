import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { TenantRewardsSummaryCard } from "@/components/tenant-rewards-summary-card";

vi.mock("next/link", () => {
  return {
    default: ({ href, children }: { href: string; children: ReactNode }) => (
      <a href={href}>{children}</a>
    ),
  };
});

vi.mock("@/lib/config", async () => {
  const actual = await vi.importActual<typeof import("@/lib/config")>(
    "@/lib/config",
  );

  return {
    ...actual,
    getStakingPosition: vi.fn(),
  };
});

describe("TenantRewardsSummaryCard", () => {
  it("renders rewards summary when data is present", async () => {
    process.env.NEXT_PUBLIC_BACKEND_URL = "http://localhost:4000";

    const { getStakingPosition } = await import("@/lib/config");
    vi.mocked(getStakingPosition).mockResolvedValue({
      success: true,
      position: {
        staked: "100.12",
        claimable: "5",
        warming: "0",
        cooling: "1",
      },
    });

    render(<TenantRewardsSummaryCard />);

    await waitFor(() => {
      expect(screen.getByText("Claimable")).toBeInTheDocument();
    });

    expect(screen.getByText("5.00 USDC")).toBeInTheDocument();
    expect(screen.getByText("100.12 USDC")).toBeInTheDocument();
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
  });

  it("renders empty state when no position data exists", async () => {
    process.env.NEXT_PUBLIC_BACKEND_URL = "http://localhost:4000";

    const { getStakingPosition } = await import("@/lib/config");
    vi.mocked(getStakingPosition).mockResolvedValue({
      success: true,
      position: {
        staked: "0",
        claimable: "0",
        warming: "0",
        cooling: "0",
      },
    });

    render(<TenantRewardsSummaryCard />);

    await waitFor(() => {
      expect(
        screen.getByText(/don’t have a staking position yet/i),
      ).toBeInTheDocument();
    });

    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
  });
});

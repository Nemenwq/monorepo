import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import WalletPage from "./page";

vi.mock("next/navigation", () => {
  return {
    useRouter: () => ({ replace: vi.fn() }),
    usePathname: () => "/wallet",
    useSearchParams: vi.fn(),
  };
});

vi.mock("@/hooks/useRiskState", () => ({
  useRiskState: () => ({ isFrozen: false, freezeReason: null }),
}));

vi.mock("@/components/wallet/TopUpModal", () => ({
  TopUpModal: () => null,
}));

vi.mock("@/components/wallet/WithdrawalModal", () => ({
  WithdrawalModal: () => null,
}));

vi.mock("@/components/wallet/WithdrawalHistory", () => ({
  WithdrawalHistory: () => null,
}));

vi.mock("@/components/FrozenAccountBanner", () => ({
  default: () => null,
}));

vi.mock("@/lib/toast", () => ({
  handleError: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@/lib/csvExport", () => ({
  generateLedgerCsv: vi.fn(() => "csv-content"),
  downloadCsv: vi.fn(),
}));

vi.mock("@/lib/walletApi", () => ({
  getNgnBalance: vi.fn(),
  getNgnLedger: vi.fn(),
}));

import { useSearchParams } from "next/navigation";
import { getNgnBalance, getNgnLedger } from "@/lib/walletApi";
import { downloadCsv } from "@/lib/csvExport";

type MockUseSearchParams = Mock<typeof useSearchParams>;
type MockGetNgnBalance = Mock<typeof getNgnBalance>;
type MockGetNgnLedger = Mock<typeof getNgnLedger>;
type MockDownloadCsv = Mock<typeof downloadCsv>;

function ledgerEntry(overrides?: Partial<{ id: string; type: string }>) {
  return {
    id: overrides?.id ?? "e-1",
    type: overrides?.type ?? "top_up",
    amountNgn: 1000,
    status: "confirmed" as const,
    timestamp: "2026-01-01T00:00:00.000Z",
    reference: "ref-1",
  };
}

describe("Wallet CSV export", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const mockBalance = getNgnBalance as MockGetNgnBalance;
    mockBalance.mockResolvedValue({ availableNgn: 0, heldNgn: 0, totalNgn: 0 });

    const mockLedger = getNgnLedger as MockGetNgnLedger;
    mockLedger.mockResolvedValue({ entries: [ledgerEntry()], nextCursor: null });

    const mockUseSearchParams = useSearchParams as MockUseSearchParams;
    mockUseSearchParams.mockReturnValue(new URLSearchParams() as any);
  });

  it("shows export all entries and hides filtered export when no filters are active", async () => {
    render(<WalletPage />);

    const exportButton = await screen.findByRole("button", { name: /export csv/i });
    await waitFor(() => expect(exportButton).toBeEnabled());

    await userEvent.click(exportButton);

    expect(screen.getByText("Export all entries")).toBeInTheDocument();
    expect(screen.queryByText(/Export filtered/i)).not.toBeInTheDocument();
  });

  it("shows filtered export option when filters are active", async () => {
    const mockUseSearchParams = useSearchParams as MockUseSearchParams;
    mockUseSearchParams.mockReturnValue(new URLSearchParams("filter=topups") as any);

    render(<WalletPage />);

    const exportButton = await screen.findByRole("button", { name: /export csv/i });
    await waitFor(() => expect(exportButton).toBeEnabled());

    await userEvent.click(exportButton);

    expect(screen.getByText("Export all entries")).toBeInTheDocument();
    expect(screen.getByText(/Export filtered \(Top-ups\)/i)).toBeInTheDocument();
  });

  it("exports ledger entries that match the active filter selection", async () => {
    const mockUseSearchParams = useSearchParams as MockUseSearchParams;
    mockUseSearchParams.mockReturnValue(new URLSearchParams("filter=topups") as any);

    const mockLedger = getNgnLedger as MockGetNgnLedger;

    mockLedger.mockImplementation(async (params?: { cursor?: string; limit?: number; type?: string[] }) => {
      if (params?.limit === 10) {
        return { entries: [ledgerEntry({ id: "initial" })], nextCursor: null };
      }

      if (params?.limit === 100 && !params?.cursor) {
        return { entries: [ledgerEntry({ id: "p1" })], nextCursor: "c1" };
      }

      if (params?.limit === 100 && params?.cursor === "c1") {
        return { entries: [ledgerEntry({ id: "p2" })], nextCursor: null };
      }

      return { entries: [], nextCursor: null };
    });

    render(<WalletPage />);

    const exportButton = await screen.findByRole("button", { name: /export csv/i });
    await waitFor(() => expect(exportButton).toBeEnabled());

    await userEvent.click(exportButton);
    await userEvent.click(screen.getByText(/Export filtered/i));

    await waitFor(() => {
      expect(downloadCsv).toHaveBeenCalledTimes(1);
    });

    const exportCalls = mockLedger.mock.calls
      .map((c) => c[0])
      .filter((p) => p?.limit === 100);

    expect(exportCalls.length).toBe(2);
    for (const call of exportCalls) {
      expect(call?.type).toEqual(["top_up"]);
    }

    const mockDownload = downloadCsv as MockDownloadCsv;
    expect(mockDownload.mock.calls[0]?.[1]).toMatch(
      /^wallet-ledger-filtered-topups-\d{4}-\d{2}-\d{2}\.csv$/
    );
  });
});

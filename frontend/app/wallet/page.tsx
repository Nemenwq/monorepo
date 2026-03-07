"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, ArrowDownToLine, ArrowUpRight, Info, RefreshCw, Wallet, ExternalLink } from "lucide-react";
import { handleError } from "@/lib/toast";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { TopUpModal } from "@/components/wallet/TopUpModal";
import { WithdrawalModal } from "@/components/wallet/WithdrawalModal";
import { WithdrawalHistory } from "@/components/wallet/WithdrawalHistory";

import {
  getNgnBalance,
  getNgnLedger,
  type NgnBalanceResponse,
  type WalletLedgerEntry,
} from "@/lib/walletApi";

type LoadState<T> =
  | { type: "loading" }
  | { type: "error"; message: string }
  | { type: "success"; data: T };

function formatNgn(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount);
}

function humanizeEntryType(type: string) {
  const normalized = type.trim().replaceAll("_", " ");
  if (!normalized) return "Activity";
  return normalized
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function statusPresentation(status: WalletLedgerEntry["status"]) {
  if (status === "confirmed") {
    return { label: "Confirmed", variant: "secondary" as const };
  }
  if (status === "failed") {
    return { label: "Failed", variant: "destructive" as const };
  }
  if (status === "approved") {
    return { label: "Approved", variant: "default" as const };
  }
  if (status === "rejected") {
    return { label: "Rejected", variant: "destructive" as const };
  }
  return { label: "Pending", variant: "outline" as const };
}

export default function WalletPage() {
  const [balanceState, setBalanceState] = useState<
    LoadState<NgnBalanceResponse>
  >({
    type: "loading",
  });
  const [ledgerState, setLedgerState] = useState<LoadState<WalletLedgerEntry[]>>({
    type: "loading",
  });
  const [topUpModalOpen, setTopUpModalOpen] = useState(false);
  const [withdrawalModalOpen, setWithdrawalModalOpen] = useState(false);

  // Separate retry function that sets loading state (called from user interactions, not effects)
  const retry = useCallback(() => {
    setBalanceState({ type: "loading" });
    setLedgerState({ type: "loading" });
  }, []);

  // Effect for initial data fetch - no synchronous setState calls
  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const [balance, ledger] = await Promise.all([
          getNgnBalance(),
          getNgnLedger({ limit: 10 }),
        ]);

        if (!cancelled) {
          setBalanceState({ type: "success", data: balance });
          setLedgerState({ type: "success", data: ledger.entries });
        }
      } catch (err) {
        if (!cancelled) {
          handleError(err, "Failed to load wallet data");
          const message = err instanceof Error ? err.message : "Something went wrong";
          setBalanceState({ type: "error", message });
          setLedgerState({ type: "error", message });
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 md:py-10">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center border-3 border-foreground bg-secondary shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold md:text-3xl">Wallet</h1>
              <p className="text-sm text-muted-foreground">
                Manage your NGN balance and view recent activity.
              </p>
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button
              className="w-full border-3 border-foreground bg-primary font-bold shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] sm:w-auto"
              onClick={() => setTopUpModalOpen(true)}
            >
              <ArrowDownToLine className="h-4 w-4" />
              Top up
            </Button>
            <Button
              variant="outline"
              className="w-full border-3 border-foreground bg-background font-bold shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] sm:w-auto"
              onClick={() => setWithdrawalModalOpen(true)}
            >
              <ArrowUpRight className="h-4 w-4" />
              Withdraw
            </Button>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          <Card className="border-3 border-foreground shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]">
            <CardHeader className="pb-2">
              <CardDescription>Available</CardDescription>
              <CardTitle className="font-mono text-2xl">
                {balanceState.type === "loading" && (
                  <Skeleton className="h-8 w-40" />
                )}
                {balanceState.type === "error" && "—"}
                {balanceState.type === "success" &&
                  formatNgn(balanceState.data.availableNgn)}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground">Spendable funds</p>
            </CardContent>
          </Card>

          <Card className="border-3 border-foreground shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardDescription>Held</CardDescription>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="Held funds info"
                      className="flex h-8 w-8 items-center justify-center border-2 border-foreground bg-muted text-foreground"
                    >
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>
                    Funds reserved for staking/withdrawals
                  </TooltipContent>
                </Tooltip>
              </div>
              <CardTitle className="font-mono text-2xl">
                {balanceState.type === "loading" && (
                  <Skeleton className="h-8 w-40" />
                )}
                {balanceState.type === "error" && "—"}
                {balanceState.type === "success" &&
                  formatNgn(balanceState.data.heldNgn)}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground">Reserved funds</p>
            </CardContent>
          </Card>

          <Card className="border-3 border-foreground bg-primary/10 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]">
            <CardHeader className="pb-2">
              <CardDescription>Total</CardDescription>
              <CardTitle className="font-mono text-2xl text-primary">
                {balanceState.type === "loading" && (
                  <Skeleton className="h-8 w-40" />
                )}
                {balanceState.type === "error" && "—"}
                {balanceState.type === "success" &&
                  formatNgn(balanceState.data.totalNgn)}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground">
                Available + held
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold md:text-xl">Recent activity</h2>
            <Button
              variant="outline"
              size="sm"
              className="border-2 border-foreground bg-background font-bold"
              onClick={retry}
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>

          <Card className="border-3 border-foreground shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]">
            <CardContent className="pt-6">
              {ledgerState.type === "loading" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4 border-b border-foreground/10 pb-3">
                    <div className="flex min-w-0 flex-col gap-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-56" />
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-5 w-20" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-b border-foreground/10 pb-3">
                    <div className="flex min-w-0 flex-col gap-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-56" />
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-5 w-20" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-b border-foreground/10 pb-3">
                    <div className="flex min-w-0 flex-col gap-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-56" />
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-5 w-20" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-b border-foreground/10 pb-3">
                    <div className="flex min-w-0 flex-col gap-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-56" />
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-5 w-20" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-b border-foreground/10 pb-3">
                    <div className="flex min-w-0 flex-col gap-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-56" />
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-5 w-20" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 flex-col gap-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-56" />
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-5 w-20" />
                    </div>
                  </div>
                </div>
              )}

              {ledgerState.type === "error" && (
                <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                  <div className="flex h-12 w-12 items-center justify-center border-3 border-foreground bg-destructive/10">
                    <AlertCircle className="h-6 w-6 text-destructive" />
                  </div>
                  <div>
                    <p className="font-bold">Could not load wallet activity</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {ledgerState.message}
                    </p>
                  </div>
                  <Button
                    className="border-3 border-foreground bg-primary font-bold shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]"
                    onClick={retry}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Retry
                  </Button>
                </div>
              )}

              {ledgerState.type === "success" && ledgerState.data.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                  <div className="flex h-12 w-12 items-center justify-center border-3 border-foreground bg-muted">
                    <Wallet className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="font-bold">No activity yet</p>
                  <p className="text-sm text-muted-foreground">
                    Your deposits and withdrawals will show up here.
                  </p>
                </div>
              )}

              {ledgerState.type === "success" && ledgerState.data.length > 0 && (
                <div className="divide-y divide-foreground/10">
                  {ledgerState.data.map((entry: WalletLedgerEntry) => {
                    const amount = entry.amountNgn;
                    const isCredit = amount > 0;
                    const amountText = `${isCredit ? "+" : "-"}${formatNgn(
                      Math.abs(amount),
                    )}`;

                    const { label, variant } = statusPresentation(entry.status);
                    const isPending = entry.status === "pending";
                    const isProcessing = entry.status === "approved" || entry.status === "pending";

                    return (
                      <div
                        key={entry.id}
                        className={`flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between ${
                          isPending ? "bg-muted/50" : ""
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold">
                              {humanizeEntryType(entry.type)}
                            </p>
                            {isPending && (
                              <div className="flex h-2 w-2 animate-pulse rounded-full bg-primary" />
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>
                              {new Date(entry.timestamp).toLocaleString("en-NG")}
                            </span>
                            {entry.reference ? (
                              <span className="truncate border border-foreground/20 bg-muted px-2 py-0.5 font-mono">
                                {entry.reference}
                              </span>
                            ) : null}
                          </div>
                          {isPending && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              {entry.type === "top_up" && "Waiting for payment confirmation"}
                              {entry.type === "withdrawal" && "Processing withdrawal request"}
                              {entry.type === "staking_conversion" && "Converting NGN to USDC for staking"}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-center">
                          <p
                            className={`font-mono text-base font-black ${
                              isCredit ? "text-secondary" : "text-destructive"
                            }`}
                          >
                            {amountText}
                          </p>
                          <div className="flex flex-col items-end gap-2">
                            <Badge variant={variant}>
                              {isPending && (
                                <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                              )}
                              {label}
                            </Badge>
                            {(entry.status === "failed" || entry.status === "rejected") && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                  // Open support contact - could be a mailto link or support page
                                  window.location.href = "mailto:support@example.com?subject=Withdrawal Issue - " + (entry.reference || entry.id);
                                }}
                              >
                                <ExternalLink className="mr-1 h-3 w-3" />
                                Contact support
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <WithdrawalHistory className="mt-8" />

        {balanceState.type === "error" && (
          <div className="mt-6 rounded-md border-2 border-foreground bg-muted p-4 text-sm">
            <p className="font-bold">Wallet data unavailable</p>
            <p className="mt-1 text-muted-foreground">{balanceState.message}</p>
          </div>
        )}
      </div>
      <TopUpModal
        open={topUpModalOpen}
        onOpenChange={setTopUpModalOpen}
        onSuccess={() => {
          // Refresh wallet data after successful top-up initiation
          retry();
        }}
      />
      <WithdrawalModal
        open={withdrawalModalOpen}
        onOpenChange={setWithdrawalModalOpen}
        onSuccess={() => {
          // Refresh wallet data after successful withdrawal initiation
          retry();
        }}
        availableBalance={balanceState.type === "success" ? balanceState.data.availableNgn : 0}
      />
    </main>
  );
}

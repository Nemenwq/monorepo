"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  DollarSign,
  CheckCircle,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import useAuthStore from "@/store/useAuthStore";
import { getWhistleblowerEarnings, type EarningsResponse } from "@/lib/api/whistleblowerApplications";

export default function WhistleblowerEarningsPage() {
  const { user } = useAuthStore();
  const [earningsData, setEarningsData] = useState<EarningsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEarnings() {
      if (!user?.id) {
        setError("User not authenticated");
        setLoading(false);
        return;
      }

      try {
        const data = await getWhistleblowerEarnings(user.id);
        setEarningsData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load earnings");
      } finally {
        setLoading(false);
      }
    }

    fetchEarnings();
  }, [user?.id]);

  const totalEarnings = earningsData?.totals.totalNgn || 0;
  const completedEarnings = earningsData?.totals.paidNgn || 0;
  const pendingEarnings = earningsData?.totals.pendingNgn || 0;

  // Map backend status to frontend status
  const mapStatus = (status: string): "completed" | "pending" => {
    return status === "paid" ? "completed" : "pending";
  };

  // Format date for display
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-background pt-20">
      <div className="container mx-auto px-4 py-8">
        <Link
          href="/whistleblower/dashboard"
          className="inline-flex items-center gap-2 mb-8 text-sm font-bold border-b-2 border-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>

        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-black mb-2">Your Earnings</h1>
            <p className="text-muted-foreground">
              Track your income from reporting vacant apartments
            </p>
          </div>

          {/* Loading State */}
          {loading && (
            <Card className="border-3 border-foreground p-8 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]">
              <div className="flex items-center justify-center gap-3">
                <div className="h-6 w-6 animate-spin border-3 border-foreground border-t-primary rounded-full" />
                <p className="font-bold">Loading earnings...</p>
              </div>
            </Card>
          )}

          {/* Error State */}
          {error && (
            <Card className="border-3 border-destructive p-8 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-6 w-6 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-destructive mb-1">
                    Failed to Load Earnings
                  </p>
                  <p className="text-sm text-destructive/80">{error}</p>
                </div>
              </div>
            </Card>
          )}

          {/* Content State */}
          {!loading && !error && earningsData && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6 mb-8">
                <Card className="border-3 border-foreground p-4 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] md:p-6">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 items-center justify-center border-3 border-foreground bg-primary md:h-14 md:w-14">
                      <DollarSign className="h-6 w-6 md:h-7 md:w-7" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground md:text-sm">
                        Total Earnings
                      </p>
                      <p className="text-2xl font-black md:text-3xl">
                        ₦{totalEarnings.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="border-3 border-foreground p-4 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] md:p-6">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 items-center justify-center border-3 border-foreground bg-secondary md:h-14 md:w-14">
                      <CheckCircle className="h-6 w-6 md:h-7 md:w-7" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground md:text-sm">
                        Completed
                      </p>
                      <p className="text-2xl font-black md:text-3xl">
                        ₦{completedEarnings.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="border-3 border-foreground p-4 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] md:p-6">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 items-center justify-center border-3 border-foreground bg-accent md:h-14 md:w-14">
                      <Clock className="h-6 w-6 md:h-7 md:w-7" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground md:text-sm">
                        Pending
                      </p>
                      <p className="text-2xl font-black md:text-3xl">
                        ₦{pendingEarnings.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Earnings List */}
              <div>
                <h2 className="font-mono text-lg font-bold mb-4 md:text-xl">
                  Earnings History
                </h2>
                {earningsData.history.length === 0 ? (
                  <Card className="border-3 border-foreground p-8 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]">
                    <div className="text-center">
                      <p className="text-muted-foreground mb-2">No earnings yet</p>
                      <p className="text-sm text-muted-foreground">
                        Start reporting vacant apartments to earn rewards
                      </p>
                    </div>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {earningsData.history.map((earning) => {
                      const status = mapStatus(earning.status);
                      return (
                        <Card
                          key={earning.rewardId}
                          className="border-3 border-foreground p-4 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] md:p-6"
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="flex-1">
                              <p className="font-bold text-sm md:text-base">
                                Reward #{earning.rewardId.slice(0, 8)}...
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Deal: {earning.dealId.slice(0, 8)}... • Posted: {formatDate(earning.createdAt)}
                              </p>
                            </div>

                            <div className="flex items-center justify-between gap-4 pt-3 border-t-2 border-foreground md:border-t-0 md:border-l-2 md:pl-4">
                              <div>
                                <p className="text-lg font-black text-primary md:text-2xl">
                                  ₦{Math.round(earning.amountNgn).toLocaleString()}
                                </p>
                                {status === "pending" ? (
                                  <p className="text-xs text-muted-foreground">
                                    Pending
                                  </p>
                                ) : (
                                  <p className="text-xs text-muted-foreground">
                                    Completed {earning.paidAt ? formatDate(earning.paidAt) : ''}
                                  </p>
                                )}
                              </div>

                              <div
                                className={`flex items-center gap-1 px-3 py-1 border-2 border-foreground font-bold text-xs whitespace-nowrap ${status === "completed" ? "bg-secondary" : "bg-accent"}`}
                              >
                                {status === "completed" ? (
                                  <>
                                    <CheckCircle className="h-4 w-4" />
                                    Completed
                                  </>
                                ) : (
                                  <>
                                    <Clock className="h-4 w-4" />
                                    Pending
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Payment Info */}
          <Card className="border-3 border-foreground p-4 mt-8 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] md:p-6 bg-muted">
            <h3 className="font-bold mb-3">How Payments Work</h3>
            <ul className="text-sm space-y-2 text-muted-foreground">
              <li>
                • Earnings are credited after the tenant's first payment
                (typically 3-5 days after rental confirmation)
              </li>
              <li>• Payments are transferred directly to your bank account</li>
              <li>• You can withdraw anytime (minimum ₦5,000)</li>
              <li>• Transaction fee: 2% of withdrawal amount</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

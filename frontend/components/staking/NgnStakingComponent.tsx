"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowRight, 
  Loader2, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Wallet,
  TrendingUp,
  Info,
  RefreshCw
} from "lucide-react";
import { 
  getStakingQuote, 
  stakeWithNgn, 
  getStakingStatus, 
  getNgnBalance,
  type StakingQuoteResponse,
  type StakeNgnResponse,
  type StakingStatusResponse,
  type NgnBalanceResponse
} from "@/lib/stakingApi";

export function NgnStakingComponent() {
  const [ngnBalance, setNgnBalance] = useState<NgnBalanceResponse | null>(null);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<StakingQuoteResponse | null>(null);
  const [currentStake, setCurrentStake] = useState<StakeNgnResponse | null>(null);
  const [stakeStatus, setStakeStatus] = useState<StakingStatusResponse | null>(null);

  // Load NGN balance on mount
  useEffect(() => {
    loadNgnBalance();
  }, []);

  // Poll for stake status if we have an active stake
  useEffect(() => {
    if (!currentStake?.stakeId) return;

    const interval = setInterval(async () => {
      try {
        const status = await getStakingStatus(currentStake.stakeId);
        setStakeStatus(status);
        
        // Stop polling if completed or failed
        if (status.status === 'receipt_recorded' || status.status === 'failed') {
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Failed to fetch stake status:', err);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [currentStake?.stakeId]);

  const loadNgnBalance = async () => {
    try {
      const balance = await getNgnBalance();
      setNgnBalance(balance);
    } catch (err) {
      console.error('Failed to load NGN balance:', err);
    }
  };

  const handleGetQuote = async () => {
    if (!amount || Number(amount) < 100) {
      setError("Minimum stake amount is 100 NGN");
      return;
    }

    if (ngnBalance && Number(amount) > ngnBalance.availableNgn) {
      setError("Insufficient NGN balance");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const quoteData = await getStakingQuote(Number(amount));
      setQuote(quoteData);
    } catch (err: any) {
      setError(err.message || "Failed to get quote");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmStake = async () => {
    if (!quote) return;

    setLoading(true);
    setError(null);

    try {
      const stakeData = await stakeWithNgn(quote.quoteId);
      setCurrentStake(stakeData);
      setQuote(null); // Clear quote after successful stake
      setAmount(""); // Clear amount input
    } catch (err: any) {
      setError(err.message || "Failed to stake");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number, currency: string = "NGN") => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'receipt_recorded':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'receipt_recorded':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* NGN Balance Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            NGN Wallet Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ngnBalance ? (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Available:</span>
                <span className="font-semibold">{formatCurrency(ngnBalance.availableNgn)}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>On Hold:</span>
                <span>{formatCurrency(ngnBalance.heldNgn)}</span>
              </div>
              <div className="flex justify-between text-sm border-t pt-2">
                <span>Total:</span>
                <span className="font-semibold">{formatCurrency(ngnBalance.totalNgn)}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading balance...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Staking Form */}
      {!currentStake && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Stake NGN
            </CardTitle>
            <CardDescription>
              Convert your NGN to USDC and stake for rewards
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <label htmlFor="amount" className="text-sm font-medium">
                Amount (NGN)
              </label>
              <Input
                id="amount"
                type="number"
                placeholder="Enter amount to stake"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="100"
                max={ngnBalance?.availableNgn || 10000000}
                disabled={loading}
              />
              {ngnBalance && (
                <p className="text-xs text-muted-foreground">
                  Available: {formatCurrency(ngnBalance.availableNgn)}
                </p>
              )}
            </div>

            {!quote ? (
              <Button
                onClick={handleGetQuote}
                disabled={loading || !amount || Number(amount) < 100}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Getting Quote...
                  </>
                ) : (
                  <>
                    Get Quote
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="border rounded-lg p-4 bg-muted/50">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Quote Preview
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Amount:</span>
                      <span>{formatCurrency(quote.amountNgn)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>FX Rate:</span>
                      <span>1 USDC = {quote.fxRate} NGN</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Conversion Fee:</span>
                      <span>{formatCurrency(quote.fees.conversion)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Staking Fee:</span>
                      <span>{formatCurrency(quote.fees.staking)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Fees:</span>
                      <span>{formatCurrency(quote.fees.total)}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t pt-2">
                      <span>Estimated USDC:</span>
                      <span>${quote.totalUsdcAfterFees.toFixed(6)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Expires:</span>
                      <span>{new Date(quote.expiresAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setQuote(null)}
                    disabled={loading}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleConfirmStake}
                    disabled={loading}
                    className="flex-1"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Confirm Stake"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Active Stake Status */}
      {currentStake && stakeStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Staking Status
            </CardTitle>
            <CardDescription>
              Stake ID: {currentStake.stakeId}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge className={getStatusColor(stakeStatus.status)}>
                {getStatusIcon(stakeStatus.status)}
                <span className="ml-1 capitalize">
                  {stakeStatus.status.replace('_', ' ')}
                </span>
              </Badge>
              {stakeStatus.status !== 'receipt_recorded' && stakeStatus.status !== 'failed' && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Updating...
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold">Timeline</h4>
              <div className="space-y-2">
                {stakeStatus.timeline.map((step, index) => (
                  <div key={index} className="flex items-center gap-3 p-2 rounded-lg border">
                    {getStatusIcon(step.status)}
                    <div className="flex-1">
                      <div className="font-medium">{step.step}</div>
                      <div className="text-sm text-muted-foreground">{step.description}</div>
                    </div>
                    {step.timestamp && (
                      <div className="text-xs text-muted-foreground">
                        {new Date(step.timestamp).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {stakeStatus.amountUsdc && (
              <div className="border-t pt-4">
                <div className="flex justify-between">
                  <span>NGN Staked:</span>
                  <span>{formatCurrency(stakeStatus.amountNgn)}</span>
                </div>
                <div className="flex justify-between">
                  <span>USDC Staked:</span>
                  <span>${stakeStatus.amountUsdc.toFixed(6)}</span>
                </div>
              </div>
            )}

            {stakeStatus.status === 'receipt_recorded' && (
              <Button onClick={() => setCurrentStake(null)} className="w-full">
                Stake More
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

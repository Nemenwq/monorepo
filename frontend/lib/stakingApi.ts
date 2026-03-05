import { apiPost, apiFetch } from "./api";

export interface StakingQuoteRequest {
  amountNgn: number;
}

export interface StakingQuoteResponse {
  quoteId: string;
  amountNgn: number;
  estimatedUsdc: number;
  fxRate: number;
  fees: {
    conversion: number;
    staking: number;
    total: number;
  };
  totalUsdcAfterFees: number;
  expiresAt: string;
  createdAt: string;
}

export interface StakeNgnRequest {
  quoteId: string;
}

export interface StakeNgnResponse {
  success: boolean;
  stakeId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  timeline: {
    step: string;
    status: 'pending' | 'completed' | 'failed';
    timestamp: string | null;
    description: string;
  }[];
  amountNgn: number;
  estimatedUsdc: number;
  createdAt: string;
}

export interface StakingStatusResponse {
  stakeId: string;
  status: 'ngn_reserved' | 'conversion_processing' | 'usdc_staked' | 'receipt_recorded' | 'failed';
  timeline: {
    step: string;
    status: 'pending' | 'completed' | 'failed';
    timestamp: string | null;
    description: string;
  }[];
  amountNgn: number;
  amountUsdc: number | null;
  txHash: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface NgnBalanceResponse {
  availableNgn: number;
  heldNgn: number;
  totalNgn: number;
}

export async function getStakingQuote(amountNgn: number): Promise<StakingQuoteResponse> {
  return apiPost<StakingQuoteResponse>("/staking/quote", { amountNgn });
}

export async function stakeWithNgn(quoteId: string): Promise<StakeNgnResponse> {
  return apiPost<StakeNgnResponse>("/staking/stake-ngn", { quoteId });
}

export async function getStakingStatus(stakeId: string): Promise<StakingStatusResponse> {
  return apiFetch<StakingStatusResponse>(`/staking/status/${stakeId}`);
}

export async function getNgnBalance(): Promise<NgnBalanceResponse> {
  return apiFetch<NgnBalanceResponse>("/wallet/ngn/balance");
}

import { apiFetch } from "./api";

export interface PayoutBreakdown {
  totalAmount: number;
  platformShare: number;
  reporterShare: number | null; // null when no reporter
  landlordAmount: number;
  currency: string;
}

export interface FullPaymentPreview {
  paymentId: string;
  breakdown: PayoutBreakdown;
  expiresAt: string;
}

export interface FullPaymentReceipt {
  paymentId: string;
  reference: string;
  breakdown: PayoutBreakdown;
  paidAt: string;
  status: "confirmed";
}

export function getFullPaymentPreview(paymentId: string): Promise<FullPaymentPreview> {
  return apiFetch<FullPaymentPreview>(`/api/payments/${paymentId}/full-payment/preview`);
}

export function confirmFullPayment(paymentId: string): Promise<FullPaymentReceipt> {
  return apiFetch<FullPaymentReceipt>(`/api/payments/${paymentId}/full-payment/confirm`, {
    method: "POST",
  });
}

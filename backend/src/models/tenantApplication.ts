/**
 * Tenant Application Model
 * Represents a tenant's property financing application
 */

export enum TenantApplicationStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  CANCELLED = "cancelled",
}

export interface TenantApplication {
  applicationId: string;
  userId: string;
  propertyId: number;
  propertyTitle?: string;
  propertyLocation?: string;
  annualRent: number;
  deposit: number;
  duration: number;
  totalAmount: number;
  monthlyPayment: number;
  status: TenantApplicationStatus;
  hasAgreedToTerms: boolean;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
}

export interface CreateTenantApplicationData {
  userId: string;
  propertyId: number;
  propertyTitle?: string;
  propertyLocation?: string;
  annualRent: number;
  deposit: number;
  duration: number;
  hasAgreedToTerms: boolean;
}

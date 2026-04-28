/**
 * Whistleblower Application Model
 * Represents a whistleblower signup application for admin review
 */

export enum WhistleblowerApplicationStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
}

export interface WhistleblowerApplication {
  applicationId: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  linkedinProfile: string;
  facebookProfile: string;
  instagramProfile: string;
  status: WhistleblowerApplicationStatus;
  createdAt: Date;
  updatedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  rejectionReason?: string;
  // Social verification metadata
  socialScore?: number;
  greenFlags?: string[];
  redFlags?: string[];
}

export interface CreateWhistleblowerApplicationData {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  linkedinProfile: string;
  facebookProfile: string;
  instagramProfile: string;
}

export interface UpdateWhistleblowerApplicationStatusData {
  status: WhistleblowerApplicationStatus;
  reviewedBy: string;
  rejectionReason?: string;
}

export interface WhistleblowerApplicationFilters {
  status?: WhistleblowerApplicationStatus;
  page?: number;
  pageSize?: number;
}

export interface WhistleblowerApplicationListResult {
  applications: WhistleblowerApplication[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

import { apiFetch } from "../api";

export interface WhistleblowerStats {
  totalEarnings: number;
  reportsThisMonth: number;
  maxReportsPerMonth: number;
  activeListings: number;
  rating: number;
  reviews: number;
}

export interface WhistleblowerListing {
  id: string | number;
  address: string;
  price: number;
  beds: number;
  baths: number;
  status: "active" | "rented" | "pending";
  views: number;
  earnings: number;
  postedDate: string;
}

export interface WhistleblowerEarning {
  date: string;
  listing: string;
  amount: number;
  status: "completed" | "pending";
}

export interface WhistleblowerDashboardData {
  stats: WhistleblowerStats;
  listings: WhistleblowerListing[];
  earnings: WhistleblowerEarning[];
}

export async function getWhistleblowerDashboardData(): Promise<WhistleblowerDashboardData> {
  return apiFetch<WhistleblowerDashboardData>("/api/whistleblower/dashboard");
}

import { apiFetch } from "./api";
import { apiPost } from "./api";

export interface LandlordStat {
  label: string;
  value: string;
  icon: string; // Icon name to be mapped in the component
  color: string;
}

export interface LandlordProperty {
  id: number | string;
  title: string;
  location: string;
  price: number;
  beds: number;
  baths: number;
  sqm: number;
  status: "active" | "pending" | "inactive";
  views: number;
  inquiries: number;
  verificationStatus: "PENDING" | "VERIFIED" | "REJECTED";
  image?: string;
  tenant?: {
    name: string;
    avatar: string;
  } | null;
}

export interface LandlordDashboardData {
  stats: LandlordStat[];
  properties: LandlordProperty[];
}

export const landlordApi = {
  getDashboardData: async (): Promise<LandlordDashboardData> => {
    return apiFetch<LandlordDashboardData>("/api/landlord/dashboard");
  },

  getProperties: async (): Promise<LandlordProperty[]> => {
    return apiFetch<LandlordProperty[]>("/api/landlord/properties");
  },

  getProperty: async (id: string | number): Promise<LandlordProperty> => {
    return apiFetch<LandlordProperty>(`/api/landlord/properties/${id}`);
  },

  getApplications: async (): Promise<any[]> => {
    return apiFetch<any[]>("/api/landlord/applications");
  },

  createProperty: async (payload: unknown): Promise<any> => {
    return apiPost<any>("/api/landlord/properties", payload);
  },
};

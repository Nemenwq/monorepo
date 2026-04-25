export enum WhistleblowerSignupApplicationStatus {
  PENDING = "pending",
}

export interface WhistleblowerSignupApplication {
  applicationId: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  linkedinProfile: string;
  facebookProfile: string;
  instagramProfile: string;
  status: WhistleblowerSignupApplicationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWhistleblowerSignupApplicationData {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  linkedinProfile: string;
  facebookProfile: string;
  instagramProfile: string;
}

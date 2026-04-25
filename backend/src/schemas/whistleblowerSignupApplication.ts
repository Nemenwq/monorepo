import { z } from "zod";

export const createWhistleblowerSignupApplicationSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  phone: z.string().trim().min(7).max(30),
  address: z.string().trim().min(5).max(300),
  linkedinProfile: z.string().trim().url(),
  facebookProfile: z.string().trim().url(),
  instagramProfile: z.string().trim().url(),
});

export type CreateWhistleblowerSignupApplicationRequest = z.infer<
  typeof createWhistleblowerSignupApplicationSchema
>;

import { z } from "zod";

/**
 * Schema for tenant property financing application submission
 */
export const createTenantApplicationSchema = z.object({
  propertyId: z
    .number()
    .int()
    .positive()
    .describe("Property ID from the listing"),
  annualRent: z.number().positive().describe("Annual rent amount in NGN"),
  deposit: z.number().positive().describe("Deposit amount in NGN"),
  duration: z
    .number()
    .int()
    .positive()
    .min(1)
    .max(24)
    .describe("Financing duration in months"),
  hasAgreedToTerms: z
    .boolean()
    .refine((val) => val === true, {
      message: "Must agree to terms and conditions",
    })
    .describe("Terms and conditions agreement"),
  propertyTitle: z.string().optional().describe("Property title for reference"),
  propertyLocation: z
    .string()
    .optional()
    .describe("Property location for reference"),
});

export type CreateTenantApplicationRequest = z.infer<
  typeof createTenantApplicationSchema
>;

export const getTenantApplicationSchema = z.object({
  applicationId: z.string().describe("Application ID"),
});

export type GetTenantApplicationRequest = z.infer<
  typeof getTenantApplicationSchema
>;

export const listTenantApplicationsSchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "cancelled"]).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20).optional(),
  cursor: z.string().optional(),
});

export type ListTenantApplicationsRequest = z.infer<
  typeof listTenantApplicationsSchema
>;

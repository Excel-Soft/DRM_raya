import { z } from "zod";

export const duplicateCheckSchema = z.object({
  companyName: z.string().min(1).max(255).optional(),
  email: z.string().email().max(320).optional(),
  phone: z.string().min(3).max(50).optional(),
  cnic: z.string().min(3).max(50).optional(),
  ntn: z.string().min(1).max(50).optional(),
});

export const createCustomerSchema = z.object({
  companyName: z.string().min(1).max(255),
  country: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  address: z.string().max(500).optional(),
  website: z.string().url().max(500).optional(),
  region: z.string().max(100).optional(),
  lead: z
    .object({
      rcLink: z.string().max(1000).optional(),
      source: z.string().max(200).optional(),
      grade: z.string().max(50).optional(),
      status: z.string().max(50).optional(),
    })
    .optional(),
  primaryContact: z.object({
    title: z.string().max(50).optional(),
    personName: z.string().max(200).optional(),
    accountHolderName: z.string().min(1).max(200),
    cnic: z.string().max(50).optional(),
    ntn: z.string().max(50).optional(),
    email: z.string().email().max(320),
    phone: z.string().max(50).optional(),
  }),
  forceCreate: z.boolean().optional().default(false),
});

export const listCustomersQuerySchema = z.object({
  search: z.string().max(255).optional(),
  status: z.string().max(50).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});


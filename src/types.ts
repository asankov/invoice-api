import type { Context } from "hono";
import { z } from "zod";

export type AppContext = Context<{ Bindings: Env }>;

export const Task = z.object({
	name: z.string().openapi({ example: "lorem" }),
	slug: z.string(),
	description: z.string().optional(),
	completed: z.boolean().default(false),
	due_date: z.iso.date(),
});

// User-supplied translations; identifiers, quantities and money are shared.
export const BilingualText = z.object({
  bg: z.string().trim().min(1),
  en: z.string().trim().min(1),
});

export const BilingualAddress = z.object({
  bg: BilingualText.shape.bg.nullish(),
  en: BilingualText.shape.en.nullish(),
});

export const Customer = z.object({
  name: BilingualText,
  address: BilingualAddress.optional(),
  number: z.string().optional(),
});

// PATCH may update one translation without replacing the other.
export const CustomerPatch = z.object({
  name: BilingualText.partial().refine(value => Object.keys(value).length > 0).optional(),
  address: BilingualAddress.refine(value => Object.keys(value).length > 0).optional(),
  number: z.string().optional(),
}).refine(value => Object.keys(value).length > 0);

export const InvoiceItemInput = z.object({
  description: BilingualText,
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
});

// Placeholder models for the dummy endpoints. Replace with domain models later.
export const InvoiceInput = z.object({
  customerId: z.string(),
  total: z.number().nonnegative(),
  items: z.array(InvoiceItemInput).min(1),
});

export const Invoice = InvoiceInput.extend({
  id: z.string(),
  status: z.enum(["draft", "issued", "paid"]),
});

export const PaymentInput = z.object({
  amount: z.number().positive(),
});

export const Payment = PaymentInput.extend({
  id: z.string(),
  invoiceId: z.string(),
});

export const Settings = z.object({
  companyName: BilingualText,
  companyAddress: BilingualAddress.optional(),
  companyNumber: z.string().optional(),
  currency: z.string(),
});

export const Dashboard = z.object({
  customerCount: z.number(),
  invoiceCount: z.number(),
  outstandingTotal: z.number(),
});

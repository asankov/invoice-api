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

export const Customer = z.object({
  name: z.string(),
  address: z.string(),
  number: z.string().optional(),
})

// Placeholder models for the dummy endpoints. Replace with domain models later.
export const InvoiceInput = z.object({
  customerId: z.string(),
  total: z.number().nonnegative(),
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
  companyName: z.string(),
  currency: z.string(),
});

export const Dashboard = z.object({
  customerCount: z.number(),
  invoiceCount: z.number(),
  outstandingTotal: z.number(),
});

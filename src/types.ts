import type { Context } from "hono";
import { z } from "zod";

export type AppContext = Context<{ Bindings: Env }>;
export const MAX_MINOR = 1_000_000_000_000;
export const Money = z.number().min(0).max(MAX_MINOR / 100).refine(
  value => Number(value.toFixed(2)) === value,
  "Amounts must have at most two decimal places",
);
const Text = z.string().trim().min(1).max(2000);
export const BilingualText = z.object({ bg: Text, en: Text });
export const BilingualAddress = z.object({ bg: Text.nullish(), en: Text.nullish() });
export const CustomerInput = z.object({
  name: BilingualText,
  address: BilingualAddress.optional(),
  number: z.string().trim().max(200).nullish(),
});
export const Customer = CustomerInput.extend({
  id: z.string(), createdAt: z.string(), updatedAt: z.string(),
});
export const CustomerPatch = z.object({
  name: BilingualText.partial().refine(value => Object.keys(value).length > 0).optional(),
  address: BilingualAddress.refine(value => Object.keys(value).length > 0).optional(),
  number: CustomerInput.shape.number,
}).refine(value => Object.keys(value).length > 0, "Provide at least one field");
export const InvoiceItemInput = z.object({
  description: BilingualText,
  quantity: z.number().min(0.000001).max(1_000_000).refine(
    value => Number(value.toFixed(6)) === value,
    "Quantity must have at most six decimal places",
  ),
  unitPrice: Money,
  taxRate: z.number().min(0).max(100).multipleOf(0.01).default(0),
});
export const InvoiceInput = z.object({
  customerId: z.string().min(1),
  // Accepted for existing clients, but verified against server-calculated totals.
  total: Money.optional(),
  items: z.array(InvoiceItemInput).min(1).max(100),
  dueDate: z.iso.date().nullish(),
  notes: z.string().max(10000).nullish(),
});
export const InvoicePatch = InvoiceInput.partial().refine(
  value => Object.keys(value).length > 0, "Provide at least one field",
);
export const InvoiceItem = InvoiceItemInput.extend({
  id: z.string(), position: z.number().int(), subtotal: Money, tax: Money, total: Money,
});
const PartySnapshot = z.object({
  name: BilingualText, address: BilingualAddress, number: z.string().nullable(),
});
export const Invoice = z.object({
  id: z.string(), customerId: z.string(), status: z.enum(["draft", "issued", "paid"]),
  invoiceNumber: z.string().nullable(), currency: z.string(),
  issueDate: z.string().nullable(), dueDate: z.string().nullable(), notes: z.string().nullable(),
  subtotal: Money, tax: Money, total: Money, paidTotal: Money, outstandingTotal: Money,
  items: z.array(InvoiceItem),
  customer: PartySnapshot.nullable(), company: PartySnapshot.nullable(),
  createdAt: z.string(), updatedAt: z.string(), revision: z.number().int(),
});
export const PaymentInput = z.object({
  amount: Money.refine(value => value > 0, "Amount must be positive"),
  paidAt: z.iso.datetime().optional(),
  reference: z.string().trim().max(500).nullish(),
});
export const Payment = PaymentInput.extend({
  id: z.string(), invoiceId: z.string(), paidAt: z.string(),
  reference: z.string().nullable(), createdAt: z.string(),
});
export const Settings = z.object({
  companyName: BilingualText,
  companyAddress: BilingualAddress.optional(),
  companyNumber: z.string().trim().max(200).nullish(),
  currency: z.string().regex(/^[A-Z]{3}$/, "Use a three-letter uppercase currency code"),
});
export const Dashboard = z.object({
  customerCount: z.number(), invoiceCount: z.number(), outstandingTotal: z.number(),
  // Never sum amounts in different currencies into one figure.
  currency: z.string().nullable(),
  outstandingByCurrency: z.array(z.object({ currency: z.string(), outstandingTotal: z.number() })),
});
export const IdParams = z.object({ id: z.string().min(1) });
export const ListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export const ErrorResponse = z.object({ error: z.string() });
const ValidationErrorResponse = z.object({
  success: z.literal(false),
  errors: z.array(z.object({ message: z.string() }).passthrough()),
}).passthrough();
export const ErrorResponses = Object.fromEntries(
  [400, 404, 409, 422, 500].map(status => [String(status), {
    description: "Request failed",
    content: { "application/json": { schema: status === 400 || status === 422
      ? z.union([ErrorResponse, ValidationErrorResponse]) : ErrorResponse } },
  }]),
);

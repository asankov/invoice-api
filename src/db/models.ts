/**
 * D1 row models matching migrations/0001_initial_schema.sql.
 * IDs are application-generated UUIDs. Amounts are integer minor units.
 * Dates are YYYY-MM-DD; timestamps are UTC SQLite datetime strings.
 * These storage models are separate from the API's placeholder Zod schemas.
 */
interface Timestamps {
  created_at: string;
  updated_at: string;
}

export interface CustomerRow extends Timestamps {
  id: string;
  name: string;
  address: string;
  number: string | null;
}

export interface SettingsRow extends Timestamps {
  id: 1;
  company_name: string;
  company_address: string;
  company_number: string | null;
  currency: string;
}

export type InvoiceStatus = 'draft' | 'issued' | 'paid';

export interface InvoiceRow extends Timestamps {
  id: string;
  customer_id: string;
  invoice_number: string | null;
  status: InvoiceStatus;
  currency: string;
  issue_date: string | null;
  due_date: string | null;
  subtotal_minor: number;
  tax_minor: number;
  total_minor: number;
  notes: string | null;
  customer_name: string | null;
  customer_address: string | null;
  customer_number: string | null;
  company_name: string | null;
  company_address: string | null;
  company_number: string | null;
}

export interface InvoiceItemRow extends Timestamps {
  id: string;
  invoice_id: string;
  position: number;
  description: string;
  quantity: number;
  unit_price_minor: number;
  subtotal_minor: number;
  tax_minor: number;
  total_minor: number;
}

export interface PaymentRow {
  id: string;
  invoice_id: string;
  amount_minor: number;
  paid_at: string;
  reference: string | null;
  created_at: string;
}

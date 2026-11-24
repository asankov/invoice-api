/**
 * D1 row models matching the complete migrations/ schema.
 * IDs are application-generated UUIDs. Amounts are integer minor units.
 * Dates are YYYY-MM-DD; timestamps are UTC SQLite datetime strings.
 * API schemas use camelCase and convert money to major units.
 */
interface Timestamps {
  created_at: string;
  updated_at: string;
}

export interface ProductRow extends Timestamps {
  id: string;
  name_bg: string;
  name_en: string;
  price_minor: number;
  currency: 'USD' | 'EUR';
}

export interface CustomerRow extends Timestamps {
  id: string;
  name_bg: string;
  name_en: string;
  address_bg: string | null;
  address_en: string | null;
  number: string | null;
}

export interface SettingsRow extends Timestamps {
  id: 1;
  company_name_bg: string;
  company_name_en: string;
  company_address_bg: string | null;
  company_address_en: string | null;
  company_number: string | null;
  currency: string;
}

export type InvoiceStatus = 'draft' | 'issued' | 'paid';

export interface InvoiceRow extends Timestamps {
  id: string;
  customer_id: string;
  revision: number;
  mutation_token: string | null;
  invoice_number: string | null;
  status: InvoiceStatus;
  currency: string;
  issue_date: string | null;
  due_date: string | null;
  subtotal_minor: number;
  tax_minor: number;
  total_minor: number;
  notes: string | null;
  customer_name_bg: string | null;
  customer_name_en: string | null;
  customer_address_bg: string | null;
  customer_address_en: string | null;
  customer_number: string | null;
  company_name_bg: string | null;
  company_name_en: string | null;
  company_address_bg: string | null;
  company_address_en: string | null;
  company_number: string | null;
}

export interface InvoiceItemRow extends Timestamps {
  id: string;
  invoice_id: string;
  product_id: string | null;
  currency: string;
  position: number;
  description_bg: string;
  description_en: string;
  quantity: number;
  unit_price_minor: number;
  tax_rate: number;
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

import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import {
  MAX_MINOR,
  type CustomerInput,
  type CustomerPatch,
  type InvoiceItemInput,
  type InvoiceInput,
  type InvoicePatch,
  type InvoiceProductInput,
  type PaymentInput,
  type Settings,
} from '../types';
import type {
  CustomerRow,
  SettingsRow,
  InvoiceRow,
  InvoiceItemRow,
  PaymentRow,
  ProductRow,
} from './models';
import { fail } from './errors';

type InvoiceWithPaid = InvoiceRow & { paid_minor: number };
type SnapshotItem = z.infer<typeof InvoiceItemInput> & {
  productId: string | null;
  currency: string;
};
const minor = (value: number) => Math.round(value * 100);
const major = (value: number) => value / 100;
const customerResult = (r: CustomerRow) => ({
  id: r.id,
  name: { bg: r.name_bg, en: r.name_en },
  address: { bg: r.address_bg, en: r.address_en },
  number: r.number,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
const settingsResult = (r: SettingsRow) => ({
  companyName: { bg: r.company_name_bg, en: r.company_name_en },
  companyAddress: { bg: r.company_address_bg, en: r.company_address_en },
  companyNumber: r.company_number,
  currency: r.currency,
});
const paymentResult = (r: PaymentRow) => ({
  id: r.id,
  invoiceId: r.invoice_id,
  amount: major(r.amount_minor),
  paidAt: r.paid_at,
  reference: r.reference,
  createdAt: r.created_at,
});
function invoiceResult(r: InvoiceWithPaid, items: InvoiceItemRow[]) {
  return {
    id: r.id,
    customerId: r.customer_id,
    status: r.status,
    invoiceNumber: r.invoice_number,
    currency: r.currency,
    issueDate: r.issue_date,
    dueDate: r.due_date,
    notes: r.notes,
    subtotal: major(r.subtotal_minor),
    tax: major(r.tax_minor),
    total: major(r.total_minor),
    paidTotal: major(r.paid_minor),
    outstandingTotal: major(r.total_minor - r.paid_minor),
    revision: r.revision,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    customer:
      r.customer_name_bg === null
        ? null
        : {
            name: { bg: r.customer_name_bg, en: r.customer_name_en! },
            address: { bg: r.customer_address_bg, en: r.customer_address_en },
            number: r.customer_number,
          },
    company:
      r.company_name_bg === null
        ? null
        : {
            name: { bg: r.company_name_bg, en: r.company_name_en! },
            address: { bg: r.company_address_bg, en: r.company_address_en },
            number: r.company_number,
          },
    items: items.map((item) => ({
      id: item.id,
      position: item.position,
      description: { bg: item.description_bg, en: item.description_en },
      productId: item.product_id,
      currency: item.currency,
      quantity: item.quantity,
      unitPrice: major(item.unit_price_minor),
      taxRate: item.tax_rate,
      subtotal: major(item.subtotal_minor),
      tax: major(item.tax_minor),
      total: major(item.total_minor),
    })),
    products: items.map((item) => ({
      id: item.id,
      productId: item.product_id,
      position: item.position,
      name: { bg: item.description_bg, en: item.description_en },
      price: major(item.unit_price_minor),
      currency: item.currency,
      quantity: item.quantity,
      taxRate: item.tax_rate,
      subtotal: major(item.subtotal_minor),
      tax: major(item.tax_minor),
      total: major(item.total_minor),
    })),
  };
}
const invoiceSelect = `SELECT i.*, COALESCE((SELECT SUM(amount_minor) FROM payments p WHERE p.invoice_id = i.id), 0) AS paid_minor FROM invoices i`;

export async function listCustomers(db: D1Database, limit: number, offset: number) {
  const [rows, count] = await db.batch<Record<string, unknown>>([
    db
      .prepare('SELECT * FROM customers ORDER BY created_at DESC, id LIMIT ? OFFSET ?')
      .bind(limit, offset),
    db.prepare('SELECT COUNT(*) AS total FROM customers'),
  ]);
  return {
    customers: (rows!.results as unknown as CustomerRow[]).map(customerResult),
    total: Number(count!.results[0]!.total),
    limit,
    offset,
  };
}
export async function createCustomer(db: D1Database, input: z.infer<typeof CustomerInput>) {
  const row = await db
    .prepare(
      `INSERT INTO customers (id, name_bg, name_en, address_bg, address_en, number)
    VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
    )
    .bind(
      crypto.randomUUID(),
      input.name.bg,
      input.name.en,
      input.address?.bg ?? null,
      input.address?.en ?? null,
      input.number ?? null,
    )
    .first<CustomerRow>();
  return customerResult(row!);
}
export async function editCustomer(
  db: D1Database,
  id: string,
  input: z.infer<typeof CustomerPatch>,
) {
  const values: (string | null)[] = [];
  const fields: string[] = [];
  const set = (column: string, value: string | null | undefined) => {
    if (value !== undefined) {
      fields.push(`${column} = ?`);
      values.push(value);
    }
  };
  set('name_bg', input.name?.bg);
  set('name_en', input.name?.en);
  set('address_bg', input.address?.bg);
  set('address_en', input.address?.en);
  set('number', input.number);
  const row = await db
    .prepare(
      `UPDATE customers SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *`,
    )
    .bind(...values, id)
    .first<CustomerRow>();
  if (!row) {
    fail(404, 'Customer not found');
  }
  return customerResult(row);
}
export async function getSettings(db: D1Database) {
  const row = await db.prepare('SELECT * FROM settings WHERE id = 1').first<SettingsRow>();
  if (!row) {
    fail(404, 'Company settings have not been configured');
  }
  return settingsResult(row);
}
export async function updateSettings(db: D1Database, input: z.infer<typeof Settings>) {
  const row = await db
    .prepare(
      `INSERT INTO settings
    (id, company_name_bg, company_name_en, company_address_bg, company_address_en, company_number, currency)
    VALUES (1, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET
    company_name_bg = excluded.company_name_bg, company_name_en = excluded.company_name_en,
    company_address_bg = excluded.company_address_bg, company_address_en = excluded.company_address_en,
    company_number = excluded.company_number, currency = excluded.currency, updated_at = CURRENT_TIMESTAMP RETURNING *`,
    )
    .bind(
      input.companyName.bg,
      input.companyName.en,
      input.companyAddress?.bg ?? null,
      input.companyAddress?.en ?? null,
      input.companyNumber ?? null,
      input.currency,
    )
    .first<SettingsRow>();
  return settingsResult(row!);
}
export async function getInvoice(db: D1Database, id: string) {
  const [invoices, items] = await db.batch<Record<string, unknown>>([
    db.prepare(`${invoiceSelect} WHERE i.id = ?`).bind(id),
    db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY position').bind(id),
  ]);
  const invoice = invoices!.results[0] as unknown as InvoiceWithPaid | undefined;
  if (!invoice) {
    fail(404, 'Invoice not found');
  }
  return invoiceResult(invoice, items!.results as unknown as InvoiceItemRow[]);
}
export async function listInvoices(db: D1Database, limit: number, offset: number) {
  const [invoices, items, count] = await db.batch<Record<string, unknown>>([
    db
      .prepare(`${invoiceSelect} ORDER BY i.created_at DESC, i.id LIMIT ? OFFSET ?`)
      .bind(limit, offset),
    db
      .prepare(
        `SELECT * FROM invoice_items WHERE invoice_id IN
      (SELECT id FROM invoices ORDER BY created_at DESC, id LIMIT ? OFFSET ?) ORDER BY invoice_id, position`,
      )
      .bind(limit, offset),
    db.prepare('SELECT COUNT(*) AS total FROM invoices'),
  ]);
  const grouped = new Map<string, InvoiceItemRow[]>();
  for (const item of items!.results as unknown as InvoiceItemRow[]) {
    if (!grouped.has(item.invoice_id)) {
      grouped.set(item.invoice_id, []);
    }
    grouped.get(item.invoice_id)!.push(item);
  }
  return {
    invoices: (invoices!.results as unknown as InvoiceWithPaid[]).map((r) =>
      invoiceResult(r, grouped.get(r.id) ?? []),
    ),
    total: Number(count!.results[0]!.total),
    limit,
    offset,
  };
}
async function resolveProducts(
  db: D1Database,
  selections: z.infer<typeof InvoiceProductInput>[],
): Promise<SnapshotItem[]> {
  // One query gives all selected products a consistent catalog snapshot, even if
  // catalog entries are edited concurrently. Stored invoice rows never join back.
  const { results } = await db
    .prepare('SELECT * FROM products WHERE id IN (SELECT value FROM json_each(?))')
    .bind(JSON.stringify(selections.map((selection) => selection.productId)))
    .all<ProductRow>();
  const products = new Map(results.map((product) => [product.id, product]));
  const items = selections.map((selection) => {
    const product = products.get(selection.productId);
    if (!product) {
      fail(404, `Product not found: ${selection.productId}`);
    }
    return {
      productId: product.id,
      description: { bg: product.name_bg, en: product.name_en },
      unitPrice: major(product.price_minor),
      currency: product.currency,
      quantity: selection.quantity,
      taxRate: selection.taxRate,
    };
  });
  if (new Set(items.map((item) => item.currency)).size !== 1) {
    fail(400, 'All invoice products must use the same currency');
  }
  return items;
}
function calculate(items: SnapshotItem[], expectedTotal?: number) {
  const lines = items.map((item) => {
    const unitPrice = minor(item.unitPrice);
    const quantity = BigInt(Math.round(item.quantity * 1_000_000));
    const subtotal = Number((quantity * BigInt(unitPrice) + 500_000n) / 1_000_000n);
    const tax = Number(
      (BigInt(subtotal) * BigInt(Math.round(item.taxRate * 100)) + 5000n) / 10000n,
    );
    if (!Number.isSafeInteger(subtotal + tax) || subtotal + tax > MAX_MINOR) {
      fail(400, 'Line amount is too large');
    }
    return { ...item, id: crypto.randomUUID(), unitPrice, subtotal, tax, total: subtotal + tax };
  });
  const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0);
  const tax = lines.reduce((sum, line) => sum + line.tax, 0);
  const total = subtotal + tax;
  if (!Number.isSafeInteger(total) || total > MAX_MINOR) {
    fail(400, 'Invoice total is too large');
  }
  if (expectedTotal !== undefined && minor(expectedTotal) !== total) {
    fail(400, 'Total does not match the calculated line amounts');
  }
  return { lines, subtotal, tax, total };
}
function itemStatements(
  db: D1Database,
  id: string,
  token: string,
  lines: ReturnType<typeof calculate>['lines'],
) {
  return lines.map((line, position) =>
    db
      .prepare(
        `INSERT INTO invoice_items
    (id, invoice_id, position, description_bg, description_en, quantity, unit_price_minor, tax_rate, subtotal_minor, tax_minor, total_minor, product_id, currency)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS
    (SELECT 1 FROM invoices WHERE id = ? AND mutation_token = ? AND status = 'draft')`,
      )
      .bind(
        line.id,
        id,
        position,
        line.description.bg,
        line.description.en,
        line.quantity,
        line.unitPrice,
        line.taxRate,
        line.subtotal,
        line.tax,
        line.total,
        line.productId,
        line.currency,
        id,
        token,
      ),
  );
}
export async function createInvoice(db: D1Database, input: z.infer<typeof InvoiceInput>) {
  const settings = await getSettings(db).catch((error) => {
    if (error instanceof HTTPException && error.status === 404) {
      fail(409, 'Configure company settings before creating invoices');
    }
    throw error;
  });
  const items = input.products
    ? await resolveProducts(db, input.products)
    : input.items!.map((item) => ({
        ...item,
        productId: null,
        currency: settings.currency,
      }));
  const amounts = calculate(items, input.total);
  if (!(await db.prepare('SELECT id FROM customers WHERE id = ?').bind(input.customerId).first())) {
    fail(404, 'Customer not found');
  }
  const id = crypto.randomUUID();
  const token = crypto.randomUUID();
  await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `INSERT INTO invoices (id, customer_id, currency, due_date, notes, subtotal_minor, tax_minor, total_minor, mutation_token)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        input.customerId,
        items[0]!.currency,
        input.dueDate ?? null,
        input.notes ?? null,
        amounts.subtotal,
        amounts.tax,
        amounts.total,
        token,
      ),
    ...itemStatements(db, id, token, amounts.lines),
  ]);
  return getInvoice(db, id);
}
export async function editInvoice(db: D1Database, id: string, input: z.infer<typeof InvoicePatch>) {
  const current = await getInvoice(db, id);
  if (current.status !== 'draft') {
    fail(409, 'Only draft invoices can be edited');
  }
  if (
    input.customerId &&
    !(await db.prepare('SELECT id FROM customers WHERE id = ?').bind(input.customerId).first())
  ) {
    fail(404, 'Customer not found');
  }
  const items = input.products
    ? await resolveProducts(db, input.products)
    : input.items
      ? input.items.map((item) => ({ ...item, productId: null, currency: current.currency }))
      : current.items;
  const amounts = calculate(items, input.total);
  const token = crypto.randomUUID();
  const statements = [
    db
      .prepare(
        `UPDATE invoices SET customer_id = ?, due_date = ?, notes = ?, currency = ?,
    subtotal_minor = ?, tax_minor = ?, total_minor = ?, mutation_token = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'draft' AND revision = ?`,
      )
      .bind(
        input.customerId ?? current.customerId,
        input.dueDate === undefined ? current.dueDate : input.dueDate,
        input.notes === undefined ? current.notes : input.notes,
        items[0]!.currency,
        amounts.subtotal,
        amounts.tax,
        amounts.total,
        token,
        id,
        current.revision,
      ),
  ];
  if (input.items || input.products) {
    statements.push(
      db
        .prepare(
          `DELETE FROM invoice_items WHERE invoice_id = ? AND EXISTS
      (SELECT 1 FROM invoices WHERE id = ? AND mutation_token = ? AND status = 'draft')`,
        )
        .bind(id, id, token),
    );
    statements.push(...itemStatements(db, id, token, amounts.lines));
  }
  const result = await db.batch<Record<string, unknown>>(statements);
  if (!result[0]!.meta.changes) {
    fail(409, 'Invoice changed during this request; reload and retry');
  }
  return getInvoice(db, id);
}
export async function issueInvoice(db: D1Database, id: string) {
  // Both statements share a transaction. The conditional increment is skipped on retries.
  const eligible = `EXISTS (SELECT 1 FROM invoices WHERE id = ? AND status = 'draft')
    AND EXISTS (SELECT 1 FROM settings WHERE id = 1)
    AND EXISTS (SELECT 1 FROM invoice_items WHERE invoice_id = ?)`;
  const result = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `UPDATE invoice_sequence SET next_number = next_number + 1 WHERE id = 1 AND ${eligible}`,
      )
      .bind(id, id),
    db
      .prepare(
        `UPDATE invoices SET
      invoice_number = printf('%010d', (SELECT next_number - 1 FROM invoice_sequence WHERE id = 1)),
      issue_date = date('now'), status = CASE WHEN total_minor = 0 THEN 'paid' ELSE 'issued' END,
      customer_name_bg = (SELECT name_bg FROM customers WHERE id = customer_id),
      customer_name_en = (SELECT name_en FROM customers WHERE id = customer_id),
      customer_address_bg = (SELECT address_bg FROM customers WHERE id = customer_id),
      customer_address_en = (SELECT address_en FROM customers WHERE id = customer_id),
      customer_number = (SELECT number FROM customers WHERE id = customer_id),
      company_name_bg = (SELECT company_name_bg FROM settings WHERE id = 1),
      company_name_en = (SELECT company_name_en FROM settings WHERE id = 1),
      company_address_bg = (SELECT company_address_bg FROM settings WHERE id = 1),
      company_address_en = (SELECT company_address_en FROM settings WHERE id = 1),
      company_number = (SELECT company_number FROM settings WHERE id = 1),
      revision = revision + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'draft'
        AND EXISTS (SELECT 1 FROM settings WHERE id = 1)
        AND EXISTS (SELECT 1 FROM invoice_items WHERE invoice_id = ?)`,
      )
      .bind(id, id),
  ]);
  if (!result[1]!.meta.changes) {
    await getInvoice(db, id); // Distinguish nonexistent IDs from workflow conflicts.
    fail(409, 'Invoice must be a draft with items and company settings to be issued');
  }
  return getInvoice(db, id);
}
export async function createPayment(
  db: D1Database,
  id: string,
  input: z.infer<typeof PaymentInput>,
) {
  const paymentId = crypto.randomUUID();
  const paidAt = (input.paidAt ? new Date(input.paidAt) : new Date())
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19);
  const result = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `INSERT INTO payments (id, invoice_id, amount_minor, paid_at, reference)
      SELECT ?, id, ?, ?, ? FROM invoices WHERE id = ? AND status = 'issued'
      AND ? <= total_minor - COALESCE((SELECT SUM(amount_minor) FROM payments WHERE invoice_id = ?), 0)`,
      )
      .bind(
        paymentId,
        minor(input.amount),
        paidAt,
        input.reference ?? null,
        id,
        minor(input.amount),
        id,
      ),
    db
      .prepare(
        `UPDATE invoices SET status = CASE WHEN total_minor =
      COALESCE((SELECT SUM(amount_minor) FROM payments WHERE invoice_id = ?), 0) THEN 'paid' ELSE 'issued' END,
      revision = revision + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'issued' AND EXISTS (SELECT 1 FROM payments WHERE id = ?)`,
      )
      .bind(id, id, paymentId),
    db.prepare('SELECT * FROM payments WHERE id = ?').bind(paymentId),
  ]);
  if (!result[0]!.meta.changes) {
    await getInvoice(db, id);
    fail(409, 'Payments require an issued invoice and cannot exceed its outstanding balance');
  }
  return paymentResult(result[2]!.results[0] as unknown as PaymentRow);
}
export async function getPayments(db: D1Database, id: string) {
  const [invoice, payments] = await db.batch<Record<string, unknown>>([
    db.prepare('SELECT id FROM invoices WHERE id = ?').bind(id),
    db
      .prepare('SELECT * FROM payments WHERE invoice_id = ? ORDER BY paid_at, created_at, id')
      .bind(id),
  ]);
  if (!invoice!.results.length) {
    fail(404, 'Invoice not found');
  }
  return (payments!.results as unknown as PaymentRow[]).map(paymentResult);
}
export async function getDashboard(db: D1Database) {
  const [counts, totals, settings] = await db.batch<Record<string, unknown>>([
    db.prepare(
      'SELECT (SELECT COUNT(*) FROM customers) AS customerCount, (SELECT COUNT(*) FROM invoices) AS invoiceCount',
    ),
    db.prepare(`SELECT currency, SUM(total_minor - COALESCE(
      (SELECT SUM(amount_minor) FROM payments WHERE invoice_id = invoices.id), 0)) AS outstanding_minor
      FROM invoices WHERE status = 'issued' GROUP BY currency ORDER BY currency`),
    db.prepare('SELECT currency FROM settings WHERE id = 1'),
  ]);
  const currency = settings!.results[0]?.currency as string | undefined;
  const outstandingByCurrency = totals!.results.map((row) => ({
    currency: String(row.currency),
    outstandingTotal: major(Number(row.outstanding_minor)),
  }));
  return {
    customerCount: Number(counts!.results[0]!.customerCount),
    invoiceCount: Number(counts!.results[0]!.invoiceCount),
    currency: currency ?? null,
    outstandingTotal:
      outstandingByCurrency.find((row) => row.currency === currency)?.outstandingTotal ?? 0,
    outstandingByCurrency,
  };
}

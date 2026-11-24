import type { z } from 'zod';
import type { ProductInput, ProductPatch } from '../types';
import type { ProductRow } from './models';
import { fail } from './errors';

function productResult(row: ProductRow) {
  return {
    id: row.id,
    name: { bg: row.name_bg, en: row.name_en },
    price: row.price_minor / 100,
    currency: row.currency,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listProducts(db: D1Database, limit: number, offset: number) {
  const [rows, count] = await db.batch<Record<string, unknown>>([
    db
      .prepare('SELECT * FROM products ORDER BY created_at DESC, id LIMIT ? OFFSET ?')
      .bind(limit, offset),
    db.prepare('SELECT COUNT(*) AS total FROM products'),
  ]);
  return {
    products: (rows!.results as unknown as ProductRow[]).map(productResult),
    total: Number(count!.results[0]!.total),
    limit,
    offset,
  };
}

export async function getProduct(db: D1Database, id: string) {
  const row = await db.prepare('SELECT * FROM products WHERE id = ?').bind(id).first<ProductRow>();
  if (!row) {
    fail(404, 'Product not found');
  }
  return productResult(row);
}

export async function createProduct(db: D1Database, input: z.infer<typeof ProductInput>) {
  const row = await db
    .prepare(
      `INSERT INTO products (id, name_bg, name_en, price_minor, currency)
    VALUES (?, ?, ?, ?, ?) RETURNING *`,
    )
    .bind(
      crypto.randomUUID(),
      input.name.bg,
      input.name.en,
      Math.round(input.price * 100),
      input.currency,
    )
    .first<ProductRow>();
  return productResult(row!);
}

export async function editProduct(db: D1Database, id: string, input: z.infer<typeof ProductPatch>) {
  const fields: string[] = [];
  const values: (string | number)[] = [];
  const set = (column: string, value: string | number | undefined) => {
    if (value !== undefined) {
      fields.push(`${column} = ?`);
      values.push(value);
    }
  };
  set('name_bg', input.name?.bg);
  set('name_en', input.name?.en);
  set('price_minor', input.price === undefined ? undefined : Math.round(input.price * 100));
  set('currency', input.currency);
  const row = await db
    .prepare(
      `UPDATE products SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? RETURNING *`,
    )
    .bind(...values, id)
    .first<ProductRow>();
  if (!row) {
    fail(404, 'Product not found');
  }
  return productResult(row);
}

export async function deleteProduct(db: D1Database, id: string) {
  const result = await db.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
  if (!result.meta.changes) {
    fail(404, 'Product not found');
  }
}

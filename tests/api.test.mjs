import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { build } from 'esbuild';
import { Miniflare, Log, LogLevel } from 'miniflare';

let mf, db;
const text = { bg: 'Консултация', en: 'Consulting' };
const settings = { companyName: { bg: 'Примерна фирма', en: 'Example Company' }, currency: 'EUR' };
const line = (unitPrice = 10, quantity = 1, taxRate = 0) => ({
  description: text,
  unitPrice,
  quantity,
  taxRate,
});
async function request(path, method = 'GET', body, expected = 200) {
  const response = await mf.dispatchFetch(`http://localhost${path}`, {
    method,
    ...(body === undefined
      ? {}
      : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  const data = response.status === 204 ? null : await response.json();
  assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(data)}`);
  return data;
}
async function customer() {
  return (await request('/api/customers', 'POST', { name: { bg: 'Клиент', en: 'Customer' } }, 201))
    .customer;
}
async function invoice(customerId, items = [line()], extra = {}) {
  return (await request('/api/invoices', 'POST', { customerId, items, ...extra }, 201)).invoice;
}
async function reset() {
  await db.batch(
    ['payments', 'invoice_items', 'invoices', 'customers', 'settings', 'products'].map((table) =>
      db.prepare(`DELETE FROM ${table}`),
    ),
  );
  await db.prepare('UPDATE invoice_sequence SET next_number = 1').run();
}
before(async () => {
  const bundle = await build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: 'es2024',
  });
  mf = new Miniflare({
    workers: [
      {
        config: {
          name: 'api-test',
          compatibilityDate: '2026-11-04',
          access: { dev: { aud: 'invoice-api-test', identity: { email: 'test@example.invalid' } } },
          manifest: {
            mainModule: 'index.js',
            modules: { 'index.js': { type: 'esm', contents: bundle.outputFiles[0].text } },
          },
          env: { invoicer: { type: 'd1', id: 'test-invoices' } },
        },
      },
    ],
    log: new Log(LogLevel.ERROR),
  });
  db = await mf.getD1Database('invoicer');
  for (const file of (await readdir('migrations')).filter((file) => file.endsWith('.sql')).sort()) {
    // Migrations contain plain SQL statements (no triggers or semicolons in strings).
    const sql = (await readFile(`migrations/${file}`, 'utf8')).replace(/--[^\n]*/g, '');
    await db.batch(
      sql
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((sql) => db.prepare(sql)),
    );
  }
});
after(async () => {
  if (mf) await mf.dispose();
});

test('empty database, settings upsert, and deferred PDF', async () => {
  await reset();
  assert.deepEqual((await request('/api/customers')).customers, []);
  assert.deepEqual((await request('/api/invoices')).invoices, []);
  assert.equal((await request('/api/dashboard')).dashboard.outstandingTotal, 0);
  await request('/api/settings', 'GET', undefined, 404);
  const c = await customer();
  await request('/api/invoices', 'POST', { customerId: c.id, items: [line()] }, 409);
  assert.deepEqual(
    (await request('/api/settings', 'PUT', settings)).settings.companyName,
    settings.companyName,
  );
  assert.equal((await request('/api/settings')).settings.companyAddress.en, null);
  const updated = { ...settings, companyAddress: { bg: 'София', en: null }, companyNumber: '123' };
  await request('/api/settings', 'PUT', updated);
  assert.deepEqual((await request('/api/settings')).settings, updated);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM settings').first()).n, 1);
  await request('/api/invoices/any/pdf', 'GET', undefined, 501);
});

test('customer creation, persistent partial translations, clearing addresses, pagination', async () => {
  await reset();
  const c = await customer();
  assert.match(c.id, /^[0-9a-f-]{36}$/);
  assert.deepEqual(c.address, { bg: null, en: null });
  await request(`/api/customers/${c.id}`, 'PATCH', {
    name: { en: 'Updated' },
    address: { bg: 'София' },
  });
  const result = await request(`/api/customers/${c.id}`, 'PATCH', {
    address: { bg: null },
    number: '123',
  });
  assert.deepEqual(result.customer.name, { bg: 'Клиент', en: 'Updated' });
  assert.deepEqual(result.customer.address, { bg: null, en: null });
  await customer();
  const list = await request('/api/customers?limit=1&offset=1');
  assert.equal(list.total, 2);
  assert.equal(list.customers.length, 1);
  const persisted = (await request('/api/customers')).customers.find((row) => row.id === c.id);
  assert.equal(persisted.number, '123');
  await request('/api/customers/missing', 'PATCH', { name: { en: 'Name' } }, 404);
});

test('draft totals, tax rounding, atomic item replacement and missing resources', async () => {
  await reset();
  await request('/api/settings', 'PUT', settings);
  const c = await customer();
  const i = await invoice(c.id, [line(0.01, 1.5, 20), line(12.34, 2, 20)]);
  assert.equal(i.subtotal, 24.7);
  assert.equal(i.tax, 4.94);
  assert.equal(i.total, 29.64);
  assert.equal(i.items[0].subtotal, 0.02);
  assert.equal(i.items[0].taxRate, 20);
  assert.equal(i.currency, 'EUR');
  assert.equal(i.customer, null);
  assert.deepEqual((await request(`/api/invoices/${i.id}`)).invoice, i);
  const edited = (
    await request(`/api/invoices/${i.id}`, 'PATCH', {
      items: [line(7, 3)],
      notes: 'Saved',
      dueDate: '2027-01-01',
    })
  ).invoice;
  assert.equal(edited.total, 21);
  assert.equal(edited.items.length, 1);
  assert.equal(edited.notes, 'Saved');
  assert.equal(edited.revision, 1);
  assert.equal(
    (
      await db
        .prepare('SELECT COUNT(*) AS n FROM invoice_items WHERE invoice_id = ?')
        .bind(i.id)
        .first()
    ).n,
    1,
  );
  await request(`/api/invoices/${i.id}`, 'PATCH', { total: 1 }, 400);
  assert.equal((await request(`/api/invoices/${i.id}`)).invoice.total, 21);
  await request('/api/invoices', 'POST', { customerId: c.id, items: [line()], total: 5 }, 400);
  await request('/api/invoices', 'POST', { customerId: 'missing', items: [line()] }, 404);
  await request('/api/invoices/missing', 'GET', undefined, 404);
  await request('/api/invoices/missing', 'PATCH', { notes: 'test' }, 404);
  await request('/api/invoices/missing/issue', 'POST', undefined, 404);
  await request('/api/invoices/missing/payments', 'GET', undefined, 404);
  await request('/api/invoices/missing/payments', 'POST', { amount: 1 }, 404);
  assert.equal((await request('/api/invoices?limit=1')).total, 1);
});

test('issuing allocates unique numbers, freezes bilingual snapshots, locks edits', async () => {
  await reset();
  await request('/api/settings', 'PUT', settings);
  const c = await customer();
  const drafts = await Promise.all([invoice(c.id), invoice(c.id)]);
  const issued = await Promise.all(
    drafts.map((i) => request(`/api/invoices/${i.id}/issue`, 'POST')),
  );
  assert.equal(new Set(issued.map((row) => row.invoice.invoiceNumber)).size, 2);
  for (const { invoice: issuedInvoice } of issued) {
    assert.match(issuedInvoice.invoiceNumber, /^\d{10}$/);
    assert.equal(issuedInvoice.status, 'issued');
    assert.deepEqual(issuedInvoice.company.name, settings.companyName);
    assert.deepEqual(issuedInvoice.customer.address, { bg: null, en: null });
    assert.match(issuedInvoice.issueDate, /^\d{4}-\d{2}-\d{2}$/);
  }
  const id = drafts[0].id;
  await request(`/api/customers/${c.id}`, 'PATCH', { name: { en: 'Changed customer' } });
  await request('/api/settings', 'PUT', {
    ...settings,
    companyName: { bg: 'Нова фирма', en: 'Changed company' },
  });
  const stored = (await request(`/api/invoices/${id}`)).invoice;
  assert.equal(stored.customer.name.en, 'Customer');
  assert.equal(stored.company.name.en, 'Example Company');
  await request(`/api/invoices/${id}`, 'PATCH', { notes: 'No edits' }, 409);
  await request(`/api/invoices/${id}/issue`, 'POST', undefined, 409);
  assert.equal(
    (await db.prepare('SELECT next_number FROM invoice_sequence').first()).next_number,
    3,
  );
});

test('payments persist, reject draft and excess amounts, and mark invoices paid', async () => {
  await reset();
  await request('/api/settings', 'PUT', settings);
  const c = await customer(),
    i = await invoice(c.id, [line(100)]);
  assert.deepEqual((await request(`/api/invoices/${i.id}/payments`)).payments, []);
  await request(`/api/invoices/${i.id}/payments`, 'POST', { amount: 25 }, 409);
  await request(`/api/invoices/${i.id}/issue`, 'POST');
  const partial = await request(
    `/api/invoices/${i.id}/payments`,
    'POST',
    { amount: 25, reference: 'Bank transfer', paidAt: '2026-11-24T10:00:00Z' },
    201,
  );
  assert.equal(partial.payment.amount, 25);
  assert.equal(partial.payment.reference, 'Bank transfer');
  let stored = (await request(`/api/invoices/${i.id}`)).invoice;
  assert.equal(stored.status, 'issued');
  assert.equal(stored.paidTotal, 25);
  assert.equal(stored.outstandingTotal, 75);
  await request(`/api/invoices/${i.id}/payments`, 'POST', { amount: 76 }, 409);
  await request(`/api/invoices/${i.id}/payments`, 'POST', { amount: 75 }, 201);
  stored = (await request(`/api/invoices/${i.id}`)).invoice;
  assert.equal(stored.status, 'paid');
  assert.equal(stored.paidTotal, 100);
  assert.equal(stored.outstandingTotal, 0);
  assert.equal((await request(`/api/invoices/${i.id}/payments`)).payments.length, 2);
  await request(`/api/invoices/${i.id}/payments`, 'POST', { amount: 1 }, 409);
});

test('concurrent issue, edit, and payment requests cannot corrupt invoice state', async () => {
  await reset();
  await request('/api/settings', 'PUT', settings);
  const c = await customer(),
    i = await invoice(c.id, [line(100)]);
  const issues = await Promise.all(
    [1, 2].map(() =>
      mf.dispatchFetch(`http://localhost/api/invoices/${i.id}/issue`, { method: 'POST' }),
    ),
  );
  assert.deepEqual(issues.map((r) => r.status).sort(), [200, 409]);
  await Promise.all(issues.map((r) => r.text()));
  const payments = await Promise.all(
    [1, 2].map(() =>
      mf.dispatchFetch(`http://localhost/api/invoices/${i.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 75 }),
      }),
    ),
  );
  assert.deepEqual(payments.map((r) => r.status).sort(), [201, 409]);
  await Promise.all(payments.map((r) => r.text()));
  assert.equal((await request(`/api/invoices/${i.id}`)).invoice.paidTotal, 75);
  const draft = await invoice(c.id);
  const edits = await Promise.all(
    [20, 30].map((unitPrice) =>
      mf.dispatchFetch(`http://localhost/api/invoices/${draft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [line(unitPrice)] }),
      }),
    ),
  );
  for (const response of edits) {
    assert([200, 409].includes(response.status));
    await response.text();
  }
  const stored = (await request(`/api/invoices/${draft.id}`)).invoice;
  assert.equal(stored.items.length, 1);
  assert([20, 30].includes(stored.total));
  assert.equal(stored.total, stored.items[0].total);
  assert.equal(
    (await db.prepare('SELECT next_number FROM invoice_sequence').first()).next_number,
    2,
  );
});

test('dashboard excludes drafts and groups outstanding balances by currency', async () => {
  await reset();
  await request('/api/settings', 'PUT', settings);
  const c = await customer();
  const euro = await invoice(c.id, [line(100)]);
  await request(`/api/invoices/${euro.id}/issue`, 'POST');
  await request(`/api/invoices/${euro.id}/payments`, 'POST', { amount: 25 }, 201);
  await invoice(c.id, [line(1000)]); // draft excluded
  await request('/api/settings', 'PUT', { ...settings, currency: 'USD' });
  const usd = await invoice(c.id, [line(40)]);
  await request(`/api/invoices/${usd.id}/issue`, 'POST');
  const dashboard = (await request('/api/dashboard')).dashboard;
  assert.equal(dashboard.customerCount, 1);
  assert.equal(dashboard.invoiceCount, 3);
  assert.equal(dashboard.currency, 'USD');
  assert.equal(dashboard.outstandingTotal, 40);
  assert.deepEqual(dashboard.outstandingByCurrency, [
    { currency: 'EUR', outstandingTotal: 75 },
    { currency: 'USD', outstandingTotal: 40 },
  ]);
});

test('validation rejects incomplete translations, invalid money, empty patches, and invalid pagination', async () => {
  await reset();
  await request('/api/settings', 'PUT', settings);
  const c = await customer();
  const cases = [
    ['/api/customers', 'POST', { name: { bg: 'Име' } }],
    [`/api/customers/${c.id}`, 'PATCH', {}],
    [`/api/customers/${c.id}`, 'PATCH', { address: { en: '   ' } }],
    ['/api/settings', 'PUT', { ...settings, companyName: { en: 'Name' } }],
    ['/api/settings', 'PUT', { ...settings, currency: 'euro' }],
    ['/api/invoices', 'POST', { customerId: c.id, items: [] }],
    ['/api/invoices', 'POST', { customerId: c.id, items: [line(1.005)] }],
    ['/api/invoices', 'POST', { customerId: c.id, items: [line(1, 0)] }],
    ['/api/invoices', 'POST', { customerId: c.id, items: [line(1, 0.0000001)] }],
    ['/api/invoices?limit=1000', 'GET'],
    ['/api/invoices?offset=-1', 'GET'],
  ];
  for (const [path, method, body] of cases) {
    const response = await mf.dispatchFetch(`http://localhost${path}`, {
      method,
      ...(body === undefined
        ? {}
        : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    });
    const message = await response.text();
    assert([400, 422].includes(response.status), `${path} ${message}`);
  }
  const i = await invoice(c.id, [line(0)]);
  assert.equal((await request(`/api/invoices/${i.id}/issue`, 'POST')).invoice.status, 'paid');
  for (const amount of [0, -1, 0.001, 0.0000001]) {
    const response = await mf.dispatchFetch(`http://localhost/api/invoices/${i.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
    });
    assert([400, 422].includes(response.status));
    await response.text();
  }
});

test('OpenAPI describes persisted resources and PDF deferral', async () => {
  const spec = await request('/openapi.json');
  assert.equal(
    spec.paths['/api/invoices'].post.responses['201'].description,
    'Create a draft invoice',
  );
  assert(spec.paths['/api/invoices/{id}/pdf'].get.responses['501']);
});

test('D1 failures roll back invoice creation, item replacement, and number allocation', async () => {
  await reset();
  await request('/api/settings', 'PUT', settings);
  const c = await customer();
  await db
    .prepare(
      `CREATE TRIGGER reject_test_item BEFORE INSERT ON invoice_items
    WHEN NEW.description_en = 'reject' BEGIN SELECT RAISE(ABORT, 'forced item failure'); END`,
    )
    .run();
  const rejectedLine = { ...line(), description: { bg: 'Отказ', en: 'reject' } };
  try {
    const error = await request(
      '/api/invoices',
      'POST',
      { customerId: c.id, items: [line(), rejectedLine] },
      500,
    );
    assert.deepEqual(error, { error: 'Internal server error' });
    assert.equal((await request('/api/invoices')).total, 0);
    const draft = await invoice(c.id);
    await request(`/api/invoices/${draft.id}`, 'PATCH', { items: [rejectedLine] }, 500);
    assert.deepEqual((await request(`/api/invoices/${draft.id}`)).invoice, draft);
  } finally {
    await db.prepare('DROP TRIGGER reject_test_item').run();
  }
  const draft = await invoice(c.id);
  await db
    .prepare(
      `CREATE TRIGGER reject_test_issue BEFORE UPDATE ON invoices
    WHEN NEW.status = 'issued' BEGIN SELECT RAISE(ABORT, 'forced issue failure'); END`,
    )
    .run();
  try {
    await request(`/api/invoices/${draft.id}/issue`, 'POST', undefined, 500);
    assert.equal(
      (await db.prepare('SELECT next_number FROM invoice_sequence').first()).next_number,
      1,
    );
    assert.equal((await request(`/api/invoices/${draft.id}`)).invoice.status, 'draft');
  } finally {
    await db.prepare('DROP TRIGGER reject_test_issue').run();
  }
  assert.equal(
    (await request(`/api/invoices/${draft.id}/issue`, 'POST')).invoice.invoiceNumber,
    '0000000001',
  );
});

async function catalogProduct(price = 12.34, currency = 'EUR') {
  return (await request('/api/products', 'POST', { name: text, price, currency }, 201)).product;
}

test('product catalog CRUD persists bilingual names, prices, currencies, and pagination', async () => {
  await reset();
  assert.deepEqual((await request('/api/products')).products, []);
  const p = await catalogProduct();
  assert.match(p.id, /^[0-9a-f-]{36}$/);
  assert.equal(p.price, 12.34);
  assert.deepEqual((await request(`/api/products/${p.id}`)).product, p);
  assert.equal(
    (await db.prepare('SELECT price_minor FROM products WHERE id = ?').bind(p.id).first())
      .price_minor,
    1234,
  );
  const edited = (
    await request(`/api/products/${p.id}`, 'PATCH', {
      name: { en: 'Updated' },
      price: 0,
      currency: 'USD',
    })
  ).product;
  assert.deepEqual(edited.name, { bg: text.bg, en: 'Updated' });
  assert.equal(edited.price, 0);
  assert.equal(edited.currency, 'USD');
  assert.deepEqual((await request(`/api/products/${p.id}`)).product, edited);
  await catalogProduct();
  const list = await request('/api/products?limit=1&offset=1');
  assert.equal(list.total, 2);
  assert.equal(list.products.length, 1);
  await request(`/api/products/${p.id}`, 'DELETE', undefined, 204);
  await request(`/api/products/${p.id}`, 'GET', undefined, 404);
  await request(`/api/products/${p.id}`, 'PATCH', { price: 1 }, 404);
  await request(`/api/products/${p.id}`, 'DELETE', undefined, 404);
});

test('invoices snapshot catalog products and retain them after catalog changes and deletion', async () => {
  await reset();
  await request('/api/settings', 'PUT', settings);
  const c = await customer(),
    p = await catalogProduct(12.34, 'USD');
  const input = { customerId: c.id, products: [{ productId: p.id, quantity: 2, taxRate: 20 }] };
  const draft = (await request('/api/invoices', 'POST', input, 201)).invoice;
  assert.equal(draft.currency, 'USD');
  assert.equal(draft.subtotal, 24.68);
  assert.equal(draft.tax, 4.94);
  assert.equal(draft.total, 29.62);
  const snapshot = draft.products[0];
  assert.equal(snapshot.productId, p.id);
  assert.deepEqual(snapshot.name, p.name);
  assert.equal(snapshot.price, 12.34);
  assert.equal(snapshot.currency, 'USD');
  assert.equal(snapshot.quantity, 2);
  assert.equal(draft.items[0].unitPrice, snapshot.price);
  await request(`/api/products/${p.id}`, 'PATCH', {
    name: { bg: 'Ново име', en: 'New name' },
    price: 99,
    currency: 'EUR',
  });
  assert.deepEqual((await request(`/api/invoices/${draft.id}`)).invoice.products, draft.products);
  const metadataEdit = (
    await request(`/api/invoices/${draft.id}`, 'PATCH', { notes: 'Keep original product' })
  ).invoice;
  assert.deepEqual(metadataEdit.products, draft.products);
  assert.equal(metadataEdit.currency, 'USD');
  await request(`/api/products/${p.id}`, 'DELETE', undefined, 204);
  const issued = (await request(`/api/invoices/${draft.id}/issue`, 'POST')).invoice;
  assert.deepEqual(issued.products, draft.products);
  assert.equal(issued.total, 29.62);
  assert.deepEqual((await request('/api/invoices')).invoices[0].products, draft.products);
  await request(`/api/invoices/${draft.id}/payments`, 'POST', { amount: 29.62 }, 201);
  assert.deepEqual((await request(`/api/invoices/${draft.id}`)).invoice.products, draft.products);
  await request('/api/invoices', 'POST', input, 404);
});

test('draft product replacement refreshes snapshots and currency without repricing metadata edits', async () => {
  await reset();
  await request('/api/settings', 'PUT', settings);
  const c = await customer(),
    eur = await catalogProduct(10),
    usd = await catalogProduct(20, 'USD');
  const draft = (
    await request(
      '/api/invoices',
      'POST',
      { customerId: c.id, products: [{ productId: eur.id }] },
      201,
    )
  ).invoice;
  assert.equal(draft.products[0].quantity, 1);
  assert.equal(draft.total, 10);
  await request(`/api/products/${eur.id}`, 'PATCH', { price: 15 });
  const refreshed = (
    await request(`/api/invoices/${draft.id}`, 'PATCH', { products: [{ productId: eur.id }] })
  ).invoice;
  assert.equal(refreshed.total, 15);
  assert.equal(refreshed.products.length, 1);
  const replaced = (
    await request(`/api/invoices/${draft.id}`, 'PATCH', {
      products: [{ productId: usd.id, quantity: 3 }],
    })
  ).invoice;
  assert.equal(replaced.currency, 'USD');
  assert.equal(replaced.total, 60);
  assert.equal(replaced.products[0].productId, usd.id);
  const count = await db
    .prepare('SELECT COUNT(*) AS n FROM invoice_items WHERE invoice_id = ?')
    .bind(draft.id)
    .first();
  assert.equal(count.n, 1);
  await request(
    `/api/invoices/${draft.id}`,
    'PATCH',
    { products: [{ productId: 'missing' }] },
    404,
  );
  await request(
    `/api/invoices/${draft.id}`,
    'PATCH',
    { products: [{ productId: eur.id }, { productId: usd.id }] },
    400,
  );
  assert.deepEqual((await request(`/api/invoices/${draft.id}`)).invoice, replaced);
  await request(`/api/invoices/${draft.id}/issue`, 'POST');
  await request(`/api/invoices/${draft.id}`, 'PATCH', { products: [{ productId: eur.id }] }, 409);
});

test('product inputs reject invalid prices, currencies, translations, overrides, and mixed invoices', async () => {
  await reset();
  await request('/api/settings', 'PUT', settings);
  const c = await customer(),
    p = await catalogProduct(),
    usd = await catalogProduct(1, 'USD');
  await request(
    '/api/invoices',
    'POST',
    { customerId: c.id, products: [{ productId: p.id }, { productId: usd.id }] },
    400,
  );
  await request(
    '/api/invoices',
    'POST',
    { customerId: c.id, products: [{ productId: 'missing' }] },
    404,
  );
  for (const body of [
    { name: { en: 'Only English' }, price: 1, currency: 'EUR' },
    { name: { bg: '   ', en: 'Name' }, price: 1, currency: 'EUR' },
    { name: text, price: -1, currency: 'EUR' },
    { name: text, price: 1.001, currency: 'EUR' },
    { name: text, price: 1, currency: 'GBP' },
    { name: text, price: 1 },
  ]) {
    await request('/api/products', 'POST', body, 400);
  }
  for (const body of [{}, { name: {} }, { price: -1 }, { currency: 'GBP' }, { name: { en: '' } }]) {
    await request(`/api/products/${p.id}`, 'PATCH', body, 400);
  }
  for (const body of [
    { customerId: c.id },
    { customerId: c.id, products: [] },
    { customerId: c.id, products: [{ productId: p.id, quantity: 0 }] },
    { customerId: c.id, products: [{ productId: p.id, price: 0 }] },
    { customerId: c.id, products: [{ productId: p.id }], items: [line()] },
  ]) {
    await request('/api/invoices', 'POST', body, 400);
  }
  const spec = await request('/openapi.json');
  assert(spec.paths['/api/products'].get);
  assert(spec.paths['/api/products'].post);
  assert(spec.paths['/api/products/{id}'].get);
  assert(spec.paths['/api/products/{id}'].patch);
  assert(spec.paths['/api/products/{id}'].delete.responses['204']);
});

# Cloudflare Workers OpenAPI 3.1

This is a Cloudflare Worker with OpenAPI 3.1 using [chanfana](https://github.com/cloudflare/chanfana) and [Hono](https://github.com/honojs/hono).

This is an example project made to be used as a quick start into building OpenAPI compliant Workers that generates the
`openapi.json` schema automatically from code and validates the incoming request to the defined parameters or request body.

## Get started

1. Sign up for [Cloudflare Workers](https://workers.dev). The free tier is more than enough for most use cases.
2. Clone this project and install dependencies with `npm install`
3. Run `wrangler login` to login to your Cloudflare account in wrangler
4. Run `wrangler deploy` to publish the API to Cloudflare Workers

## Project structure

1. Your main router is defined in `src/index.ts`.
2. Each endpoint has its own file in `src/endpoints/`.
3. For more information read the [chanfana documentation](https://chanfana.pages.dev/) and [Hono documentation](https://hono.dev/docs).

## Development

1. Run `wrangler dev` to start a local instance of the API.
2. Open `http://localhost:8787/` for the Ledger invoice UI. Swagger is available at `http://localhost:8787/docs`.
3. Changes to the Worker or the static UI in `public/` are picked up by Wrangler; refresh your browser to see them.

The UI lists invoices with search and status filters, shows invoice details, and
provides forms for creating draft invoices and adding customers. Invoice totals
are calculated from line items. Names and item descriptions support English and
Bulgarian; customer addresses are optional in either language.

API writes persist to D1 and return stable UUIDs. Apply migrations and configure
company settings through `PUT /api/settings` before creating invoices.
The existing UI still contains placeholder/session labels; API records persist
across reloads regardless of those labels.

## GitHub Actions

`.github/workflows/ci.yml` runs lint, a type-checked Worker build, schema and endpoint tests,
and local D1 migrations on every push and pull request. Run the same checks locally
with `npm run lint`, `npm run build`, `npm test`, and `npm run db:migrate:local`.
The checks use Node.js 24 and Python 3.14; the Python tests have no pip dependencies.

`.github/workflows/deploy.yml` runs on pushes to `main`. It reuses CI as a required
job, then applies production D1 migrations before deploying the Worker. A failed
migration stops deployment. Production runs are serialized without cancelling
an active migration or deployment. Use migrations compatible with the currently
running Worker, since it continues serving requests while migrations are applied.
If deployment fails after a migration succeeds, that migration remains applied.

Configure these repository secrets under **Settings → Secrets and variables →
Actions**:

- `CLOUDFLARE_API_TOKEN`: a Cloudflare token with **Account / Workers Scripts /
  Edit** and **Account / D1 / Edit**, scoped to the deployment account. Add
  **Zone / Workers Routes / Edit** if custom zone routes are configured later.
- `CLOUDFLARE_ACCOUNT_ID`: the account containing the Worker and D1 database.

Wrangler uses the Worker name and D1 database configured in `wrangler.jsonc`.
Both workflows install the exact dependencies from `package-lock.json` with `npm ci`.

## Database

The D1 schema is defined by versioned SQL files in `migrations/`. TypeScript row
models are in `src/db/models.ts`; D1 queries live in `src/db/storage.ts` and
`src/db/products.ts`.
All endpoints use the configured `invoicer` binding, except PDF rendering, which
is deferred and returns HTTP 501.

The initial schema contains `customers`, `invoices`, `invoice_items`, `payments`,
and a singleton `settings` table (`id = 1`). Migration `0002` adds an invoice-number
sequence, invoice revisions, and line-item tax rates. Migration `0003` adds the
product catalog and currency/source-ID fields on invoice snapshots. The dashboard aggregates
these tables rather than storing a separate copy of its totals. This assumes one company
per database. Settings are created during company setup; no example data is seeded.

```bash
# Apply migrations to local development storage
npm run db:migrate:local

# Create the next migration, then edit its SQL
npm run db:migration:create -- add_customer_email

# Apply reviewed migrations to the configured production database
npm run db:migrate:remote
```

Commit migration files and add a new migration for subsequent schema changes.
Do not edit migrations already applied to a shared database. Wrangler tracks
applied migrations in `d1_migrations`.

Storage conventions:

- Customer and company names use required `_bg` and `_en` columns; both address columns are nullable. Product/service
  names are stored in the `products` catalog and copied into
  `invoice_items.description_bg` and `description_en` as denormalized snapshots.
  Numbers, quantities, and prices are shared between languages.
- API text fields use `{ "bg": "…", "en": "…" }`. Customer creation requires both
  languages for `name`. The `address` object and each translation are optional;
  send `null` for an address translation to clear it. Customer PATCH accepts individual translations,
  such as `{ "name": { "en": "New name" } }`. Invoice input includes a nonempty
  `products` array selecting catalog entries by `productId` and quantity.
  Blank translations are rejected.
- The initial migration creates bilingual fields directly. Issued/paid invoices require customer
  and company name snapshots in both languages; address snapshots are optional.
- Settings use bilingual `companyName` and optional `companyAddress` with the same
  translation format as customers. Each company address translation can be omitted
  or set to `null`; `companyNumber` is a shared optional identifier.
- Generate text UUIDs in the application with `crypto.randomUUID()`.
- Store money in integer minor units (for example, `1234` represents EUR 12.34).
  Payments inherit the invoice currency. Convert amounts at the API boundary.
- Store dates as `YYYY-MM-DD` and timestamps as UTC SQLite datetime strings
  (`YYYY-MM-DD HH:MM:SS`). Update `updated_at` explicitly on writes.
- Compute and round line amounts in the application, and update invoice items
  and invoice totals atomically. Database checks enforce nonnegative amounts
  and that each total equals its subtotal plus tax.
- When issuing an invoice, assign its unique number, set its issue date, and
  copy customer/company details into its snapshot fields. The database requires
  these fields for issued and paid invoices. Application code prevents
  edits to issued snapshots and keeps payment totals and invoice status in sync.
- Customer deletion is restricted while invoices reference it; payments prevent
  invoice deletion. Invoice items are deleted with their parent invoice.

Run the schema constraint tests with Python's standard library:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p 'test_*.py'
```

## API behavior

- `GET /api/customers`, `GET /api/products`, and `GET /api/invoices` accept `limit` (default 50, maximum
  100) and `offset` (default 0). Responses include the records, `total`, `limit`,
  and `offset`. Ordering is newest first, with IDs breaking timestamp ties.
- `POST /api/customers` returns `{ customer }` with a generated ID. Customer PATCH
  returns HTTP 200 and changes only the supplied fields or translations.
- `GET /api/settings` returns 404 before setup. PUT creates/replaces the singleton;
  omitted optional company addresses and number are cleared. Example setup:

  ```json
  {
    "companyName": { "bg": "Примерна фирма", "en": "Example Company" },
    "currency": "EUR"
  }
  ```

- Manage catalog entries with `GET/POST /api/products` and
  `GET/PATCH/DELETE /api/products/:id`. Products have bilingual `name`, nonnegative
  `price`, and `currency` restricted to `USD` or `EUR`. PATCH can update individual
  name translations. DELETE returns 204; missing IDs return 404.
- Create drafts with a customer ID and 1-100 `products` selections. Each selection
  has `productId`, positive `quantity` (default 1, up to six decimal places), and
  optional `taxRate` percentage (default 0, up to two decimal places). Names,
  prices, and currencies are copied from the catalog on creation/replacement;
  clients cannot override them in the selection. `dueDate` and `notes` are optional
  and nullable. Invoice currency comes from the selected products; mixed currencies
  are rejected with 400. No currency conversion is performed.
- Invoice responses include a denormalized `products` list: bilingual `name`,
  `price`, `currency`, source `productId`, quantity, tax rate, and computed amounts.
  These snapshots are independent even while the invoice is a draft. Updating or
  deleting a catalog entry never changes existing invoice products. The source
  product ID is retained after deletion, without a foreign key to the catalog.
- Existing clients can still send `items` with bilingual `description`, `unitPrice`,
  quantity, and optional tax rate instead of `products` (never both). These custom
  products use the settings currency and have null source product IDs. The `items`
  response is retained as a compatibility representation of the same snapshots.
- All prices/payments use major units with at most two decimals. Line subtotals
  and taxes round half up to minor units; invoice totals sum the rounded lines.
  A line or invoice may not exceed 1,000,000,000,000 minor units. Optional input
  `total` is verified against the calculated amount. Responses include line and
  invoice subtotals, taxes, totals, `paidTotal`, and `outstandingTotal`.
- Invoice PATCH replaces `products` (or legacy `items`) if supplied and updates other supplied fields.
  Replacing products fetches fresh catalog values and may change draft currency;
  metadata-only edits preserve the existing product snapshots and currency.
  Only drafts can be edited. Concurrent edits use a revision check and guarded
  D1 batches; a conflicting write returns 409 without changing the items.
- Issuing allocates a unique ten-digit, zero-padded number, sets today's UTC
  issue date, and freezes both customer and company details. All issuing writes
  share a transaction. Reissuing returns 409. Zero-total invoices become paid
  immediately. Draft responses have null party snapshots until issuing.
- Payments are accepted only for issued invoices, must be positive, and cannot
  exceed the outstanding balance. `reference` and `paidAt` (UTC ISO datetime) are
  optional. Payment timestamps are returned in UTC SQLite format. Inserting a
  payment and updating invoice status/revision share a transaction; concurrent
  overpayments are rejected with 409. Full payment changes status to `paid`.
- Dashboard outstanding totals include issued invoices after partial payments,
  excluding drafts and paid invoices. `outstandingTotal` uses the current company
  currency; `outstandingByCurrency` reports each currency separately.
- Missing records return 404; workflow conflicts return 409; invalid input returns
  400/422. `GET /api/invoices/:id/pdf` returns 501 until PDF rendering is added.

`npm test` runs the SQLite schema tests and HTTP endpoint tests against isolated
local D1 storage through Miniflare. It requires no Cloudflare account and never
accesses production. The endpoint tests cover persistence, rounding, snapshots,
concurrent writes, payment balance checks, rollback, and OpenAPI generation.

Example product creation (`POST /api/products`):

```json
{
  "name": { "bg": "Консултация", "en": "Consulting" },
  "price": 100,
  "currency": "EUR"
}
```

Example invoice creation (`POST /api/invoices`):

```json
{
  "customerId": "<customer-id>",
  "products": [
    { "productId": "<product-id>", "quantity": 2, "taxRate": 20 }
  ]
}
```

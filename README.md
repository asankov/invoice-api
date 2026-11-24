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
2. Open `http://localhost:8787/` in your browser to see the Swagger interface where you can try the endpoints.
3. Changes made in the `src/` folder will automatically trigger the server to reload, you only need to refresh the Swagger interface.

## GitHub Actions

`.github/workflows/ci.yml` runs lint, a type-checked Worker build, schema tests,
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
models are in `src/db/models.ts`. The API handlers currently return dummy data;
they do not read or write these tables yet.

The initial schema contains `customers`, `invoices`, `invoice_items`, `payments`,
and a singleton `settings` table (`id = 1`). The dashboard will aggregate these
tables rather than store a separate copy of its totals. This assumes one company
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
  text is currently stored in `invoice_items.description_bg` and `description_en`;
  there is no separate product catalog. Numbers, quantities, and prices are shared.
- API text fields use `{ "bg": "…", "en": "…" }`. Customer creation requires both
  languages for `name`. The `address` object and each translation are optional;
  send `null` for an address translation to clear it. Customer PATCH accepts individual translations,
  such as `{ "name": { "en": "New name" } }`. Invoice input includes a nonempty
  `items` array with bilingual `description`, `quantity`, and `unitPrice` per item.
  Blank translations are rejected. These are schema changes; handlers remain stubs.
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
  these fields for issued and paid invoices. Application code must prevent
  edits to issued snapshots and keep payment totals and invoice status in sync.
- Customer deletion is restricted while invoices reference it; payments prevent
  invoice deletion. Invoice items are deleted with their parent invoice.

Run the schema constraint tests with Python's standard library:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p 'test_*.py'
```

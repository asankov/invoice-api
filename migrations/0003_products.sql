CREATE TABLE products (
  id TEXT PRIMARY KEY NOT NULL,
  name_bg TEXT NOT NULL CHECK (length(trim(name_bg)) > 0),
  name_en TEXT NOT NULL CHECK (length(trim(name_en)) > 0),
  price_minor INTEGER NOT NULL CHECK (price_minor >= 0 AND price_minor <= 1000000000000),
  currency TEXT NOT NULL CHECK (currency IN ('USD', 'EUR')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

-- Invoice items store independent product snapshots. Deliberately no foreign key:
-- deleting a catalog entry must not change or delete historical invoice products.
ALTER TABLE invoice_items ADD COLUMN product_id TEXT;
ALTER TABLE invoice_items ADD COLUMN currency TEXT NOT NULL DEFAULT 'EUR'
  CHECK (currency GLOB '[A-Z][A-Z][A-Z]');
UPDATE invoice_items SET currency = (SELECT currency FROM invoices WHERE id = invoice_id);

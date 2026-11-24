-- Revision and operation token prevent lost updates and guard batched item writes.
ALTER TABLE invoices ADD COLUMN revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0);
ALTER TABLE invoices ADD COLUMN mutation_token TEXT;
ALTER TABLE invoice_items ADD COLUMN tax_rate REAL NOT NULL DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 100);

-- Allocate invoice numbers inside the same transaction that issues the invoice.
CREATE TABLE invoice_sequence (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  next_number INTEGER NOT NULL CHECK (next_number > 0)
) STRICT;
INSERT INTO invoice_sequence (id, next_number)
SELECT 1, COALESCE(MAX(CAST(invoice_number AS INTEGER)), 0) + 1 FROM invoices;

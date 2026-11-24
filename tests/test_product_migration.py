import sqlite3
import unittest
from pathlib import Path


MIGRATIONS = Path(__file__).resolve().parents[1] / 'migrations'


class ProductMigrationTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.addCleanup(self.db.close)
        self.db.execute('PRAGMA foreign_keys = ON')
        for file in sorted(MIGRATIONS.glob('*.sql')):
            if file.name < '0003':
                self.db.executescript(file.read_text())

    def test_upgrade_retains_existing_invoice_currency_and_line_data(self):
        self.db.execute("INSERT INTO customers (id, name_bg, name_en) VALUES ('c', 'Клиент', 'Customer')")
        self.db.execute("""
            INSERT INTO invoices (id, customer_id, currency, subtotal_minor, tax_minor, total_minor)
            VALUES ('i', 'c', 'USD', 1000, 200, 1200)
        """)
        self.db.execute("""
            INSERT INTO invoice_items
              (id, invoice_id, position, description_bg, description_en, quantity,
               unit_price_minor, tax_rate, subtotal_minor, tax_minor, total_minor)
            VALUES ('line', 'i', 0, 'Продукт', 'Product', 2, 500, 20, 1000, 200, 1200)
        """)
        self.db.executescript((MIGRATIONS / '0003_products.sql').read_text())
        self.assertEqual(self.db.execute("""
            SELECT product_id, currency, description_bg, description_en, quantity,
              unit_price_minor, tax_rate, subtotal_minor, tax_minor, total_minor FROM invoice_items
        """).fetchone(), (None, 'USD', 'Продукт', 'Product', 2, 500, 20, 1000, 200, 1200))
        self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(), [])

    def test_catalog_enforces_bilingual_names_integer_prices_and_supported_currencies(self):
        self.db.executescript((MIGRATIONS / '0003_products.sql').read_text())
        insert = 'INSERT INTO products (id, name_bg, name_en, price_minor, currency) VALUES (?, ?, ?, ?, ?)'
        for bg, en, price, currency in (
            (None, 'Name', 100, 'EUR'), ('Име', None, 100, 'EUR'),
            ('', 'Name', 100, 'EUR'), ('Име', '   ', 100, 'EUR'),
            ('Име', 'Name', -1, 'EUR'), ('Име', 'Name', 12.34, 'EUR'),
            ('Име', 'Name', 1000000000001, 'EUR'), ('Име', 'Name', 100, 'GBP'),
        ):
            with self.subTest(bg=bg, en=en, price=price, currency=currency), self.assertRaises(sqlite3.IntegrityError):
                self.db.execute(insert, ('invalid', bg, en, price, currency))
        for currency in ('EUR', 'USD'):
            self.db.execute(insert, (currency, 'Име', 'Name', 0, currency))
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM products').fetchone()[0], 2)


if __name__ == '__main__':
    unittest.main()

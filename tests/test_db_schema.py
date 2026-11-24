"""Run with python3 -m unittest discover -s tests -p 'test_*.py'."""

import sqlite3
import unittest
from pathlib import Path


class DatabaseSchemaTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.addCleanup(self.db.close)
        self.db.execute('PRAGMA foreign_keys = ON')
        migrations = Path(__file__).resolve().parents[1] / 'migrations'
        for migration in sorted(migrations.glob('*.sql')):
            self.db.executescript(migration.read_text())
        self.db.execute(
            "INSERT INTO customers (id, name_bg, name_en, address_bg, address_en) VALUES ('customer-1', 'Алис', 'Alice', 'Главна улица', 'Main Street')"
        )
        self.db.execute(
            "INSERT INTO invoices (id, customer_id, currency) VALUES ('invoice-1', 'customer-1', 'EUR')"
        )

    def issue_invoice(self):
        self.db.execute("""
            UPDATE invoices SET status = 'issued', invoice_number = 'INV-001',
              issue_date = '2026-11-13', customer_name_bg = 'Алис', customer_name_en = 'Alice',
              customer_address_bg = 'Главна улица', customer_address_en = 'Main Street', company_name_bg = 'Пример', company_name_en = 'Example',
              company_address_bg = 'Фирмена улица', company_address_en = 'Company Street'
            WHERE id = 'invoice-1'
        """)

    def test_draft_can_be_issued_with_snapshots(self):
        self.issue_invoice()
        self.db.execute("UPDATE customers SET name_bg = 'Ново име', name_en = 'New Name' WHERE id = 'customer-1'")
        self.assertEqual(
            self.db.execute('SELECT customer_name_bg, customer_name_en FROM invoices').fetchone(), ('Алис', 'Alice')
        )

    def test_issued_invoice_requires_number_date_and_snapshots(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE invoices SET status = 'issued'")

    def test_foreign_keys_reject_orphans_and_customer_deletion(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "INSERT INTO invoices (id, customer_id, currency) VALUES ('orphan', 'missing', 'EUR')"
            )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("DELETE FROM customers WHERE id = 'customer-1'")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "INSERT INTO payments (id, invoice_id, amount_minor) VALUES ('orphan', 'missing', 100)"
            )

    def test_payment_amounts_are_positive_integers(self):
        for amount in (0, -100, 12.34):
            with self.subTest(amount=amount), self.assertRaises(sqlite3.IntegrityError):
                self.db.execute(
                    "INSERT INTO payments (id, invoice_id, amount_minor) VALUES ('invalid', 'invoice-1', ?)",
                    (amount,),
                )
        self.db.execute(
            "INSERT INTO payments (id, invoice_id, amount_minor) VALUES ('payment-1', 'invoice-1', 1234)"
        )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("DELETE FROM invoices WHERE id = 'invoice-1'")

    def test_invoice_totals_and_status_are_constrained(self):
        for assignment in ("total_minor = -1", "total_minor = 100", "status = 'unknown'", "currency = 'euro'"):
            with self.subTest(assignment=assignment), self.assertRaises(sqlite3.IntegrityError):
                self.db.execute(f'UPDATE invoices SET {assignment}')
        self.db.execute('UPDATE invoices SET subtotal_minor = 100, tax_minor = 20, total_minor = 120')

    def test_invoice_numbers_are_unique(self):
        self.db.execute("UPDATE invoices SET invoice_number = 'INV-001'")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("""
                INSERT INTO invoices (id, customer_id, currency, invoice_number)
                VALUES ('invoice-2', 'customer-1', 'EUR', 'INV-001')
            """)

    def test_items_have_unique_positions_and_cascade_on_delete(self):
        insert = """
            INSERT INTO invoice_items
              (id, invoice_id, position, description_bg, description_en, quantity, unit_price_minor, subtotal_minor, total_minor)
            VALUES (?, 'invoice-1', 0, 'Консултация', 'Consulting', 1.5, 1000, 1500, 1500)
        """
        self.db.execute(insert, ('item-1',))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(insert, ('item-2',))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute('UPDATE invoice_items SET quantity = 0')
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute('UPDATE invoice_items SET total_minor = 1')
        self.db.execute("DELETE FROM invoices WHERE id = 'invoice-1'")
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM invoice_items').fetchone()[0], 0)

    def test_settings_are_a_singleton(self):
        self.db.execute("INSERT INTO settings (id, company_name_bg, company_name_en) VALUES (1, 'Пример', 'Example')")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO settings (id, company_name_bg, company_name_en) VALUES (2, 'Друга фирма', 'Another Company')")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO settings (id, company_name_bg, company_name_en) VALUES (1, 'Дубликат', 'Duplicate')")

    def test_customer_requires_both_name_translations(self):
        for column in ('name_bg', 'name_en'):
            for invalid in (None, '', '   '):
                with self.subTest(column=column, invalid=invalid), self.assertRaises(sqlite3.IntegrityError):
                    self.db.execute(f'UPDATE customers SET {column} = ?', (invalid,))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO customers (id, name_bg, address_bg) VALUES ('missing-en', 'Алис', 'Главна')")

    def test_company_requires_both_name_translations(self):
        for bg, en in ((None, 'Example'), ('Пример', None), ('', 'Example'),
                       ('Пример', ''), ('   ', 'Example'), ('Пример', '   ')):
            with self.subTest(bg=bg, en=en), self.assertRaises(sqlite3.IntegrityError):
                self.db.execute(
                    'INSERT INTO settings (id, company_name_bg, company_name_en) VALUES (1, ?, ?)',
                    (bg, en),
                )

    def test_company_addresses_are_independently_optional(self):
        self.db.execute("INSERT INTO settings (id, company_name_bg, company_name_en) VALUES (1, 'Пример', 'Example')")
        self.assertEqual(
            self.db.execute('SELECT company_address_bg, company_address_en FROM settings').fetchone(),
            (None, None),
        )
        for bg, en in ((None, 'Company Street'), ('Фирмена улица', None), (None, None)):
            self.db.execute('UPDATE settings SET company_address_bg = ?, company_address_en = ?', (bg, en))
        for column in ('company_address_bg', 'company_address_en'):
            for invalid in ('', '   '):
                with self.subTest(column=column, invalid=invalid), self.assertRaises(sqlite3.IntegrityError):
                    self.db.execute(f'UPDATE settings SET {column} = ?', (invalid,))

    def test_customer_addresses_are_independently_optional(self):
        self.db.execute("INSERT INTO customers (id, name_bg, name_en) VALUES ('no-address', 'Алис', 'Alice')")
        self.assertEqual(
            self.db.execute("SELECT address_bg, address_en FROM customers WHERE id = 'no-address'").fetchone(),
            (None, None),
        )
        for bg, en in ((None, 'Main Street'), ('Главна улица', None), (None, None)):
            self.db.execute('UPDATE customers SET address_bg = ?, address_en = ?', (bg, en))
        for column in ('address_bg', 'address_en'):
            for invalid in ('', '   '):
                with self.subTest(column=column, invalid=invalid), self.assertRaises(sqlite3.IntegrityError):
                    self.db.execute(f'UPDATE customers SET {column} = ?', (invalid,))

    def test_invoice_item_requires_both_descriptions(self):
        insert = """
            INSERT INTO invoice_items
              (id, invoice_id, position, description_bg, description_en, quantity,
               unit_price_minor, subtotal_minor, total_minor)
            VALUES ('item-1', 'invoice-1', 0, ?, ?, 1, 1000, 1000, 1000)
        """
        for bg, en in ((None, 'Consulting'), ('Консултация', None), ('', 'Consulting'),
                       ('Консултация', ''), ('   ', 'Consulting'), ('Консултация', '   ')):
            with self.subTest(bg=bg, en=en), self.assertRaises(sqlite3.IntegrityError):
                self.db.execute(insert, (bg, en))
        self.db.execute(insert, ('Консултация', 'Consulting'))
        self.assertEqual(
            self.db.execute('SELECT description_bg, description_en FROM invoice_items').fetchone(),
            ('Консултация', 'Consulting'),
        )

    def test_issued_and_paid_invoices_require_bilingual_name_snapshots(self):
        self.issue_invoice()
        for status in ('issued', 'paid'):
            self.db.execute('UPDATE invoices SET status = ?', (status,))
            for column in ('customer_name_bg', 'customer_name_en', 'company_name_bg', 'company_name_en'):
                for invalid in (None, '', '   '):
                    with self.subTest(status=status, column=column, invalid=invalid), self.assertRaises(sqlite3.IntegrityError):
                        self.db.execute(f'UPDATE invoices SET {column} = ?', (invalid,))

    def test_issued_and_paid_invoices_allow_optional_addresses(self):
        self.issue_invoice()
        for status in ('issued', 'paid'):
            for prefix in ('customer', 'company'):
                for bg, en in ((None, 'Main Street'), ('Главна улица', None), (None, None)):
                    with self.subTest(status=status, prefix=prefix, bg=bg, en=en):
                        self.db.execute(
                            f'UPDATE invoices SET status = ?, {prefix}_address_bg = ?, {prefix}_address_en = ?',
                            (status, bg, en),
                        )

    def test_company_snapshot_survives_settings_changes(self):
        self.issue_invoice()
        self.db.execute("INSERT INTO settings (id, company_name_bg, company_name_en) VALUES (1, 'Ново име', 'New name')")
        self.assertEqual(
            self.db.execute('SELECT company_name_bg, company_name_en FROM invoices').fetchone(),
            ('Пример', 'Example'),
        )


if __name__ == '__main__':
    unittest.main()

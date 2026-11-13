"""Run with python3 -m unittest discover -s tests -p 'test_*.py'."""

import sqlite3
import unittest
from pathlib import Path


class DatabaseSchemaTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.addCleanup(self.db.close)
        self.db.execute('PRAGMA foreign_keys = ON')
        migration = Path(__file__).resolve().parents[1] / 'migrations/0001_initial_schema.sql'
        self.db.executescript(migration.read_text())
        self.db.execute(
            "INSERT INTO customers (id, name, address) VALUES ('customer-1', 'Alice', 'Main Street')"
        )
        self.db.execute(
            "INSERT INTO invoices (id, customer_id, currency) VALUES ('invoice-1', 'customer-1', 'EUR')"
        )

    def test_draft_can_be_issued_with_snapshots(self):
        self.db.execute("""
            UPDATE invoices SET status = 'issued', invoice_number = 'INV-001',
              issue_date = '2026-11-13', customer_name = 'Alice',
              customer_address = 'Main Street', company_name = 'Example',
              company_address = 'Company Street'
            WHERE id = 'invoice-1'
        """)
        self.db.execute("UPDATE customers SET name = 'New Name' WHERE id = 'customer-1'")
        self.assertEqual(
            self.db.execute('SELECT customer_name FROM invoices').fetchone()[0], 'Alice'
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
              (id, invoice_id, position, description, quantity, unit_price_minor, subtotal_minor, total_minor)
            VALUES (?, 'invoice-1', 0, 'Consulting', 1.5, 1000, 1500, 1500)
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
        self.db.execute("INSERT INTO settings (id, company_name) VALUES (1, 'Example')")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO settings (id, company_name) VALUES (2, 'Another Company')")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO settings (id, company_name) VALUES (1, 'Duplicate')")


if __name__ == '__main__':
    unittest.main()

"""
Migration M6 — add qty_on_hand to parts table
Run once: python3 migrate_m6_spares.py
"""
import sqlite3
import os

DB_PATH = os.getenv("DB_PATH", "/opt/homemaint/homemaint.db")

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

cur.execute("PRAGMA table_info(parts)")
cols = [row[1] for row in cur.fetchall()]

if "qty_on_hand" not in cols:
    print("Adding qty_on_hand column to parts...")
    cur.execute("ALTER TABLE parts ADD COLUMN qty_on_hand INTEGER NOT NULL DEFAULT 0")
    conn.commit()
    print("Done.")
else:
    print("qty_on_hand already exists — nothing to do.")

conn.close()

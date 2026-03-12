"""
Migration: add part_id FK to spare_inventory table
Run once: python migrate_spare_part_link.py
"""
import sqlite3
import os

DB_PATH = os.getenv("DB_PATH", "/opt/homemaint/homemaint.db")

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # Check if column already exists
    cur.execute("PRAGMA table_info(spare_inventory)")
    cols = [row[1] for row in cur.fetchall()]

    if "part_id" in cols:
        print("part_id column already exists — skipping")
        conn.close()
        return

    print("Adding part_id column to spare_inventory...")
    cur.execute("ALTER TABLE spare_inventory ADD COLUMN part_id INTEGER REFERENCES parts(id)")
    conn.commit()
    print("Done.")
    conn.close()

if __name__ == "__main__":
    migrate()

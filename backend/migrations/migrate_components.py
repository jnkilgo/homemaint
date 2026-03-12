#!/usr/bin/env python3
"""Create components table."""
import sqlite3

DB = '/opt/homemaint/data/homemaint.db'
conn = sqlite3.connect(DB)
cur = conn.cursor()

try:
    cur.execute("""
        CREATE TABLE IF NOT EXISTS components (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            asset_id INTEGER NOT NULL REFERENCES assets(id),
            name TEXT NOT NULL,
            installed_date DATE,
            expected_lifespan_years REAL,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    print("components table created")
except Exception as e:
    print(f"error: {e}")

conn.commit()
conn.close()
print("done")

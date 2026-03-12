#!/usr/bin/env python3
"""M5a migration — adds model_year, custom_fields to assets; qty, spec_notes to parts."""
import sqlite3

DB = '/opt/homemaint/data/homemaint.db'
conn = sqlite3.connect(DB)
cur = conn.cursor()

migrations = [
    ("assets", "model_year",     "INTEGER"),
    ("assets", "custom_fields",  "TEXT"),
    ("parts",  "qty",            "INTEGER DEFAULT 1"),
    ("parts",  "spec_notes",     "TEXT"),
]

for table, col, col_type in migrations:
    try:
        cur.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}")
        print(f"  + {table}.{col}")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e):
            print(f"  ~ {table}.{col} (already exists)")
        else:
            raise

conn.commit()
conn.close()
print("Migration complete.")

#!/usr/bin/env python3
"""Create task_parts join table linking tasks to spare inventory items."""
import sqlite3

DB = '/opt/homemaint/data/homemaint.db'
conn = sqlite3.connect(DB)
cur = conn.cursor()

try:
    cur.execute("""
        CREATE TABLE IF NOT EXISTS task_parts (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id     INTEGER NOT NULL REFERENCES tasks(id),
            spare_id    INTEGER NOT NULL REFERENCES spare_inventory(id),
            qty_needed  INTEGER DEFAULT 1
        )
    """)
    print("task_parts table created")
except Exception as e:
    print(f"error: {e}")

conn.commit()
conn.close()
print("done")

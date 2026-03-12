"""
Migration M6 — create missing tables: components, task_parts, app_settings
Run once: python3 migrate_m6_tables.py
"""
import sqlite3
import os

DB_PATH = os.getenv("DB_PATH", "/opt/homemaint/homemaint.db")
conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
existing = {r[0] for r in cur.fetchall()}

if "components" not in existing:
    print("Creating components table...")
    cur.execute("""
        CREATE TABLE components (
            id INTEGER NOT NULL PRIMARY KEY,
            asset_id INTEGER NOT NULL REFERENCES assets(id),
            name VARCHAR NOT NULL,
            installed_date DATE,
            expected_lifespan_years FLOAT,
            notes TEXT,
            created_at DATETIME DEFAULT (CURRENT_TIMESTAMP)
        )
    """)
    print("  Done.")
else:
    print("components already exists.")

if "task_parts" not in existing:
    print("Creating task_parts table...")
    cur.execute("""
        CREATE TABLE task_parts (
            id INTEGER NOT NULL PRIMARY KEY,
            task_id INTEGER NOT NULL REFERENCES tasks(id),
            part_id INTEGER NOT NULL REFERENCES parts(id)
        )
    """)
    print("  Done.")
else:
    print("task_parts already exists.")

if "app_settings" not in existing:
    print("Creating app_settings table...")
    cur.execute("""
        CREATE TABLE app_settings (
            id INTEGER NOT NULL PRIMARY KEY,
            key VARCHAR NOT NULL UNIQUE,
            value TEXT,
            updated_at DATETIME DEFAULT (CURRENT_TIMESTAMP)
        )
    """)
    print("  Done.")
else:
    print("app_settings already exists.")

conn.commit()
conn.close()
print("Migration complete.")

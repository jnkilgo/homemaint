"""
Migration M6b — add snoozed_until to tasks table
Run once: python3 migrate_m6b_snooze.py
"""
import sqlite3, os

DB_PATH = os.getenv("HOMEMAINT_DB_PATH", "/opt/homemaint/data/homemaint.db")
conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

cur.execute("PRAGMA table_info(tasks)")
cols = [r[1] for r in cur.fetchall()]

if "snoozed_until" not in cols:
    print("Adding snoozed_until to tasks...")
    cur.execute("ALTER TABLE tasks ADD COLUMN snoozed_until DATE")
    conn.commit()
    print("Done.")
else:
    print("snoozed_until already exists.")

conn.close()

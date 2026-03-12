#!/usr/bin/env python3
"""
Migration: parts now belong to assets.
- Add asset_id column to parts (populated from task.asset_id)
- Make task_id nullable
- Recreate task_parts to use part_id instead of spare_id
- Migrate existing part→task relationships into task_parts
"""
import sqlite3

DB = '/opt/homemaint/data/homemaint.db'
conn = sqlite3.connect(DB)
cur = conn.cursor()

# 1. Add asset_id to parts
try:
    cur.execute("ALTER TABLE parts ADD COLUMN asset_id INTEGER REFERENCES assets(id)")
    print("+ parts.asset_id")
except Exception as e:
    print(f"~ parts.asset_id: {e}")

# 2. Populate asset_id from task's asset_id
cur.execute("""
    UPDATE parts SET asset_id = (
        SELECT tasks.asset_id FROM tasks WHERE tasks.id = parts.task_id
    ) WHERE asset_id IS NULL AND task_id IS NOT NULL
""")
print(f"  populated asset_id for {cur.rowcount} parts")

# 3. Drop and recreate task_parts with part_id
cur.execute("DROP TABLE IF EXISTS task_parts")
cur.execute("""
    CREATE TABLE task_parts (
        id       INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id  INTEGER NOT NULL REFERENCES tasks(id),
        part_id  INTEGER NOT NULL REFERENCES parts(id)
    )
""")
print("+ task_parts recreated (part_id)")

# 4. Migrate existing part→task linkage into task_parts
cur.execute("SELECT id, task_id FROM parts WHERE task_id IS NOT NULL AND asset_id IS NOT NULL")
rows = cur.fetchall()
for part_id, task_id in rows:
    cur.execute("INSERT INTO task_parts (task_id, part_id) VALUES (?, ?)", (task_id, part_id))
print(f"  migrated {len(rows)} part→task links into task_parts")

conn.commit()
conn.close()
print("Migration complete.")

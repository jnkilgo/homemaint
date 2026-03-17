#!/usr/bin/env python3
"""
M9 Migration — Add user_id to properties table, backfill to user 1.
Also adds email + auth columns to users table.

Run from /opt/homemaint:
    python3 migrate_m9.py

Safe to run multiple times (idempotent).
"""

import sqlite3
import os
import sys

DB_PATH = os.getenv("HOMEMAINT_DB_PATH", "./data/homemaint.db")

def column_exists(cursor, table, column):
    cursor.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cursor.fetchall())

def run():
    if not os.path.exists(DB_PATH):
        print(f"ERROR: DB not found at {DB_PATH}")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    changes = []

    # ── users table: add email + auth columns ─────────────────
    for col, definition in [
        ("email",               "TEXT"),
        ("is_verified",         "INTEGER NOT NULL DEFAULT 0"),
        ("verify_token",        "TEXT"),
        ("reset_token",         "TEXT"),
        ("reset_token_expires", "TEXT"),
    ]:
        if not column_exists(cur, "users", col):
            cur.execute(f"ALTER TABLE users ADD COLUMN {col} {definition}")
            changes.append(f"users.{col} added")
        else:
            changes.append(f"users.{col} already exists — skipped")

    # ── properties table: add user_id ─────────────────────────
    if not column_exists(cur, "properties", "user_id"):
        # Add nullable first (SQLite can't add NOT NULL without a default)
        cur.execute("ALTER TABLE properties ADD COLUMN user_id INTEGER REFERENCES users(id)")
        changes.append("properties.user_id added")

        # Backfill all existing properties to user 1 (justin/admin)
        cur.execute("SELECT id FROM users ORDER BY id LIMIT 1")
        row = cur.fetchone()
        if row:
            owner_id = row[0]
            cur.execute("UPDATE properties SET user_id = ? WHERE user_id IS NULL", (owner_id,))
            updated = cur.rowcount
            changes.append(f"Backfilled {updated} properties → user_id={owner_id}")
        else:
            print("WARNING: No users found — user_id left NULL. Seed the DB first.")
    else:
        changes.append("properties.user_id already exists — skipped")

    conn.commit()
    conn.close()

    print("M9 migration complete:")
    for c in changes:
        print(f"  ✓ {c}")

if __name__ == "__main__":
    run()

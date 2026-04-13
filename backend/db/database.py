"""
Simple SQLite cache so we don't hammer Rate My Professors on every request.
Cache entries expire after 7 days.
"""
import sqlite3
import json
import time
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / 'cache.db'
CACHE_TTL = 7 * 24 * 3600  # 7 days in seconds


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute('''
        CREATE TABLE IF NOT EXISTS rmp_cache (
            name     TEXT PRIMARY KEY,
            data     TEXT NOT NULL,
            cached_at INTEGER NOT NULL
        )
    ''')
    conn.commit()
    return conn


def get_cached_rmp(name: str) -> dict | None:
    with _conn() as conn:
        row = conn.execute(
            'SELECT data, cached_at FROM rmp_cache WHERE name = ?',
            (name.lower(),),
        ).fetchone()
    if row and (time.time() - row['cached_at']) < CACHE_TTL:
        return json.loads(row['data'])
    return None


def set_cached_rmp(name: str, data: dict) -> None:
    with _conn() as conn:
        conn.execute(
            'INSERT OR REPLACE INTO rmp_cache (name, data, cached_at) VALUES (?, ?, ?)',
            (name.lower(), json.dumps(data), int(time.time())),
        )

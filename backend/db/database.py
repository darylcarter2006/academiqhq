"""
Simple SQLite cache so we don't hammer Rate My Professors on every request.
Cache entries expire after 7 days.
"""
import sqlite3
import json
import time
import uuid
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
    conn.execute('''
        CREATE TABLE IF NOT EXISTS saved_schedules (
            id         TEXT PRIMARY KEY,
            user_id    TEXT NOT NULL UNIQUE,
            semester   TEXT NOT NULL,
            courses    TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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


def get_schedule(user_id: str) -> dict | None:
    with _conn() as conn:
        row = conn.execute(
            'SELECT id, user_id, semester, courses FROM saved_schedules WHERE user_id = ?',
            (user_id,),
        ).fetchone()
    if row is None:
        return None
    return {
        'id': row['id'],
        'user_id': row['user_id'],
        'semester': row['semester'],
        'courses': json.loads(row['courses']),
    }


def upsert_schedule(user_id: str, semester: str, courses: list) -> dict:
    row_id = uuid.uuid4().hex
    with _conn() as conn:
        conn.execute(
            '''
            INSERT INTO saved_schedules (id, user_id, semester, courses, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
                semester   = excluded.semester,
                courses    = excluded.courses,
                updated_at = CURRENT_TIMESTAMP
            ''',
            (row_id, user_id, semester, json.dumps(courses)),
        )
    return get_schedule(user_id)


def delete_course_from_schedule(user_id: str, crn: str) -> dict | None:
    schedule = get_schedule(user_id)
    if schedule is None:
        return None
    updated = [c for c in schedule['courses'] if str(c.get('crn')) != str(crn)]
    return upsert_schedule(user_id, schedule['semester'], updated)

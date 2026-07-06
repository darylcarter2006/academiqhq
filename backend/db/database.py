"""
RMP cache: local SQLite (cache.db, 7-day TTL) so we don't hammer Rate My
Professors on every request. Disposable — safe to delete.

Saved schedules: Supabase Postgres (saved_schedules table). Render's disk is
ephemeral, so durable user data must not live in the SQLite file. Uses the
service-role key; ownership checks happen in routes/schedule.py via JWT.
"""
import os
import sqlite3
import json
import time
import logging
from datetime import datetime, timezone
from pathlib import Path

from supabase import create_client, Client

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).parent.parent / 'cache.db'
CACHE_TTL = 7 * 24 * 3600  # 7 days in seconds

_supabase_url = os.environ.get("SUPABASE_URL", "")
_supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
_supabase_client: Client | None = None


def _get_supabase() -> Client:
    global _supabase_client
    if _supabase_client is None:
        if not _supabase_url or not _supabase_key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.")
        _supabase_client = create_client(_supabase_url, _supabase_key)
    return _supabase_client


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


def get_schedule(user_id: str) -> dict | None:
    try:
        resp = (
            _get_supabase()
            .table('saved_schedules')
            .select('id, user_id, semester, courses')
            .eq('user_id', user_id)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        logger.error("Supabase get_schedule failed for user %s: %s", user_id, exc)
        raise RuntimeError("Schedule storage is unavailable.") from exc

    if not resp.data:
        return None
    row = resp.data[0]
    # courses is a JSONB column — already deserialized by the client
    return {
        'id': row['id'],
        'user_id': row['user_id'],
        'semester': row['semester'],
        'courses': row['courses'],
    }


def upsert_schedule(user_id: str, semester: str, courses: list) -> dict:
    try:
        (
            _get_supabase()
            .table('saved_schedules')
            .upsert(
                {
                    'user_id': user_id,
                    'semester': semester,
                    'courses': courses,
                    'updated_at': datetime.now(timezone.utc).isoformat(),
                },
                on_conflict='user_id',
            )
            .execute()
        )
    except Exception as exc:
        logger.error("Supabase upsert_schedule failed for user %s: %s", user_id, exc)
        raise RuntimeError("Schedule storage is unavailable.") from exc

    return get_schedule(user_id)


def delete_course_from_schedule(user_id: str, crn: str) -> dict | None:
    schedule = get_schedule(user_id)
    if schedule is None:
        return None
    updated = [c for c in schedule['courses'] if str(c.get('crn')) != str(crn)]
    return upsert_schedule(user_id, schedule['semester'], updated)

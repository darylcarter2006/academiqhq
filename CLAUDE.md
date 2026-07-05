# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the app

Two processes must run simultaneously:

```bash
# Terminal 1 — backend (from repo root)
cd backend && venv/bin/uvicorn main:app --reload

# Terminal 2 — frontend (from repo root)
cd frontend && npm run dev
```

Frontend dev server: `http://localhost:5173`  
Backend API: `http://localhost:8000`  
Vite proxies `/api/*` → `localhost:8000` automatically.

```bash
# Production frontend build
cd frontend && npm run build   # output goes to frontend/dist/
```

## API key setup

Copy `backend/.env.example` to `backend/.env` and fill in your key:

```
ANTHROPIC_API_KEY=sk-ant-...
```

`backend/.env` is gitignored. `main.py` loads it via `python-dotenv` before any other imports.

## Architecture

The main API endpoint is `POST /api/recommend`. The request body is validated by Pydantic in `routes/recommend.py`, then the call fan-out goes:

```
routes/recommend.py
  └─ scraper/banner.py      async httpx — 3-step Ellucian Banner 9 session flow
  └─ scraper/rmp.py         async GraphQL → ratemyprofessors.com
       └─ matching/fuzzy.py RapidFuzz token-sort match (Banner name → RMP name)
       └─ db/database.py    SQLite cache (cache.db, 7-day TTL) — avoid hammering RMP
  └─ ai/recommender.py      Claude claude-sonnet-4-6 ranks and writes explanations
```

**Input sanitization** (`routes/recommend.py`):
- `course_code` — regex-validated, normalized to `DEPT NNN` (e.g. `csc330` → `CSC 330`), max 20 chars
- `preferences` — HTML tags and control characters stripped, min 5 / max 500 chars

**Banner scraper** (`scraper/banner.py`):
- Base URL: `https://ssb.uncg.edu/StudentRegistrationSsb/ssb`
- Fetches the current term dynamically via `/classSearch/getTerms`; falls back to `202601`
- Caps results at 50 sections (`MAX_RESULTS`)
- Returns `[]` on any HTTP failure (caller raises 404)

**RMP scraper** (`scraper/rmp.py`):
- UNCG school ID on RMP: `1191` (Base64 node ID: `U2Nob29sLTExOTE=`)
- Uses the undocumented GraphQL endpoint; fetches top 5 candidates then fuzzy-picks the best match
- All results cached in `backend/cache.db` — delete the file to force fresh fetches

**AI ranker** (`ai/recommender.py`):
- Builds a structured prompt with all section + RMP data
- Expects Claude to return a raw JSON array (no markdown fences)
- Merges `rmp_url`, `rmp_tags`, `schedule` back from original data in case Claude drops them
- On any Claude error, falls back to original section order with `match_score: "Decent fit"`

**Schedule builder** (added on `feature/schedule-builder`):
- Routes in `routes/schedule.py`: `GET/POST /api/schedule/{user_id}` and `DELETE /api/schedule/{user_id}/course/{crn}`; all require a Supabase JWT and enforce `user_id == token sub`
- JWT verification in `auth.py`: ES256 via JWKS fetched from `SUPABASE_URL` at startup (re-fetched on unknown kid, 60 s cooldown)
- Schedules stored in the `saved_schedules` table in `cache.db` (see Notes — this file is no longer safe to delete casually)
- Frontend: React Router pages `/`, `/schedule`, `/login`, `/signup`; `useSchedule` hook is the single source of truth (guests → localStorage key `academiq_schedule` as a bare JSON array, signed-in → backend)
- Requires `SUPABASE_URL` in `backend/.env` and `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in `frontend/.env`

**Frontend** (`frontend/src/`):
- React Router SPA — routes defined in `App.jsx`, pages in `src/pages/`.
- `ProfessorCard.jsx` renders one ranked result; `LoadingSkeleton.jsx` shows a shimmer with stage messages during the ~15 s wait
- No CSS framework — all styling is inline with a dark GitHub-style palette (`#0d1117` background, `#f5a623` gold accent)

## Key constants to know

| Constant | File | Value |
|---|---|---|
| `MAX_RESULTS` | `scraper/banner.py` | 50 sections per query |
| `CACHE_TTL` | `db/database.py` | 7 days (seconds) |
| `UNCG_SCHOOL_ID` | `scraper/rmp.py` | Base64 `"School-1191"` |
| `match_score` values | `ProfessorCard.jsx` | `"Great fit"` `"Good fit"` `"Decent fit"` `"Not ideal"` |
| Preferences max | `routes/recommend.py` | 500 characters |

## Notes

- `temp-vite/` is a leftover Vite scaffold — it is not part of the app and can be ignored.
- Backend packages are installed only inside `backend/venv/`; always invoke Python as `venv/bin/python` or `venv/bin/uvicorn` from the `backend/` directory.
- The SQLite file (`backend/cache.db`) is gitignored. **Warning:** since the schedule-builder feature it holds the `saved_schedules` table (real user data) alongside the RMP cache — deleting the file wipes saved schedules too. To force fresh RMP fetches, clear only the `rmp_cache` table. On Render the filesystem is ephemeral, so saved schedules do not survive a redeploy — migrating them to Supabase Postgres is the known follow-up.
- CORS is restricted to `localhost:5173` and `localhost:4173` (Vite preview); update `main.py` before deploying.

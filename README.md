# AcademiqHQ

**AI-powered professor recommendations and schedule building for UNCG students.**

Enter a course code, describe what matters to you — easy grader, engaging lectures, flexible deadlines — and get a ranked list of every professor teaching that course, scored against your preferences using real Rate My Professors data and Claude AI. Add any section straight to a visual weekly schedule, as a guest or a signed-in user.

**Live at [academiqhq.com](https://academiqhq.com)**

---

![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.135-009688?style=flat-square&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![React Router](https://img.shields.io/badge/React_Router-7-CA4245?style=flat-square&logo=reactrouter&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Auth_%2B_Postgres-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Claude](https://img.shields.io/badge/Claude-Sonnet_4.6-D97757?style=flat-square)
![Render](https://img.shields.io/badge/Render-Backend-46E3B7?style=flat-square&logo=render&logoColor=black)
![Vercel](https://img.shields.io/badge/Vercel-Frontend-000000?style=flat-square&logo=vercel&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)

---

## What It Does

Most students pick professors by scrolling Rate My Professors and hoping for the best, then juggle sections by hand to build a schedule that doesn't conflict. AcademiqHQ handles both:

1. Scrapes live enrollment data from UNCG's Banner 9 system for any course
2. Matches every instructor against Rate My Professors via GraphQL
3. Sends all rating data — overall score, difficulty, would-retake %, student tags — to Claude along with your stated preferences
4. Returns a ranked list with a personalized fit score and AI-written explanation for each professor
5. Lets you add any section to a weekly calendar in one click — as a guest (saved locally) or signed in (saved to your account), with automatic time-conflict detection

The recommendation pipeline runs in about 15 seconds. Adding a course you already know the section for skips all of that — it's a direct, free lookup against Banner with no AI cost.

---

## Features

- **Live course data** — pulls directly from UNCG Banner 9, not a cached snapshot
- **Smart name matching** — RapidFuzz handles `"Last, First"` → RMP display name, including initials, suffixes, and name changes
- **Full RMP profile per professor** — rating, difficulty, would-retake %, rating count, and top student tags
- **AI-ranked results** — Claude scores each professor against your specific preferences and writes a 2–3 sentence explanation
- **No-data handling** — professors without an RMP profile are clearly labeled rather than given a misleading score
- **Graceful degradation** — if Claude or RMP is unavailable, results still return in Banner order
- **Visual weekly schedule builder** — add any section to a Mon–Fri calendar (8 AM–9 PM), with side-by-side rendering and a badge for time conflicts (conflicts are flagged, never blocked)
- **Guest mode, no login wall** — schedules are saved to `localStorage` until you choose to create an account
- **Account sync** — sign in with email/password or Google (via Supabase Auth) to save your schedule to Postgres and access it from any device; guest schedules merge in on first sign-in
- **Manual course add** — already know the exact section you want? Look it up by course code and term with zero AI cost and add it directly, skipping the recommendation flow entirely
- **Handles multi-meeting sections** — a lecture plus a separate recitation/lab on a different day is placed correctly on every one of its meeting days
- **7-day SQLite cache** — RMP lookups are cached locally to avoid hammering the API
- **Rate limiting** — per-route limits via slowapi (5/min on the AI-ranking endpoint, 30/min on schedule and section-lookup endpoints)

---

## Architecture

```
POST /api/recommend                          GET /api/sections
        │                                            │
        ├── scraper/banner.py ◄──────────────────────┘
        │     Async httpx — 3-step Ellucian Banner 9 session flow
        │     Returns all open sections for the given course + term
        │
        ├── scraper/rmp.py  ──────────────────── db/database.py
        │     GraphQL → ratemyprofessors.com      SQLite (rmp_cache, 7-day TTL)
        │     Fetches top 5 candidates per name
        │
        ├── matching/fuzzy.py
        │     RapidFuzz token-sort ratio
        │     Normalizes Banner names to RMP display names
        │
        └── ai/recommender.py
              Claude claude-sonnet-4-6
              Receives all sections + RMP data
              Returns ranked JSON with match scores + explanations

/api/schedule/{user_id}  (GET / POST / DELETE)
        │
        ├── auth.py                 Supabase JWT verification (ES256 via JWKS)
        └── db/database.py          saved_schedules table — Supabase Postgres
                                     (not SQLite — Render's disk is ephemeral)
```

`GET /api/sections` is a lightweight, zero-AI-cost path used by the manual "add a course" flow: it calls the same Banner scraper directly and returns raw sections with no RMP lookup and no Claude ranking.

**Frontend** is a React Router SPA with four routes — `/` (search + recommendations), `/schedule` (weekly calendar), `/login`, `/signup`. A single `useSchedule` hook is the source of truth for schedule state on every page: guests read/write `localStorage`, signed-in users read/write the backend.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router 7, Vite 5, Tailwind CSS 3 |
| Backend | FastAPI, Uvicorn, Python 3.11+ |
| Auth | Supabase Auth (email/password + Google OAuth), ES256 JWT verified via JWKS |
| Schedule storage | Supabase Postgres |
| Enrollment data | UNCG Banner 9 (async httpx scraper) |
| Professor ratings | Rate My Professors (GraphQL) |
| Name matching | RapidFuzz |
| AI ranking | Anthropic Claude (claude-sonnet-4-6) |
| RMP caching | SQLite via sqlite-utils |
| Rate limiting | slowapi |
| Backend hosting | Render |
| Frontend hosting | Vercel |

---

## Screenshots

<!-- Add screenshots here -->
> *Coming soon — or visit [academiqhq.com](https://academiqhq.com) to see it live.*

---

## Running Locally

You need **Python 3.11+** and **Node.js 18+**, plus a free [Supabase](https://supabase.com) project for auth and schedule storage.

### 1. Clone the repo

```bash
git clone https://github.com/darylcarter2006/academiqhq.git
cd academiqhq
```

### 2. Set up Supabase

Create a project at [supabase.com](https://supabase.com), then run the SQL in `backend/db/supabase_schema.sql` in the Supabase SQL Editor to create the `saved_schedules` table. Grab these from **Project Settings → API**:

- Project URL
- `anon`/publishable key
- `service_role`/secret key (**backend only** — never expose this to the frontend)

### 3. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env: add your Anthropic API key, SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY

uvicorn main:app --reload
# API is now running at http://localhost:8000
```

### 4. Frontend

```bash
# In a separate terminal, from the repo root:
cd frontend
npm install

cp .env.example .env
# Edit .env: add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

npm run dev
# App is now running at http://localhost:5173
```

Vite proxies all `/api/*` requests to `localhost:8000` automatically — no CORS setup needed in development.

---

## Environment Variables

### Backend (`backend/.env`)

```env
# Required
ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Optional — overrides Banner's auto-detected current term
# Format: YYYYTT where TT is 01 (Spring), 05 (Summer), 08 (Fall)
# Example: 202608 = Fall 2026
TERM_CODE=

# Production only — comma-separated list of allowed CORS origins
ALLOWED_ORIGINS=
```

### Frontend (`frontend/.env`, and Vercel environment variables in production)

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Required in production — set in Vercel project settings
# No trailing slash. Example: https://your-backend.onrender.com
VITE_API_URL=
```

In development, `VITE_API_URL` is not needed — Vite's proxy handles it.

---

## Project Structure

```
backend/
├── main.py                      FastAPI app, CORS, rate limiting, health endpoint, JWKS startup load
├── auth.py                      Supabase JWT verification (ES256 via JWKS, auto re-fetch on rotation)
├── routes/
│   ├── recommend.py             POST /api/recommend — input validation, AI-ranked orchestration
│   ├── sections.py              GET /api/sections — raw Banner lookup, no RMP/Claude cost
│   └── schedule.py               GET/POST /api/schedule/{user_id}, DELETE .../course/{crn}
├── scraper/
│   ├── banner.py                 UNCG Banner 9 async scraper
│   └── rmp.py                    Rate My Professors GraphQL client
├── matching/
│   └── fuzzy.py                  Banner → RMP name matching (RapidFuzz)
├── ai/
│   └── recommender.py            Claude integration — ranking + explanations
├── db/
│   ├── database.py               RMP SQLite cache (7-day TTL) + Supabase Postgres schedule storage
│   └── supabase_schema.sql       saved_schedules table DDL — run once in Supabase SQL Editor
├── limiter.py                    slowapi rate limiter shared instance
└── requirements.txt

frontend/
├── src/
│   ├── App.jsx                   React Router routes: /, /schedule, /login, /signup
│   ├── pages/
│   │   ├── Home.jsx               Search + recommendations, persists last search in sessionStorage
│   │   ├── SchedulePage.jsx       Weekly calendar, manual add, merge-on-login, sign out
│   │   ├── LoginPage.jsx          Email/password + Google OAuth sign in
│   │   └── SignupPage.jsx         Account creation
│   ├── hooks/
│   │   └── useSchedule.js         Single source of truth for schedule state (guest localStorage / backend)
│   ├── components/
│   │   ├── SearchForm.jsx             Course/term/preferences inputs
│   │   ├── ProfessorCard.jsx           Ranked result card with stats + "Add to Schedule"
│   │   ├── AddToScheduleModal.jsx      Confirm-and-add modal from a recommendation
│   │   ├── ManualAddCourseModal.jsx    Look up a course/section directly, no AI cost
│   │   ├── MergeScheduleModal.jsx      Prompts to keep or discard a guest schedule on sign-in
│   │   ├── WeeklyCalendar.jsx           Mon–Fri grid, conflict badges, overlap side-by-side rendering
│   │   └── LoadingSkeleton.jsx          Animated loading state (~15s pipeline)
│   ├── utils/
│   │   └── scheduleUtils.js       Schedule-string parsing, conflict detection, calendar grid math
│   └── lib/
│       └── supabase.js            Supabase client init
├── index.html
├── tailwind.config.js
├── vite.config.js
└── vercel.json
```

---

## API

### `POST /api/recommend`

**Request**
```json
{
  "course_code": "CSC 330",
  "preferences": "Easy grader, engaging lectures, not too much homework",
  "term": "202608"
}
```

**Response**
```json
{
  "course_code": "CSC 330",
  "term": "Fall 2026",
  "professors_found": 3,
  "sections_found": 5,
  "summary": "3 professors found for CSC 330 this term.",
  "recommendations": [
    {
      "instructor_name": "Jane Smith",
      "match_score": "Great fit",
      "explanation": "Smith is known for clear explanations and fair grading...",
      "rmp_rating": 4.7,
      "rmp_difficulty": 2.1,
      "rmp_would_take_again": 94.0,
      "rmp_num_ratings": 42,
      "rmp_tags": ["Gives good feedback", "Caring", "Respected"],
      "rmp_url": "https://www.ratemyprofessors.com/professor/...",
      "section_number": "01",
      "crn": "12345",
      "schedule": "MWF 10:00 AM–10:50 AM",
      "credits": "3",
      "title": "Concepts of Object-Oriented Programming",
      "building": "Petty Building",
      "room": "150"
    }
  ]
}
```

`match_score` is one of: `"Great fit"`, `"Good fit"`, `"Decent fit"`, `"Not ideal"`.

### `GET /api/sections`

Raw Banner lookup with no RMP or Claude cost — used by the manual "add a course" flow.

**Query params:** `subject` (e.g. `CSC`), `number` (e.g. `330`), `term` (optional, defaults to the current term).

**Response**
```json
{
  "subject": "CSC",
  "number": "330",
  "term": "Fall 2026",
  "sections": [
    {
      "instructor_name": "Jane Smith",
      "section_number": "01",
      "crn": "12345",
      "schedule": "MWF 10:00 AM–10:50 AM",
      "credits": "3",
      "title": "Concepts of Object-Oriented Programming",
      "building": "Petty Building",
      "room": "150"
    }
  ]
}
```

An empty `sections` array with a `200` means the course just isn't offered that term — not an error.

### `GET /api/schedule/{user_id}` · `POST /api/schedule/{user_id}` · `DELETE /api/schedule/{user_id}/course/{crn}`

Requires `Authorization: Bearer <supabase-jwt>`. Enforces `user_id` matches the token's subject (`403` otherwise). `POST` upserts the full schedule (`semester` + up to 20 `courses`); `DELETE` removes a single course by CRN.

### `GET /api/health`

Returns `{"status": "ok"}`. Used by UptimeRobot to keep the Render instance warm.

---

## Notes

- Banner scraping is read-only and rate-limited — the scraper mimics normal browser behavior and caps results at 50 sections per query.
- The RMP GraphQL endpoint is undocumented but stable. All results are cached for 7 days to minimize requests.
- Claude receives professor data and student preferences but no personally identifiable information.
- Guest schedules live in `localStorage` as a plain JSON array under `academiq_schedule` — nothing is sent to the backend until you create an account.
- Saved schedules live in Supabase Postgres, not the local SQLite file — `backend/cache.db` holds only the disposable RMP cache and is safe to delete at any time.

---

## License

MIT — see [LICENSE](LICENSE).

---

*Built by [Daryl Carter](https://github.com/darylcarter2006) · Not affiliated with UNCG or Rate My Professors.*

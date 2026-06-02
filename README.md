# AcademiqHQ

**AI-powered professor recommendations for UNCG students.**

Enter a course code, describe what matters to you — easy grader, engaging lectures, flexible deadlines — and get a ranked list of every professor teaching that course, scored against your preferences using real Rate My Professors data and Claude AI.

**Live at [academiqhq.com](https://academiqhq.com)**

---

![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.135-009688?style=flat-square&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Claude](https://img.shields.io/badge/Claude-Sonnet_4.6-D97757?style=flat-square)
![Render](https://img.shields.io/badge/Render-Backend-46E3B7?style=flat-square&logo=render&logoColor=black)
![Vercel](https://img.shields.io/badge/Vercel-Frontend-000000?style=flat-square&logo=vercel&logoColor=white)

---

## What It Does

Most students pick professors by scrolling Rate My Professors and hoping for the best. AcademiqHQ cuts that process down to seconds:

1. Scrapes live enrollment data from UNCG's Banner 9 system for any course
2. Matches every instructor against Rate My Professors via GraphQL
3. Sends all rating data — overall score, difficulty, would-retake %, student tags — to Claude along with your stated preferences
4. Returns a ranked list with a personalized fit score and AI-written explanation for each professor

The whole pipeline runs in about 15 seconds.

---

## Features

- **Live course data** — pulls directly from UNCG Banner 9, not a cached snapshot
- **Smart name matching** — RapidFuzz handles `"Last, First"` → RMP display name, including initials, suffixes, and name changes
- **Full RMP profile per professor** — rating, difficulty, would-retake %, rating count, and top student tags
- **AI-ranked results** — Claude scores each professor against your specific preferences and writes a 2–3 sentence explanation
- **No-data handling** — professors without an RMP profile are clearly labeled rather than given a misleading score
- **Graceful degradation** — if Claude or RMP is unavailable, results still return in Banner order
- **7-day SQLite cache** — RMP lookups are cached locally to avoid hammering the API
- **Rate limiting** — 60 requests/minute per IP via slowapi

---

## Architecture

```
POST /api/recommend
        │
        ├── scraper/banner.py
        │     Async httpx — 3-step Ellucian Banner 9 session flow
        │     Returns all open sections for the given course + term
        │
        ├── scraper/rmp.py  ──────────────────── db/database.py
        │     GraphQL → ratemyprofessors.com      SQLite cache (7-day TTL)
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
```

**Frontend** is a single-page React app. All state lives in `Home.jsx` — no router, no Redux, just `fetch` against the FastAPI backend.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5, Tailwind CSS 3 |
| Backend | FastAPI, Uvicorn, Python 3.11+ |
| Enrollment data | UNCG Banner 9 (async httpx scraper) |
| Professor ratings | Rate My Professors (GraphQL) |
| Name matching | RapidFuzz |
| AI ranking | Anthropic Claude (claude-sonnet-4-6) |
| Caching | SQLite via sqlite-utils |
| Rate limiting | slowapi |
| Backend hosting | Render |
| Frontend hosting | Vercel |

---

## Screenshots

<!-- Add screenshots here -->
> *Coming soon — or visit [academiqhq.com](https://academiqhq.com) to see it live.*

---

## Running Locally

You need **Python 3.11+** and **Node.js 18+**.

### 1. Clone the repo

```bash
git clone https://github.com/darylcarter2006/Professor-recommender.git
cd Professor-recommender
```

### 2. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Create your .env file (see Environment Variables below)
cp .env.example .env
# Edit .env and add your Anthropic API key

uvicorn main:app --reload
# API is now running at http://localhost:8000
```

### 3. Frontend

```bash
# In a separate terminal, from the repo root:
cd frontend
npm install
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

# Optional — overrides Banner's auto-detected current term
# Format: YYYYTT where TT is 01 (Spring), 05 (Summer), 08 (Fall)
# Example: 202608 = Fall 2026
TERM_CODE=
```

### Frontend (Vercel environment variables)

```env
# Required in production — set in Vercel project settings
# No trailing slash. Example: https://your-backend.onrender.com
VITE_API_URL=
```

In development, `VITE_API_URL` is not needed — Vite's proxy handles it.

---

## Project Structure

```
backend/
├── main.py                  FastAPI app, CORS, rate limiting, health endpoint
├── routes/
│   └── recommend.py         POST /api/recommend — input validation, orchestration
├── scraper/
│   ├── banner.py            UNCG Banner 9 async scraper
│   └── rmp.py               Rate My Professors GraphQL client
├── matching/
│   └── fuzzy.py             Banner → RMP name matching (RapidFuzz)
├── ai/
│   └── recommender.py       Claude integration — ranking + explanations
├── db/
│   └── database.py          SQLite cache layer (7-day TTL)
├── limiter.py               slowapi rate limiter shared instance
└── requirements.txt

frontend/
├── src/
│   ├── pages/Home.jsx       Main page — all state, fetch logic, layout
│   └── components/
│       ├── SearchForm.jsx       Course/term/preferences inputs
│       ├── ProfessorCard.jsx    Ranked result card with stats
│       └── LoadingSkeleton.jsx  Animated loading state (~15s pipeline)
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
      "schedule": "MWF 10:00-10:50am"
    }
  ]
}
```

`match_score` is one of: `"Great fit"`, `"Good fit"`, `"Decent fit"`, `"Not ideal"`.

### `GET /api/health`

Returns `{"status": "ok"}`. Used by UptimeRobot to keep the Render instance warm.

---

## Notes

- Banner scraping is read-only and rate-limited — the scraper mimics normal browser behavior and caps results at 50 sections per query.
- The RMP GraphQL endpoint is undocumented but stable. All results are cached for 7 days to minimize requests.
- Claude receives professor data and student preferences but no personally identifiable information.

---

*Built by [Daryl Carter](https://github.com/darylcarter2006) · Not affiliated with UNCG or Rate My Professors.*

# UNCG Professor Recommender

Find the best professor for your UNCG course. Enter a course code, describe what matters to you, and get AI-ranked recommendations backed by live Banner enrollment data and Rate My Professors ratings.

## What it does

1. **Scrapes UNCG Banner** for all open sections of a course
2. **Looks up each instructor** on Rate My Professors (handles name variations, initials, name changes)
3. **Asks Claude** to rank the professors based on your preferences, with personalized explanations

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- An Anthropic API key

### Backend

```bash
cd backend
python -m venv venv
venv/bin/pip install -r requirements.txt

# Create your .env file
cp .env.example .env
# Edit backend/.env and add your ANTHROPIC_API_KEY
```

### Frontend

```bash
cd frontend
npm install
```

## Running

Open two terminals:

```bash
# Terminal 1 — backend
cd backend && venv/bin/uvicorn main:app --reload

# Terminal 2 — frontend
cd frontend && npm run dev
```

Open http://localhost:5173 in your browser.

## Usage

1. Enter a course code like `CSC 330` or `MAT 191`
2. Select a term (defaults to the upcoming term)
3. Describe what you're looking for — grading style, lecture quality, workload, etc.
4. Click **Find Professors**

Results show each professor's RMP rating, difficulty, would-retake percentage, and a personalized fit score with an explanation written by Claude.

## Architecture

```
POST /api/recommend
  scraper/banner.py     — Ellucian Banner 9 async scraper (3-step session flow)
  scraper/rmp.py        — Rate My Professors GraphQL client
  matching/fuzzy.py     — RapidFuzz name matching (Banner "Last, First" → RMP "First Last")
  ai/recommender.py     — Claude claude-sonnet-4-6 ranks and explains
```

- Banner instructor data requires a separate per-CRN call to `/getFacultyMeetingTimes` — fetched concurrently with `asyncio.gather`
- RMP school-filtered search is unreliable; falls back to unfiltered search filtered by school name
- Name normalization handles initials (`"Smith, J"` → matches `"John Smith"`), suffixes (Jr., Ph.D.), and name changes (different last name, exact first name match)
- Claude's output is validated and original scraped data is restored for any fields Claude may fabricate (e.g. RMP URLs)

## Project structure

```
uncg-professor-recommender/
  backend/
    main.py               FastAPI app entry point
    routes/
      recommend.py        POST /api/recommend endpoint
    scraper/
      banner.py           UNCG Banner 9 scraper
      rmp.py              Rate My Professors GraphQL client
    matching/
      fuzzy.py            Banner → RMP name matching
    ai/
      recommender.py      Claude integration
    db/
      database.py         SQLite cache (7-day TTL)
  frontend/
    src/
      pages/Home.jsx      Main page
      components/
        SearchForm.jsx     Course + preferences form
        ProfessorCard.jsx  Result card with ratings
        LoadingSkeleton.jsx Loading state
```

## Notes

- `backend/cache.db` caches RMP results for 7 days. Delete it to force fresh fetches.
- `temp-vite/` is a leftover scaffold directory and is not part of the app.
- CORS is restricted to `localhost:5173` and `localhost:4173`. Update `main.py` before deploying.

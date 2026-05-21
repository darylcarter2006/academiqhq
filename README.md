# AcademiqHQ

> Find the best professor for your UNCG course — powered by live Banner enrollment data, Rate My Professors ratings, and Claude AI.

Enter a course code. Describe what matters to you. Get a ranked list of professors with personalized explanations in seconds.

---

## How it works

```
You enter a course + preferences
        ↓
Live scrape of UNCG Banner for all open sections
        ↓
Each instructor matched against Rate My Professors
        ↓
Claude ranks them based on your preferences
        ↓
Ranked results with ratings, tags, and explanations
```

**The matching layer** normalizes Banner's `"Last, First"` format, handles initials, name changes, and falls back through progressively broader RMP searches until a confident match is found or the professor isn't on RMP.

**The AI layer** receives all section data and RMP stats, then writes a personalized fit score and explanation for each professor relative to your stated preferences.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React + Vite + Tailwind CSS |
| Backend | FastAPI (Python) |
| Enrollment data | UNCG Banner 9 (scraped) |
| Professor ratings | Rate My Professors GraphQL API |
| Name matching | RapidFuzz |
| AI ranking | Claude claude-sonnet-4-6 |

---

## Features

- Searches all open sections for any UNCG course code
- Fuzzy name matching handles initials, suffixes, and name changes
- Falls back to unfiltered RMP search when the school filter returns wrong results
- Ratings, difficulty, would-retake %, and student tags per professor
- Claude writes a 2–3 sentence personalized explanation for each match
- Graceful fallback if Claude or RMP is unavailable
- Term selector for upcoming semesters

---

## Project structure

```
backend/
  main.py               FastAPI entry point
  routes/recommend.py   POST /api/recommend
  scraper/banner.py     UNCG Banner 9 async scraper
  scraper/rmp.py        Rate My Professors GraphQL client
  matching/fuzzy.py     Banner → RMP name matching
  ai/recommender.py     Claude integration
  db/database.py        SQLite cache (7-day TTL)
frontend/
  src/pages/Home.jsx
  src/components/
    SearchForm.jsx
    ProfessorCard.jsx
    LoadingSkeleton.jsx
```

---

*Data sourced from UNCG Banner and Rate My Professors. Not affiliated with UNCG or RMP.*

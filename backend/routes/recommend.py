import re
import logging
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

from limiter import limiter

logger = logging.getLogger(__name__)
router = APIRouter()

# ---------------------------------------------------------------------------
# Input validation patterns
# ---------------------------------------------------------------------------

COURSE_RE = re.compile(r'^([A-Z]{2,4})\s?(\d{3}[A-Z]?)$')
TERM_RE = re.compile(r'^\d{6}$')
HTML_TAG_RE = re.compile(r'<[^>]+>')
CONTROL_CHAR_RE = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]')

# Valid UNCG subject codes — sourced from Banner's get_subject endpoint (Fall 2026).
# Catches typos/made-up departments before wasting a Banner round-trip.
UNCG_SUBJECTS: frozenset[str] = frozenset({
    "AAD", "ACC", "ADS", "AMS", "APD", "ARE", "ARH", "ARS", "ART", "ASL",
    "AST", "ATY", "BIO", "BLS", "BPS", "BUS", "CED", "CHE", "CRS", "CSC",
    "CSD", "CST", "CTP", "CTR", "DCE", "ECO", "ELC", "ENG", "ENS", "ENT",
    "ERM", "FIN", "FMS", "FRE", "GEN", "GER", "GES", "GRK", "GRO", "HDF",
    "HEA", "HED", "HHS", "HIS", "HSS", "HTM", "HUM", "IAN", "IAR", "IGS",
    "ISE", "ISM", "IST", "JNS", "KIN", "LAT", "LIB", "LIS", "LLC", "MAS",
    "MAT", "MBA", "MGT", "MKT", "MST", "MUE", "MUP", "MUS", "NAN", "NTR",
    "NUR", "PCS", "PHI", "PHY", "PSC", "PSY", "RCS", "REL", "SCM", "SES",
    "SOC", "SPA", "SSC", "STA", "SWK", "TED", "THR", "UNS", "VES", "VPA",
    "WGS",
})

# Prompt injection patterns — case-insensitive
_INJECTION_RE = re.compile(
    r'ignore\s+(previous|above|all)\s+(instructions?|prompts?|context)'
    r'|you\s+are\s+now\s+a'
    r'|forget\s+(everything|all|previous|prior)'
    r'|new\s+(instruction|directive|role|persona)'
    r'|system\s*prompt'
    r'|jailbreak'
    r'|\bDAN\b'
    r'|pretend\s+you\s+are'
    r'|act\s+as\s+(if\s+you\s+are|a\s+)'
    r'|disregard\s+(all|previous|prior)',
    re.IGNORECASE,
)


def _scrub_injection(text: str) -> str:
    """Remove prompt injection attempts. Raises ValueError if pattern is unambiguous."""
    if _INJECTION_RE.search(text):
        raise ValueError(
            'Your preferences contain text that looks like an instruction override. '
            'Please describe what you are looking for in a professor.'
        )
    return text


# ---------------------------------------------------------------------------
# Request model
# ---------------------------------------------------------------------------

class RecommendRequest(BaseModel):
    course_code: str = Field(..., min_length=3, max_length=20)
    preferences: str = Field(..., min_length=5, max_length=500)
    term: str | None = Field(None, description="Optional Banner term code, e.g. '202608'")

    @field_validator('course_code')
    @classmethod
    def validate_course_code(cls, v: str) -> str:
        v = v.strip().upper()
        m = COURSE_RE.match(v)
        if not m:
            raise ValueError('Invalid course code — use the format "CSC 330" or "ENG101".')
        subject = m.group(1)
        if subject not in UNCG_SUBJECTS:
            raise ValueError(
                f'"{subject}" is not a valid UNCG subject code. '
                'Check the course prefix and try again.'
            )
        return f"{subject} {m.group(2)}"

    @field_validator('term')
    @classmethod
    def validate_term(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not TERM_RE.match(v):
            raise ValueError('Term must be a 6-digit Banner code, e.g. "202608".')
        return v

    @field_validator('preferences')
    @classmethod
    def sanitize_preferences(cls, v: str) -> str:
        v = v.strip()
        v = HTML_TAG_RE.sub('', v)       # strip HTML tags
        v = CONTROL_CHAR_RE.sub('', v)   # strip control characters
        if len(v) < 5:
            raise ValueError('Please describe what you are looking for (at least 5 characters).')
        _scrub_injection(v)
        return v


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _format_schedule(section) -> str:
    if not section.meetings:
        return 'TBA'
    parts = []
    for m in section.meetings:
        if m.days and m.days != 'TBA' and m.start_time and m.start_time != 'TBA':
            parts.append(f"{m.days} {m.start_time}–{m.end_time}")
        elif m.days and m.days != 'TBA':
            parts.append(m.days)
    return ' / '.join(parts) if parts else 'TBA'


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post('/recommend')
@limiter.limit("5/minute")
async def recommend(request: Request, req: RecommendRequest):
    from scraper.banner import fetch_sections
    from matching.fuzzy import match_professor
    from ai.recommender import rank_professors

    logger.info("recommend request: course=%s term=%s", req.course_code, req.term)

    # 1. Scrape Banner for sections
    sections = await fetch_sections(req.course_code, term_code=req.term)
    if not sections:
        raise HTTPException(
            status_code=404,
            detail=f'No sections found for {req.course_code}. '
                   'Check the course code or try a different term.',
        )

    # 2. Fetch RMP data for each unique instructor
    seen: dict[str, dict] = {}
    for s in sections:
        name = s.instructor.strip()
        if name and name.upper() not in ('STAFF', 'TBA', '') and name not in seen:
            try:
                prof = await match_professor(name)
            except Exception:
                logger.warning("RMP match failed for %r", name, exc_info=True)
                prof = None

            if prof is not None:
                wta = prof.would_take_again_pct
                has_ratings = prof.num_ratings > 0
                seen[name] = {
                    'rating': prof.avg_rating if has_ratings else None,
                    'difficulty': prof.avg_difficulty if has_ratings else None,
                    'would_take_again': (wta if wta >= 0 else None) if has_ratings else None,
                    'num_ratings': prof.num_ratings,
                    'url': prof.rmp_url,
                    'tags': prof.top_tags,
                }
            else:
                seen[name] = {}

    # 3. Build professor list
    professors = []
    for s in sections:
        name = s.instructor.strip()
        if not name or name.upper() in ('STAFF', 'TBA', ''):
            continue
        rmp = seen.get(name, {})
        professors.append({
            'instructor_name': name,
            'section_number': s.section_number,
            'crn': s.crn,
            'schedule': _format_schedule(s),
            'rmp_rating': rmp.get('rating'),
            'rmp_difficulty': rmp.get('difficulty'),
            'rmp_would_take_again': rmp.get('would_take_again'),
            'rmp_num_ratings': rmp.get('num_ratings'),
            'rmp_url': rmp.get('url'),
            'rmp_tags': rmp.get('tags', []),
        })

    if not professors:
        raise HTTPException(
            status_code=404,
            detail='Sections were found but no instructors are assigned yet. '
                   'Try again closer to registration.',
        )

    # 4. Rank with Claude
    results = await rank_professors(professors, req.preferences, req.course_code)

    term = sections[0].term_desc or sections[0].term or 'Current Term'
    return {
        'course_code': req.course_code,
        'term': term,
        'sections_found': len(sections),
        'professors_found': len(results),
        'summary': results[0].get('summary') if results else None,
        'recommendations': results,
    }

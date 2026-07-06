"""
Lightweight raw-sections lookup for the manual "add a course" flow.

Unlike /api/recommend, this route does no RMP lookup and no Claude ranking —
it's a thin pass-through to the Banner scraper for students who already know
exactly which course/section they want and don't need professor ranking.
"""
import logging
from fastapi import APIRouter, HTTPException, Query, Request

from limiter import limiter
from routes.recommend import UNCG_SUBJECTS, TERM_RE, _format_schedule

logger = logging.getLogger(__name__)
router = APIRouter()

# No Claude API cost here (no RMP lookup, no ranking) — same generous
# limit as the schedule routes is appropriate, just bounding abuse rather
# than protecting a paid resource.
SECTIONS_RATE_LIMIT = "30/minute"


@router.get('/sections')
@limiter.limit(SECTIONS_RATE_LIMIT)
async def list_sections(
    request: Request,
    subject: str = Query(..., min_length=2, max_length=4),
    number: str = Query(..., min_length=3, max_length=4),
    term: str | None = Query(None),
):
    from scraper.banner import fetch_sections

    subject = subject.strip().upper()
    number = number.strip().upper()

    if not subject.isalpha():
        raise HTTPException(status_code=400, detail='Subject must be letters only, e.g. "CSC".')
    if subject not in UNCG_SUBJECTS:
        raise HTTPException(
            status_code=400,
            detail=f'"{subject}" is not a valid UNCG subject code. Check the course prefix and try again.',
        )
    if not number[:3].isdigit():
        raise HTTPException(status_code=400, detail='Course number must be 3 digits, e.g. "330".')

    if term is not None:
        term = term.strip()
        if not TERM_RE.match(term):
            raise HTTPException(status_code=400, detail='Term must be a 6-digit Banner code, e.g. "202608".')

    course_code = f"{subject} {number}"
    logger.info("sections request: course=%s term=%s", course_code, term)

    sections = await fetch_sections(course_code, term_code=term)

    results = []
    for s in sections:
        instructor_name = s.instructor.strip() or 'TBA'
        results.append({
            'instructor_name': instructor_name,
            'section_number': s.section_number,
            'crn': s.crn,
            'schedule': _format_schedule(s),
            'credits': s.credits,
            'title': s.title,
            'building': s.meetings[0].building if s.meetings else '',
            'room': s.meetings[0].room if s.meetings else '',
        })

    # Empty results is a normal outcome (course not offered this term), not
    # an error — always 200.
    term_desc = sections[0].term_desc if sections else None

    return {
        'subject': subject,
        'number': number,
        'term': term_desc,
        'sections': results,
    }

import re
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

router = APIRouter()

COURSE_RE = re.compile(r'^([A-Z]{2,4})\s?(\d{3}[A-Z]?)$')
HTML_TAG_RE = re.compile(r'<[^>]+>')
CONTROL_CHAR_RE = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]')


class RecommendRequest(BaseModel):
    course_code: str = Field(..., min_length=3, max_length=20)
    preferences: str = Field(..., min_length=5, max_length=500)

    @field_validator('course_code')
    @classmethod
    def validate_course_code(cls, v: str) -> str:
        v = v.strip().upper()
        m = COURSE_RE.match(v)
        if not m:
            raise ValueError(
                'Invalid course code — use the format "CSC 330" or "MAT191".'
            )
        return f"{m.group(1)} {m.group(2)}"

    @field_validator('preferences')
    @classmethod
    def sanitize_preferences(cls, v: str) -> str:
        v = v.strip()
        v = HTML_TAG_RE.sub('', v)          # strip HTML/script tags
        v = CONTROL_CHAR_RE.sub('', v)      # strip control characters
        if len(v) < 5:
            raise ValueError('Please describe what you are looking for (at least 5 characters).')
        return v


@router.post('/recommend')
async def recommend(req: RecommendRequest):
    from scraper.banner import scrape_banner
    from scraper.rmp import get_rmp_data
    from ai.recommender import rank_professors

    # 1. Scrape Banner for sections
    sections = await scrape_banner(req.course_code)
    if not sections:
        raise HTTPException(
            status_code=404,
            detail=f'No sections found for {req.course_code}. '
                   'Check the course code or try a different term.',
        )

    # 2. Fetch RMP data for each unique instructor (deduplicated)
    seen: dict[str, dict] = {}
    for s in sections:
        name = s.get('instructor', '').strip()
        if name and name.upper() not in ('STAFF', 'TBA', '') and name not in seen:
            seen[name] = await get_rmp_data(name)

    # 3. Build professor list
    professors = []
    for s in sections:
        name = s.get('instructor', '').strip()
        if not name or name.upper() in ('STAFF', 'TBA', ''):
            continue
        rmp = seen.get(name, {})
        professors.append({
            'instructor_name': name,
            'section_number': s.get('section', ''),
            'crn': s.get('crn', ''),
            'schedule': s.get('schedule', ''),
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
            detail='Sections were found but no assigned instructors. Try again closer to registration.',
        )

    # 4. Rank with Claude
    results = await rank_professors(professors, req.preferences, req.course_code)

    term = sections[0].get('term', 'Current Term')
    return {
        'course_code': req.course_code,
        'term': term,
        'sections_found': len(sections),
        'professors_found': len(results),
        'summary': results[0].get('summary') if results else None,
        'recommendations': results,
    }

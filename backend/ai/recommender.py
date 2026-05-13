"""
Uses Claude to rank a list of professors according to student preferences.
"""
import os
import json
import anthropic

_client: anthropic.AsyncAnthropic | None = None


def _get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        api_key = os.environ.get('ANTHROPIC_API_KEY')
        if not api_key:
            raise RuntimeError(
                'ANTHROPIC_API_KEY is not set. '
                'Add it to backend/.env and restart the server.'
            )
        _client = anthropic.AsyncAnthropic(api_key=api_key)
    return _client


def _build_prompt(professors: list[dict], preferences: str, course_code: str) -> str:
    lines = [
        f'A student is looking for a professor for {course_code}.',
        f'Student preferences: "{preferences}"',
        '',
        'Here are the available sections with instructor data:',
        '',
    ]
    for i, p in enumerate(professors, 1):
        r = p.get('rmp_rating')
        d = p.get('rmp_difficulty')
        wta = p.get('rmp_would_take_again')
        n = p.get('rmp_num_ratings', 0)
        tags = ', '.join(p.get('rmp_tags') or []) or 'none'
        lines.append(
            f'{i}. {p["instructor_name"]}  |  Section {p["section_number"]}  |  CRN {p["crn"]}'
            f'  |  Schedule: {p.get("schedule") or "TBA"}'
        )
        lines.append(
            f'   RMP: rating={r if r is not None else "N/A"}/5'
            f'  difficulty={d if d is not None else "N/A"}/5'
            f'  would-retake={f"{wta}%" if wta is not None else "N/A"}'
            f'  ratings={n}  tags=[{tags}]'
        )
        lines.append('')

    lines += [
        'Rank ALL professors from best to worst match for this student.',
        'For each professor return a JSON object with these exact keys:',
        '  instructor_name, section_number, crn, schedule,',
        '  rmp_rating, rmp_difficulty, rmp_would_take_again, rmp_num_ratings, rmp_url,',
        '  match_score (one of: "Great fit", "Good fit", "Decent fit", "Not ideal"),',
        '  explanation (2–3 sentence personalised explanation referencing the preferences).',
        'Add a "summary" key only on the FIRST object (1–2 sentence overall summary).',
        '',
        'Return ONLY a JSON array — no markdown, no code fences, no extra text.',
    ]
    return '\n'.join(lines)


async def rank_professors(
    professors: list[dict],
    preferences: str,
    course_code: str,
) -> list[dict]:
    """
    Call Claude to rank professors and return the annotated list.
    Falls back to the original order (with a generic score) on any error.
    """
    client = _get_client()
    prompt = _build_prompt(professors, preferences, course_code)

    try:
        message = await client.messages.create(
            model='claude-sonnet-4-6',
            max_tokens=2048,
            messages=[{'role': 'user', 'content': prompt}],
        )
        raw = message.content[0].text.strip()

        # Strip accidental markdown fences
        if raw.startswith('```'):
            raw = raw.split('\n', 1)[1]
            raw = raw.rsplit('```', 1)[0]

        ranked: list[dict] = json.loads(raw)
    except Exception as exc:
        import logging as _logging
        _logging.getLogger(__name__).error(f"Claude ranking failed: {exc!r}")
        # Graceful fallback: return original order without AI scoring
        for p in professors:
            p.setdefault('match_score', 'Decent fit')
            p.setdefault('explanation', 'AI ranking unavailable.')
        return professors

    # Merge any missing fields from the original data back into Claude's output
    orig_by_crn = {str(p['crn']): p for p in professors}
    for rec in ranked:
        crn = str(rec.get('crn', ''))
        orig = orig_by_crn.get(crn, {})
        # Always restore scraped fields — Claude may fabricate or alter these.
        for key in ('rmp_url', 'rmp_rating', 'rmp_difficulty',
                    'rmp_would_take_again', 'rmp_num_ratings',
                    'rmp_tags', 'schedule', 'section_number'):
            rec[key] = orig.get(key)

    return ranked

"""
Scrapes UNCG's Ellucian Banner 9 Student Registration Self-Service
to get sections for a given course code.

Banner 9 flow:
  1. GET /StudentRegistrationSsb/ssb/term/search?mode=search  → grab cookies
  2. POST /StudentRegistrationSsb/ssb/term/search             → set active term
  3. GET  /StudentRegistrationSsb/ssb/searchResults/searchResults → JSON results
"""
import asyncio
import re
from functools import lru_cache

import httpx

BASE_URL = 'https://ssb.uncg.edu/StudentRegistrationSsb/ssb'
HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 '
        '(KHTML, like Gecko) Chrome/124.0 Safari/537.36'
    ),
    'Accept': 'application/json, text/javascript, */*',
    'Referer': 'https://ssb.uncg.edu/StudentRegistrationSsb/ssb/classSearch/classSearch',
}
TIMEOUT = httpx.Timeout(30.0)
MAX_RESULTS = 50  # cap to avoid huge payloads


async def _get_latest_term(client: httpx.AsyncClient) -> str:
    """Return the most recent non-legacy term code (e.g. '202601')."""
    resp = await client.get(
        f'{BASE_URL}/classSearch/getTerms',
        params={'searchTerm': '', 'offset': 1, 'max': 15},
        headers=HEADERS,
    )
    resp.raise_for_status()
    terms = resp.json()
    # terms is [{code: '202601', description: 'Spring 2026'}, ...]
    # Pick the first (most recent) term
    return terms[0]['code'] if terms else '202601'


async def scrape_banner(course_code: str) -> list[dict]:
    """
    Return a list of section dicts for the given course_code string
    (e.g. 'CSC 330').  Returns [] on failure so callers can raise 404.
    """
    parts = course_code.strip().upper().split()
    if len(parts) != 2:
        return []
    subject, course_num = parts

    async with httpx.AsyncClient(follow_redirects=True, timeout=TIMEOUT) as client:
        # Step 1: init session / cookies
        try:
            await client.get(
                f'{BASE_URL}/term/search',
                params={'mode': 'search'},
                headers=HEADERS,
            )
        except httpx.HTTPError:
            pass  # cookies may still be set

        # Step 2: pick term
        try:
            term = await _get_latest_term(client)
        except Exception:
            term = '202601'  # fallback

        try:
            await client.post(
                f'{BASE_URL}/term/search',
                data={'term': term, 'studyPath': '', 'studyPathText': '', 'startDatepicker': '', 'endDatepicker': ''},
                headers={**HEADERS, 'Content-Type': 'application/x-www-form-urlencoded'},
            )
        except httpx.HTTPError:
            pass

        # Step 3: search results
        try:
            resp = await client.get(
                f'{BASE_URL}/searchResults/searchResults',
                params={
                    'txt_subject': subject,
                    'txt_courseNumber': course_num,
                    'txt_term': term,
                    'pageOffset': 0,
                    'pageMaxSize': MAX_RESULTS,
                    'sortColumn': 'subjectDescription',
                    'sortDirection': 'asc',
                },
                headers=HEADERS,
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception:
            return []

    raw_sections = data.get('data') or []
    sections = []
    for s in raw_sections:
        instructor = _extract_instructor(s)
        meeting = _extract_meeting(s)
        sections.append({
            'crn': str(s.get('courseReferenceNumber', '')),
            'section': s.get('sequenceNumber', ''),
            'instructor': instructor,
            'schedule': meeting,
            'term': s.get('termDesc', term),
        })
    return sections


def _extract_instructor(section: dict) -> str:
    faculty = section.get('faculty') or []
    if faculty:
        f = faculty[0]
        return f.get('displayName') or f.get('bannerId', '')
    return 'Staff'


def _extract_meeting(section: dict) -> str:
    meetings = section.get('meetingsFaculty') or []
    if not meetings:
        return ''
    m = meetings[0].get('meetingTime', {})
    days = ''.join([
        d for d, key in [
            ('M', 'monday'), ('T', 'tuesday'), ('W', 'wednesday'),
            ('R', 'thursday'), ('F', 'friday'), ('S', 'saturday'),
        ] if m.get(key)
    ])
    start = _fmt_time(m.get('beginTime', ''))
    end = _fmt_time(m.get('endTime', ''))
    if days and start:
        return f'{days} {start}–{end}'
    return m.get('meetingTypeDescription', '')


def _fmt_time(t: str) -> str:
    if not t or len(t) != 4:
        return t
    h, m = int(t[:2]), t[2:]
    suffix = 'AM' if h < 12 else 'PM'
    h = h % 12 or 12
    return f'{h}:{m} {suffix}'

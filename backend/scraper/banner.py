"""
UNCG Banner Course Scraper
==========================

Fetches course sections from UNCG's Banner system for a given course code.
Uses the Banner 9 JSON API as the primary method (fast, structured data).
Falls back to scraping the old Banner HTML page if the API is unavailable.

UNCG has two Banner systems:
  - Banner 9 (new): erp-registration.uncg.edu/StudentRegistrationSsb/
    Exposes a public JSON API at /searchResults/searchResults
  - Banner 8 (old): ssb.uncg.edu/pls/prod/bwckschd.p_disp_dyn_sched
    Classic HTML form, requires session cookies and form submission

The Banner 9 API is preferred because it returns structured JSON and is
significantly faster. The old-system fallback is plain HTTP form
submission (httpx + BeautifulSoup) — no browser automation is used
anywhere in this module.
"""

import httpx
import re
import logging
from datetime import datetime
from dataclasses import dataclass, field, asdict
from typing import Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

@dataclass
class MeetingTime:
    days: str  # e.g. "MWF", "TR", "TBA"
    start_time: str  # e.g. "10:00 AM" or "TBA"
    end_time: str  # e.g. "10:50 AM" or "TBA"
    building: str  # e.g. "PETT" or "TBA"
    room: str  # e.g. "213" or "TBA"

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class Section:
    crn: str
    course_code: str  # e.g. "CSC 339"
    section_number: str  # e.g. "01"
    title: str  # e.g. "Concepts of Object-Oriented Prog"
    instructor: str  # Raw name as Banner returns it
    meetings: list[MeetingTime] = field(default_factory=list)
    credits: str = ""
    seats_total: int = 0
    seats_taken: int = 0
    seats_available: int = 0
    waitlist_total: int = 0
    waitlist_taken: int = 0
    waitlist_available: int = 0
    term: str = ""
    term_desc: str = ""
    campus: str = ""
    instruction_method: str = ""  # e.g. "In Person", "Online", "Hybrid"

    def to_dict(self) -> dict:
        d = asdict(self)
        d["meetings"] = [m.to_dict() for m in self.meetings]
        return d


# ---------------------------------------------------------------------------
# Term detection
# ---------------------------------------------------------------------------

# UNCG term codes follow the pattern: YYYYMM
# Fall   = 08  (e.g. 202608 = Fall 2026)
# Spring = 01  (e.g. 202601 = Spring 2026)
# Summer = 05  (e.g. 202605 = Summer 2026)

TERM_MONTH_MAP = {
    "fall": "08",
    "spring": "01",
    "summer": "05",
}


def get_current_term_code() -> str:
    """
    Determine the current/upcoming term code based on today's date.

    Logic:
      - Jan 1 through May 15:  current Spring term (same year)
      - May 16 through Jul 31: current Summer term (same year)
      - Aug 1 through Dec 31:  current Fall term (same year)

    During registration periods (roughly Nov-Dec for Spring, Mar-Apr for Fall),
    students are looking ahead. We handle this by also checking if we're in a
    registration window and bumping to the next term if appropriate.

    For simplicity, we pick the term that students are most likely searching
    for right now. If it's late in a term (close to finals), we bias toward
    the next term.
    """
    now = datetime.now()
    month = now.month
    year = now.year

    if 1 <= month <= 4:
        return f"{year}01"  # Spring
    elif month == 5:
        # Spring semester ends late April / early May.
        # By May 1 students are registering for Summer or Fall.
        return f"{year}05"  # Summer
    elif 6 <= month <= 7:
        return f"{year}05"  # Summer
    elif 8 <= month <= 10:
        return f"{year}08"  # Fall
    elif month == 11:
        # Registration for Spring opens; bias toward next Spring.
        return f"{year + 1}01"
    else:
        # December: same.
        return f"{year + 1}01"


def term_code_to_description(term_code: str) -> str:
    """Convert a term code like '202608' to 'Fall 2026'."""
    year = term_code[:4]
    month = term_code[4:]
    season_map = {"01": "Spring", "05": "Summer", "08": "Fall"}
    season = season_map.get(month, "Unknown")
    return f"{season} {year}"


# ---------------------------------------------------------------------------
# Banner 9 JSON API (primary method)
# ---------------------------------------------------------------------------

BANNER9_BASE = "https://erp-registration.uncg.edu/StudentRegistrationSsb/ssb"

# The class search page URL (needed to establish a session)
BANNER9_SEARCH_PAGE = f"{BANNER9_BASE}/classSearch/classSearch"

# The term selection endpoint (sets the term in the session)
BANNER9_SET_TERM = f"{BANNER9_BASE}/term/search?mode=search"

# The search results endpoint (returns JSON)
BANNER9_SEARCH_RESULTS = f"{BANNER9_BASE}/searchResults/searchResults"

# Reset the data form (clears previous search state in the session)
BANNER9_RESET = f"{BANNER9_BASE}/classSearch/resetDataForm"

# Per-CRN faculty + meeting times (instructor names only available here)
BANNER9_FACULTY_MEETINGS = f"{BANNER9_BASE}/searchResults/getFacultyMeetingTimes"

# Get available terms
BANNER9_GET_TERMS = f"{BANNER9_BASE}/classSearch/getTerms"


def _parse_course_code(course_code: str) -> tuple[str, str]:
    """
    Parse a course code like 'CSC 339' or 'CSC339' into ('CSC', '339').
    Handles formats: 'CSC 339', 'CSC339', 'csc 339', 'CSC-339'.
    """
    course_code = course_code.strip().upper()
    # Try splitting on space, dash, or the boundary between letters and digits
    match = re.match(r"^([A-Z]+)[\s\-]?(\d+[A-Z]?)$", course_code)
    if not match:
        raise ValueError(
            f"Invalid course code format: '{course_code}'. "
            f"Expected format like 'CSC 339' or 'CSC339'."
        )
    return match.group(1), match.group(2)


def _parse_meeting_times_api(
    faculty: list[dict],
    meetings_faculty: list[dict],
) -> tuple[str, list[MeetingTime]]:
    """
    Extract instructor name and meeting times from Banner 9 API response.

    Banner 9 puts instructor data in two places depending on the deployment:
      - top-level `faculty[].displayName`  (sometimes empty at UNCG)
      - `meetingsFaculty[].faculty[].displayName`  (always populated)
    Meeting times are always in `meetingsFaculty[].meetingTime`.
    We check both sources so neither alone is a single point of failure.
    """
    instructor = "TBA"
    meetings = []

    # 1. Try the top-level faculty list first.
    for entry in faculty:
        display_name = (entry.get("displayName") or "").strip()
        if display_name and display_name.upper() not in ("TBA", "STAFF", ""):
            instructor = display_name
            break

    # 2. Walk meetingsFaculty for meeting times AND as a fallback for the name.
    day_map = [
        ("monday", "M"),
        ("tuesday", "T"),
        ("wednesday", "W"),
        ("thursday", "R"),
        ("friday", "F"),
        ("saturday", "S"),
        ("sunday", "U"),
    ]

    for entry in meetings_faculty:
        # Fallback instructor from nested faculty list
        if instructor == "TBA":
            for fac in entry.get("faculty", []):
                display_name = (fac.get("displayName") or "").strip()
                if display_name and display_name.upper() not in ("TBA", "STAFF", ""):
                    instructor = display_name
                    break

        # Meeting time
        meeting_time = entry.get("meetingTime", {})
        if not meeting_time:
            continue

        days = "".join(letter for key, letter in day_map if meeting_time.get(key, False))
        if not days:
            days = "TBA"

        begin = meeting_time.get("beginTime", "")
        end = meeting_time.get("endTime", "")
        start_time = _format_time(begin) if begin else "TBA"
        end_time = _format_time(end) if end else "TBA"

        building = (
            meeting_time.get("buildingDescription")
            or meeting_time.get("building")
            or "TBA"
        )
        room = meeting_time.get("room") or "TBA"

        meetings.append(MeetingTime(
            days=days,
            start_time=start_time,
            end_time=end_time,
            building=building,
            room=room,
        ))

    return instructor, meetings


def _format_time(time_str: str) -> str:
    """Convert '1300' or '0900' military time to '1:00 PM' or '9:00 AM'."""
    if not time_str or len(time_str) != 4:
        return time_str or "TBA"
    try:
        hour = int(time_str[:2])
        minute = time_str[2:]
        period = "AM" if hour < 12 else "PM"
        if hour == 0:
            hour = 12
        elif hour > 12:
            hour -= 12
        return f"{hour}:{minute} {period}"
    except ValueError:
        return time_str


async def fetch_sections_api(
    course_code: str,
    term_code: Optional[str] = None,
) -> list[Section]:
    """
    Fetch course sections using UNCG's Banner 9 JSON API.

    This is the preferred method. It requires:
    1. Hit the class search page to get a session cookie
    2. POST to the term selection endpoint to set the term
    3. GET the search results with subject and course number params

    Args:
        course_code: Course code like 'CSC 339'
        term_code: Banner term code like '202608'. Auto-detected if None.

    Returns:
        List of Section objects with all available data.

    Raises:
        BannerAPIError: If the API request fails or returns unexpected data.
    """
    subject, course_number = _parse_course_code(course_code)

    if term_code is None:
        term_code = get_current_term_code()

    term_desc = term_code_to_description(term_code)
    logger.info(f"Fetching sections for {subject} {course_number} in {term_desc} ({term_code})")

    sections = []

    async with httpx.AsyncClient(
        follow_redirects=True,
        timeout=30.0,
        headers={
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                          "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json, text/javascript, */*; q=0.01",
        },
    ) as client:
        # Step 1: Hit the search page to establish a session
        logger.debug("Establishing session with class search page...")
        resp = await client.get(BANNER9_SEARCH_PAGE)
        resp.raise_for_status()

        # Step 2: Set the term in the session
        logger.debug(f"Setting term to {term_code}...")
        resp = await client.post(
            BANNER9_SET_TERM,
            data={"term": term_code},
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "X-Requested-With": "XMLHttpRequest",
            },
        )
        resp.raise_for_status()

        # Step 3: Reset any previous search state
        logger.debug("Resetting search form...")
        await client.post(
            BANNER9_RESET,
            headers={"X-Requested-With": "XMLHttpRequest"},
        )

        # Step 4: Search for sections
        logger.debug(f"Searching for {subject} {course_number}...")
        params = {
            "txt_subject": subject,
            "txt_courseNumber": course_number,
            "txt_term": term_code,
            "startDatepicker": "",
            "endDatepicker": "",
            "pageOffset": "0",
            "pageMaxSize": "50",  # Should be more than enough for any single course
            "sortColumn": "subjectDescription",
            "sortDirection": "asc",
        }

        resp = await client.get(
            BANNER9_SEARCH_RESULTS,
            params=params,
            headers={"X-Requested-With": "XMLHttpRequest"},
        )
        resp.raise_for_status()

        data = resp.json()

        # The API returns {"success": true, "totalCount": N, "data": [...]}
        if not data.get("success", False):
            logger.warning(f"Banner API returned success=false: {data}")
            return []

        results = data.get("data", [])
        total = data.get("totalCount", 0)
        logger.info(f"Found {total} section(s) for {subject} {course_number}")

        # Build sections with basic info first (no instructor yet)
        raw_sections = []
        for item in results:
            credit_low = item.get("creditHourLow", 0) or 0
            credit_high = item.get("creditHourHigh", 0)
            if credit_high and credit_high != credit_low:
                credits = f"{int(credit_low)}-{int(credit_high)}"
            else:
                credits = str(int(credit_low)) if credit_low else ""

            raw_sections.append({
                "crn": str(item.get("courseReferenceNumber", "")),
                "course_code": f"{item.get('subject', subject)} {item.get('courseNumber', course_number)}",
                "section_number": item.get("sequenceNumber", ""),
                "title": item.get("courseTitle", ""),
                "credits": credits,
                "seats_total": item.get("maximumEnrollment", 0) or 0,
                "seats_taken": item.get("enrollment", 0) or 0,
                "seats_available": item.get("seatsAvailable", 0) or 0,
                "waitlist_total": item.get("waitCapacity", 0) or 0,
                "waitlist_taken": item.get("waitCount", 0) or 0,
                "waitlist_available": item.get("waitAvailable", 0) or 0,
                "campus": item.get("campusDescription", ""),
                "instruction_method": item.get("instructionalMethodDescription", ""),
            })

        # Fetch instructor + meeting times per CRN concurrently.
        # The search results endpoint never populates faculty[]; the data
        # is only available via getFacultyMeetingTimes.
        # Semaphore caps concurrent requests to Banner at 5 to avoid
        # flooding UNCG's servers when a course has many sections.
        import asyncio as _asyncio

        _sem = _asyncio.Semaphore(5)

        async def _fetch_fmt(crn: str):
            async with _sem:
                try:
                    r = await client.get(
                        BANNER9_FACULTY_MEETINGS,
                        params={"term": term_code, "courseReferenceNumber": crn},
                        headers={"X-Requested-With": "XMLHttpRequest"},
                    )
                    r.raise_for_status()
                    fmt_list = r.json().get("fmt", [])
                    return crn, _parse_meeting_times_api([], fmt_list)
                except Exception as exc:
                    logger.warning(f"getFacultyMeetingTimes failed for CRN {crn}: {exc}")
                    return crn, ("TBA", [])

        fmt_results = await _asyncio.gather(
            *[_fetch_fmt(s["crn"]) for s in raw_sections]
        )
        fmt_by_crn = dict(fmt_results)

        for s in raw_sections:
            instructor, meetings = fmt_by_crn.get(s["crn"], ("TBA", []))
            sections.append(Section(
                crn=s["crn"],
                course_code=s["course_code"],
                section_number=s["section_number"],
                title=s["title"],
                instructor=instructor,
                meetings=meetings,
                credits=s["credits"],
                seats_total=s["seats_total"],
                seats_taken=s["seats_taken"],
                seats_available=s["seats_available"],
                waitlist_total=s["waitlist_total"],
                waitlist_taken=s["waitlist_taken"],
                waitlist_available=s["waitlist_available"],
                term=term_code,
                term_desc=term_desc,
                campus=s["campus"],
                instruction_method=s["instruction_method"],
            ))

    return sections


# ---------------------------------------------------------------------------
# Old Banner HTML scraper (fallback)
# ---------------------------------------------------------------------------

OLD_BANNER_BASE = "https://ssb.uncg.edu/pls/prod"
OLD_BANNER_SCHEDULE_URL = f"{OLD_BANNER_BASE}/bwckschd.p_disp_dyn_sched"
OLD_BANNER_RESULTS_URL = f"{OLD_BANNER_BASE}/bwckschd.p_get_crse_unsec"


async def fetch_sections_old_banner(
    course_code: str,
    term_code: Optional[str] = None,
) -> list[Section]:
    """
    Fallback: Scrape the old Banner system (ssb.uncg.edu) for course sections.

    This uses plain HTTP requests to submit the search form and parse the
    resulting HTML. No browser automation needed for this approach either,
    since the old Banner form is a standard HTML POST.

    Args:
        course_code: Course code like 'CSC 339'
        term_code: Banner term code like '202608'. Auto-detected if None.

    Returns:
        List of Section objects parsed from the HTML response.
    """
    from bs4 import BeautifulSoup

    subject, course_number = _parse_course_code(course_code)

    if term_code is None:
        term_code = get_current_term_code()

    term_desc = term_code_to_description(term_code)
    logger.info(f"[Old Banner] Fetching {subject} {course_number} for {term_desc}")

    async with httpx.AsyncClient(
        follow_redirects=True,
        timeout=30.0,
        headers={
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                          "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
    ) as client:
        # Submit the search form via POST
        form_data = {
            "term_in": term_code,
            "sel_subj": ["dummy", subject],
            "sel_day": "dummy",
            "sel_schd": ["dummy", "%"],
            "sel_insm": ["dummy", "%"],
            "sel_camp": ["dummy", "%"],
            "sel_levl": ["dummy", "%"],
            "sel_sess": "dummy",
            "sel_instr": ["dummy", "%"],
            "sel_ptrm": ["dummy", "%"],
            "sel_attr": ["dummy", "%"],
            "sel_crse": course_number,
            "sel_title": "",
            "sel_from_cred": "",
            "sel_to_cred": "",
            "begin_hh": "0",
            "begin_mi": "0",
            "begin_ap": "a",
            "end_hh": "0",
            "end_mi": "0",
            "end_ap": "a",
        }

        resp = await client.post(OLD_BANNER_RESULTS_URL, data=form_data)
        resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "html.parser")
        sections = []

        # The old Banner page uses a table with class "datadisplaytable"
        # Each section has a header row (with CRN, title, etc.) followed
        # by a data row (with meeting times, instructor, etc.)
        headers = soup.find_all("th", class_="ddtitle")

        for header in headers:
            link = header.find("a")
            if not link:
                continue

            # Parse the header text: "Course Title - CRN - SUBJ CRSE - Section"
            header_text = link.get_text(strip=True)
            parts = header_text.split(" - ")
            if len(parts) < 4:
                continue

            title = parts[0].strip()
            crn = parts[1].strip()
            # parts[2] is like "CSC 339"
            section_number = parts[3].strip()

            # Find the next sibling table that contains the details
            detail_table = header.find_parent("table")
            if not detail_table:
                continue

            # Find the next table after this header's table
            next_table = detail_table.find_next_sibling("table", class_="datadisplaytable")
            if not next_table:
                # Sometimes the details are in a nested table
                next_table = header.find_next("table", class_="datadisplaytable")

            instructor_name = "TBA"
            meeting_list = []
            seats_info = {"total": 0, "taken": 0, "available": 0}

            if next_table:
                # Look for instructor in the detail rows
                rows = next_table.find_all("tr")
                for row in rows:
                    cells = row.find_all("td", class_="dddefault")
                    if len(cells) >= 7:
                        # Typical layout: Type | Time | Days | Where | Date Range | Schedule Type | Instructors
                        time_cell = cells[1].get_text(strip=True)
                        days_cell = cells[2].get_text(strip=True)
                        where_cell = cells[3].get_text(strip=True)
                        instructor_cell = cells[6].get_text(strip=True) if len(cells) > 6 else "TBA"

                        if instructor_cell and instructor_cell != "TBA":
                            # Clean up instructor name (remove "(P)" primary indicator)
                            instructor_name = re.sub(r"\s*\(P\)\s*", "", instructor_cell).strip()

                        # Parse time
                        if time_cell and time_cell != "TBA":
                            time_parts = time_cell.split(" - ")
                            start_time = time_parts[0].strip() if len(time_parts) > 0 else "TBA"
                            end_time = time_parts[1].strip() if len(time_parts) > 1 else "TBA"
                        else:
                            start_time = "TBA"
                            end_time = "TBA"

                        days = days_cell if days_cell else "TBA"

                        # Parse building/room from "where" field
                        building = "TBA"
                        room = "TBA"
                        if where_cell and where_cell != "TBA":
                            where_parts = where_cell.rsplit(" ", 1)
                            if len(where_parts) == 2:
                                building = where_parts[0].strip()
                                room = where_parts[1].strip()
                            else:
                                building = where_cell

                        meeting_list.append(MeetingTime(
                            days=days,
                            start_time=start_time,
                            end_time=end_time,
                            building=building,
                            room=room,
                        ))

                # Look for enrollment numbers in the detail section
                detail_text = next_table.get_text()
                cap_match = re.search(r"Capacity:\s*(\d+)", detail_text)
                actual_match = re.search(r"Actual:\s*(\d+)", detail_text)
                remaining_match = re.search(r"Remaining:\s*(\d+)", detail_text)

                if cap_match:
                    seats_info["total"] = int(cap_match.group(1))
                if actual_match:
                    seats_info["taken"] = int(actual_match.group(1))
                if remaining_match:
                    seats_info["available"] = int(remaining_match.group(1))

            section = Section(
                crn=crn,
                course_code=f"{subject} {course_number}",
                section_number=section_number,
                title=title,
                instructor=instructor_name,
                meetings=meeting_list,
                credits="",  # Not always easily parseable from old Banner
                seats_total=seats_info["total"],
                seats_taken=seats_info["taken"],
                seats_available=seats_info["available"],
                term=term_code,
                term_desc=term_desc,
            )
            sections.append(section)

    return sections


# ---------------------------------------------------------------------------
# Public interface: try API first, fall back to old Banner
# ---------------------------------------------------------------------------

class BannerScrapeError(Exception):
    """Raised when both scraping methods fail."""
    pass


async def fetch_sections(
    course_code: str,
    term_code: Optional[str] = None,
) -> list[Section]:
    """
    Fetch all sections for a course from UNCG Banner.

    Tries the Banner 9 JSON API first (fast, structured).
    Falls back to scraping the old Banner HTML if that fails.

    Args:
        course_code: Course code like 'CSC 339', 'CSC339', 'csc 339'
        term_code: Optional term code. Auto-detected if not provided.

    Returns:
        List of Section objects.

    Raises:
        BannerScrapeError: If both methods fail.
        ValueError: If course_code format is invalid.
    """
    # Validate the course code format early
    _parse_course_code(course_code)

    # Try Banner 9 API first
    try:
        sections = await fetch_sections_api(course_code, term_code)
        if sections:
            logger.info(f"Banner 9 API returned {len(sections)} section(s)")
            return sections
        logger.info("Banner 9 API returned no results, trying old Banner...")
    except Exception as e:
        logger.warning(f"Banner 9 API failed: {e}. Falling back to old Banner...")

    # Fall back to old Banner
    try:
        sections = await fetch_sections_old_banner(course_code, term_code)
        if sections:
            logger.info(f"Old Banner returned {len(sections)} section(s)")
            return sections
    except Exception as e:
        logger.warning(f"Old Banner scrape also failed: {e}")

    # Both methods failed or returned empty
    logger.warning(f"No sections found for {course_code}")
    return []


# ---------------------------------------------------------------------------
# CLI for testing
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import asyncio
    import json
    import sys

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    course = sys.argv[1] if len(sys.argv) > 1 else "CSC 339"
    term = sys.argv[2] if len(sys.argv) > 2 else None

    async def main():
        print(f"\nSearching for: {course}")
        print(f"Term: {term or 'auto-detect (' + get_current_term_code() + ')'}")
        print("-" * 60)

        sections = await fetch_sections(course, term)

        if not sections:
            print("No sections found.")
            return

        for s in sections:
            print(f"\n[CRN {s.crn}] {s.course_code} - Section {s.section_number}")
            print(f"  Title:      {s.title}")
            print(f"  Instructor: {s.instructor}")
            print(f"  Credits:    {s.credits}")
            print(f"  Seats:      {s.seats_available}/{s.seats_total} available")
            if s.instruction_method:
                print(f"  Method:     {s.instruction_method}")
            for m in s.meetings:
                print(f"  Schedule:   {m.days} {m.start_time} - {m.end_time}")
                print(f"  Location:   {m.building} {m.room}")

        # Also dump as JSON for debugging
        print("\n" + "=" * 60)
        print("JSON output:")
        print(json.dumps([s.to_dict() for s in sections], indent=2))

    asyncio.run(main())
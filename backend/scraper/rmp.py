"""
Rate My Professors GraphQL API Client
======================================

Fetches professor data from RateMyProfessors.com using their public
GraphQL API at https://www.ratemyprofessors.com/graphql.

The API requires:
  - An Authorization header with a static Basic token
  - Standard GraphQL POST requests with query + variables

UNCG's RMP school ID (base64-encoded): U2Nob29sLTEyNDQ=
  This decodes to "School-1244" (UNCG's numeric RMP ID is 1244)

Data we pull for each professor:
  - Overall quality rating (1-5)
  - Difficulty rating (1-5)
  - "Would take again" percentage
  - Number of ratings
  - Department
  - Top tags (e.g. "Gives good feedback", "Tough grader")
  - Individual reviews with comments, course, date, quality, difficulty
"""

import httpx
import logging
from dataclasses import dataclass, field, asdict
from typing import Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

RMP_GRAPHQL_URL = "https://www.ratemyprofessors.com/graphql"

# This auth token is embedded in RMP's frontend JavaScript bundle.
# It's a static Basic auth token, not user-specific. Every RMP scraper
# uses this same token. It's been stable for years.
RMP_AUTH_TOKEN = "Basic dGVzdDp0ZXN0"

# UNCG's school ID on RMP (base64-encoded node ID)
UNCG_SCHOOL_ID = "U2Nob29sLTEyNDQ="

# Common headers for all RMP requests
RMP_HEADERS = {
    "Authorization": RMP_AUTH_TOKEN,
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://www.ratemyprofessors.com/",
}


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

@dataclass
class Review:
    """A single student review/rating for a professor."""
    comment: str
    quality_rating: float  # 1-5, called "helpfulness" or "quality"
    difficulty_rating: float  # 1-5
    course_name: str  # e.g. "CSC339"
    date: str  # ISO date string
    thumbs_up: int = 0
    thumbs_down: int = 0
    grade: str = ""  # e.g. "A+", "B", "Not sure yet"
    is_online: bool = False
    attendance_mandatory: str = ""  # "mandatory", "non mandatory", etc.
    would_take_again: Optional[bool] = None  # "Yes"/"No"/null per review
    tags: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class ProfessorRMP:
    """Professor profile and aggregate data from RateMyProfessors."""
    rmp_id: str  # Base64-encoded node ID (e.g. "VGVhY2hlci0xMjM0NTY=")
    name: str  # Full name as listed on RMP
    first_name: str
    last_name: str
    department: str
    school: str
    avg_rating: float  # Overall quality rating, 1-5
    avg_difficulty: float  # Average difficulty, 1-5
    would_take_again_pct: float  # Percentage, 0-100 (or -1 if not enough data)
    num_ratings: int
    top_tags: list[str] = field(default_factory=list)
    reviews: list[Review] = field(default_factory=list)
    rmp_url: str = ""

    def to_dict(self) -> dict:
        d = asdict(self)
        d["reviews"] = [r.to_dict() for r in self.reviews]
        return d


# ---------------------------------------------------------------------------
# GraphQL queries
# ---------------------------------------------------------------------------

# Search for professors by name at a specific school
SEARCH_PROFESSORS_QUERY = """
query TeacherSearchQuery($query: TeacherSearchQuery!) {
  newSearch {
    teachers(query: $query) {
      edges {
        node {
          id
          legacyId
          firstName
          lastName
          department
          school {
            id
            name
          }
          avgRating
          avgDifficulty
          wouldTakeAgainPercent
          numRatings
          teacherRatingTags {
            tagName
            tagCount
          }
        }
      }
    }
  }
}
"""

# Get detailed professor info including reviews
PROFESSOR_RATINGS_QUERY = """
query TeacherRatingsPageQuery(
  $id: ID!
  $count: Int!
  $cursor: String
) {
  node(id: $id) {
    ... on Teacher {
      id
      legacyId
      firstName
      lastName
      department
      school {
        id
        name
      }
      avgRating
      avgDifficulty
      wouldTakeAgainPercent
      numRatings
      teacherRatingTags {
        tagName
        tagCount
      }
      ratings(first: $count, after: $cursor) {
        edges {
          node {
            id
            comment
            qualityRating
            difficultyRating
            class
            date
            helpfulRating
            grade
            isForOnlineClass
            attendanceMandatory
            wouldTakeAgain
            ratingTags
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
}
"""

# Autocomplete search (lighter weight, for fuzzy matching)
AUTOCOMPLETE_QUERY = """
query AutocompleteSearchQuery($query: String!) {
  autocomplete(query: $query) {
    teachers {
      edges {
        node {
          id
          legacyId
          firstName
          lastName
          department
          school {
            id
            name
          }
        }
      }
    }
  }
}
"""


# ---------------------------------------------------------------------------
# API functions
# ---------------------------------------------------------------------------

async def _graphql_request(query: str, variables: dict) -> dict:
    """
    Make a GraphQL request to RMP's API.
    Returns the parsed JSON response data.
    """
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            RMP_GRAPHQL_URL,
            headers=RMP_HEADERS,
            json={"query": query, "variables": variables},
        )
        resp.raise_for_status()
        result = resp.json()

        if "errors" in result:
            logger.error(f"RMP GraphQL errors: {result['errors']}")
            raise RMPError(f"GraphQL errors: {result['errors']}")

        return result.get("data", {})


def _parse_tags(tag_list: list[dict]) -> list[str]:
    """Extract tag names from RMP's tag format, sorted by count (most common first)."""
    if not tag_list:
        return []
    sorted_tags = sorted(tag_list, key=lambda t: t.get("tagCount", 0), reverse=True)
    return [t["tagName"] for t in sorted_tags if t.get("tagName")]


def _parse_review(node: dict) -> Review:
    """Parse a single review node from the GraphQL response."""
    # Parse per-review tags (space-separated string like "Tough grader--Lots of homework")
    raw_tags = node.get("ratingTags", "") or ""
    tags = [t.strip() for t in raw_tags.split("--") if t.strip()] if raw_tags else []

    # Parse wouldTakeAgain: RMP returns 1 (yes), 0 (no), or -1/null (not answered)
    wta_raw = node.get("wouldTakeAgain")
    if wta_raw == 1:
        would_take_again = True
    elif wta_raw == 0:
        would_take_again = False
    else:
        would_take_again = None

    return Review(
        comment=node.get("comment", "").strip(),
        quality_rating=node.get("qualityRating", 0.0),
        difficulty_rating=node.get("difficultyRating", 0.0),
        course_name=node.get("class", ""),
        date=node.get("date", ""),
        thumbs_up=node.get("helpfulRating", 0),
        thumbs_down=0,
        grade=node.get("grade", ""),
        is_online=node.get("isForOnlineClass", False),
        attendance_mandatory=node.get("attendanceMandatory", ""),
        would_take_again=would_take_again,
        tags=tags,
    )


def _build_professor(node: dict, reviews: list[Review] = None) -> ProfessorRMP:
    """Build a ProfessorRMP from a GraphQL teacher node."""
    legacy_id = node.get("legacyId", "")
    rmp_url = f"https://www.ratemyprofessors.com/professor/{legacy_id}" if legacy_id else ""

    wta_pct = node.get("wouldTakeAgainPercent", -1)
    if wta_pct is None:
        wta_pct = -1.0

    return ProfessorRMP(
        rmp_id=node.get("id", ""),
        name=f"{node.get('firstName', '')} {node.get('lastName', '')}".strip(),
        first_name=node.get("firstName", ""),
        last_name=node.get("lastName", ""),
        department=node.get("department", ""),
        school=node.get("school", {}).get("name", ""),
        avg_rating=node.get("avgRating", 0.0) or 0.0,
        avg_difficulty=node.get("avgDifficulty", 0.0) or 0.0,
        would_take_again_pct=round(wta_pct, 1),
        num_ratings=node.get("numRatings", 0),
        top_tags=_parse_tags(node.get("teacherRatingTags", [])),
        reviews=reviews or [],
        rmp_url=rmp_url,
    )


class RMPError(Exception):
    """Raised when the RMP API request fails."""
    pass


async def search_professor(
    name: str,
    school_id: str = UNCG_SCHOOL_ID,
) -> list[ProfessorRMP]:
    """
    Search for professors by name at a given school.

    Args:
        name: Professor name to search for (e.g. "Ariyawansa" or "Chandana Ariyawansa")
        school_id: Base64-encoded RMP school ID. Defaults to UNCG.

    Returns:
        List of matching ProfessorRMP objects (without individual reviews).
    """
    logger.info(f"Searching RMP for '{name}' at school {school_id}")

    variables = {
        "query": {
            "text": name,
            "schoolID": school_id,
        }
    }

    data = await _graphql_request(SEARCH_PROFESSORS_QUERY, variables)

    edges = (
        data.get("newSearch", {})
        .get("teachers", {})
        .get("edges", [])
    )

    professors = []
    for edge in edges:
        node = edge.get("node", {})
        if node:
            professors.append(_build_professor(node))

    logger.info(f"Found {len(professors)} professor(s) matching '{name}'")
    return professors


async def get_professor_with_reviews(
    professor_id: str,
    num_reviews: int = 20,
) -> Optional[ProfessorRMP]:
    """
    Fetch a professor's full profile including individual reviews.

    Args:
        professor_id: Base64-encoded RMP node ID (e.g. "VGVhY2hlci0xMjM0NTY=")
        num_reviews: Maximum number of reviews to fetch (default 20).
                     RMP paginates reviews, so this fetches the most recent ones.

    Returns:
        ProfessorRMP with reviews populated, or None if not found.
    """
    logger.info(f"Fetching professor details for {professor_id}")

    all_reviews = []
    cursor = None
    remaining = num_reviews

    while remaining > 0:
        batch_size = min(remaining, 20)  # RMP caps at 20 per page

        variables = {
            "id": professor_id,
            "count": batch_size,
        }
        if cursor:
            variables["cursor"] = cursor

        data = await _graphql_request(PROFESSOR_RATINGS_QUERY, variables)

        teacher = data.get("node", {})
        if not teacher:
            logger.warning(f"No professor found with ID {professor_id}")
            return None

        ratings = teacher.get("ratings", {})
        edges = ratings.get("edges", [])

        for edge in edges:
            review_node = edge.get("node", {})
            if review_node:
                all_reviews.append(_parse_review(review_node))

        page_info = ratings.get("pageInfo", {})
        if page_info.get("hasNextPage") and page_info.get("endCursor"):
            cursor = page_info["endCursor"]
            remaining -= len(edges)
        else:
            break

    return _build_professor(teacher, reviews=all_reviews)


async def get_professor_by_name(
    name: str,
    school_id: str = UNCG_SCHOOL_ID,
    num_reviews: int = 20,
) -> Optional[ProfessorRMP]:
    """
    Convenience function: search for a professor by name and return the
    best match with reviews.

    This searches, takes the top result, then fetches full details with
    reviews. Returns None if no match is found.

    Args:
        name: Professor name (e.g. "Ariyawansa")
        school_id: Base64-encoded RMP school ID. Defaults to UNCG.
        num_reviews: Number of reviews to fetch.

    Returns:
        ProfessorRMP with reviews, or None.
    """
    results = await search_professor(name, school_id)

    if not results:
        logger.info(f"No RMP results for '{name}'")
        return None

    # Return the first (best) match with full reviews
    best_match = results[0]
    logger.info(f"Best match: {best_match.name} ({best_match.num_ratings} ratings)")

    if best_match.num_ratings == 0:
        # No reviews to fetch, return as-is
        return best_match

    return await get_professor_with_reviews(best_match.rmp_id, num_reviews)


# ---------------------------------------------------------------------------
# CLI for testing
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import asyncio
    import json
    import sys

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    name = sys.argv[1] if len(sys.argv) > 1 else "Ariyawansa"

    async def main():
        print(f"\nSearching RMP for: {name} (UNCG)")
        print("-" * 60)

        prof = await get_professor_by_name(name)

        if not prof:
            print("No professor found.")
            return

        print(f"\n{prof.name}")
        print(f"  Department:       {prof.department}")
        print(f"  Rating:           {prof.avg_rating}/5.0")
        print(f"  Difficulty:       {prof.avg_difficulty}/5.0")
        if prof.would_take_again_pct >= 0:
            print(f"  Would Take Again: {prof.would_take_again_pct}%")
        else:
            print(f"  Would Take Again: N/A")
        print(f"  Total Ratings:    {prof.num_ratings}")
        print(f"  RMP URL:          {prof.rmp_url}")

        if prof.top_tags:
            print(f"  Top Tags:         {', '.join(prof.top_tags[:5])}")

        if prof.reviews:
            print(f"\n  --- Recent Reviews ({len(prof.reviews)}) ---")
            for i, r in enumerate(prof.reviews[:5], 1):
                print(f"\n  Review {i}: [{r.course_name}] Quality: {r.quality_rating} | Difficulty: {r.difficulty_rating}")
                if r.grade:
                    print(f"    Grade: {r.grade}")
                if r.tags:
                    print(f"    Tags: {', '.join(r.tags)}")
                # Truncate long comments
                comment = r.comment[:200] + "..." if len(r.comment) > 200 else r.comment
                print(f"    \"{comment}\"")

        # Full JSON dump
        print("\n" + "=" * 60)
        print("JSON output:")
        print(json.dumps(prof.to_dict(), indent=2))

    asyncio.run(main())
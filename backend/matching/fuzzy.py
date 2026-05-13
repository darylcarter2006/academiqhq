"""
Fuzzy Name Matching: Banner -> RMP
===================================

Links instructor names from UNCG Banner to Rate My Professors profiles.

The challenge: Banner and RMP format names differently.
  Banner might give us:  "Ariyawansa, C" or "Ariyawansa, Chandana" or "Staff"
  RMP has:               "Chandana Ariyawansa"

This module handles:
  - "Last, First" -> "First Last" normalization
  - Abbreviated first names ("C" matching "Chandana")
  - Middle initials and suffixes (Jr., III, etc.)
  - Common name variations
  - "Staff" / "TBA" detection (no real instructor assigned)
  - Caching results to avoid redundant RMP API calls

Uses rapidfuzz for fuzzy string matching with configurable thresholds.
"""

import re
import logging
from dataclasses import dataclass
from typing import Optional

from rapidfuzz import fuzz, process

from scraper.rmp import (
    ProfessorRMP,
    search_professor,
    get_professor_with_reviews,
    UNCG_SCHOOL_ID,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Name normalization
# ---------------------------------------------------------------------------

# Names that indicate no real instructor is assigned
PLACEHOLDER_NAMES = {
    "staff", "tba", "tbd", "to be announced", "to be determined",
    "instructor", "unknown", "n/a", "na", "",
}

# Suffixes to strip before matching
SUFFIXES = {"jr", "jr.", "sr", "sr.", "ii", "iii", "iv", "phd", "ph.d", "md", "m.d"}


@dataclass
class NormalizedName:
    """A normalized professor name ready for matching."""
    original: str  # Raw name from Banner
    first_name: str
    last_name: str
    full_name: str  # "First Last" format
    is_placeholder: bool  # True if name is "Staff", "TBA", etc.
    first_initial: str  # First letter of first name, for initial matching


def normalize_banner_name(raw_name: str) -> NormalizedName:
    """
    Normalize a Banner instructor name into a consistent format.

    Banner formats we handle:
      - "Ariyawansa, Chandana"       -> first="Chandana", last="Ariyawansa"
      - "Ariyawansa, C"              -> first="C", last="Ariyawansa"
      - "Ariyawansa,Chandana"        -> (no space after comma)
      - "Chandana Ariyawansa"        -> already in First Last format
      - "Ariyawansa, Chandana (P)"   -> strip (P) primary indicator
      - "Staff"                      -> placeholder
      - ""                           -> placeholder
    """
    name = raw_name.strip()

    # Strip "(P)" primary instructor marker from old Banner
    name = re.sub(r"\s*\(P\)\s*", "", name).strip()

    # Check for placeholder names
    if name.lower() in PLACEHOLDER_NAMES or not name:
        return NormalizedName(
            original=raw_name,
            first_name="",
            last_name="",
            full_name="",
            is_placeholder=True,
            first_initial="",
        )

    # Strip suffixes
    name_parts_check = name.replace(",", "").split()
    cleaned_parts = [p for p in name_parts_check if p.lower().rstrip(".") not in SUFFIXES]
    if len(cleaned_parts) < len(name_parts_check):
        # Rebuild name without suffixes, preserving comma if present
        if "," in name:
            # Re-split on comma
            comma_parts = name.split(",", 1)
            last = comma_parts[0].strip()
            rest = comma_parts[1].strip()
            rest_words = rest.split()
            rest_words = [w for w in rest_words if w.lower().rstrip(".") not in SUFFIXES]
            last_words = last.split()
            last_words = [w for w in last_words if w.lower().rstrip(".") not in SUFFIXES]
            name = f"{' '.join(last_words)}, {' '.join(rest_words)}"
        else:
            name = " ".join(cleaned_parts)

    # Parse based on comma presence
    if "," in name:
        parts = name.split(",", 1)
        last_name = parts[0].strip()
        first_name = parts[1].strip()

        # Handle "Last, First Middle" -> take just the first word as first name
        first_parts = first_name.split()
        if first_parts:
            first_name = first_parts[0]
    else:
        # Assume "First Last" or just "Last"
        parts = name.split()
        if len(parts) >= 2:
            first_name = parts[0]
            last_name = " ".join(parts[1:])
        else:
            first_name = ""
            last_name = parts[0] if parts else ""

    # Clean up
    first_name = first_name.strip().rstrip(".")
    last_name = last_name.strip()

    # Build full name in "First Last" format
    if first_name:
        full_name = f"{first_name} {last_name}"
    else:
        full_name = last_name

    first_initial = first_name[0].upper() if first_name else ""

    return NormalizedName(
        original=raw_name,
        first_name=first_name,
        last_name=last_name,
        full_name=full_name,
        is_placeholder=False,
        first_initial=first_initial,
    )


# ---------------------------------------------------------------------------
# Matching logic
# ---------------------------------------------------------------------------

# Minimum fuzzy match score (0-100) to consider a match
# Last name matching is weighted more heavily
LAST_NAME_THRESHOLD = 85
FULL_NAME_THRESHOLD = 70
INITIAL_MATCH_BONUS = 15  # Bonus when first initials match


def _score_match(banner_name: NormalizedName, rmp_prof: ProfessorRMP) -> float:
    """
    Score how well a Banner name matches an RMP professor profile.
    Returns a score from 0-100, higher is better.
    """
    banner_first = banner_name.first_name.lower()
    rmp_first = rmp_prof.first_name.lower()

    # Last name is the strongest signal
    last_score = fuzz.ratio(
        banner_name.last_name.lower(),
        rmp_prof.last_name.lower(),
    )

    # If last names don't match, reject here.
    # Name-change matching (exact first name, different last) is handled as
    # a post-processing step in match_professor(), where we can check that
    # exactly one candidate has the matching first name (uniqueness guarantee).
    if last_score < LAST_NAME_THRESHOLD:
        return 0.0

    # Check first name
    if not banner_first:
        # No first name from Banner (just last name)
        return last_score * 0.7

    if len(banner_first) == 1:
        # Banner only gave us an initial (e.g. "C" for "Chandana")
        if rmp_first and rmp_first[0] == banner_first[0]:
            return min(100, last_score + INITIAL_MATCH_BONUS)
        else:
            return last_score * 0.3

    # Full first name comparison
    first_score = fuzz.ratio(banner_first, rmp_first)
    first_partial = fuzz.partial_ratio(banner_first, rmp_first)
    first_best = max(first_score, first_partial)

    # Hard reject: both sides have full first names but they start with
    # different letters — almost certainly a different person (e.g.
    # "Sanjoy" vs "Kishalay"). partial_ratio can still score ~50 due to
    # shared substring noise, so we gate on the initial before weighting.
    if rmp_first and banner_first[0] != rmp_first[0]:
        first_best *= 0.4

    # Weighted combination: last name matters more
    combined = (last_score * 0.6) + (first_best * 0.4)

    # Small bonus when initials agree
    if rmp_first and banner_first[0] == rmp_first[0]:
        combined = min(100, combined + 5)

    return combined


# School name fragment used to identify UNCG profiles in unfiltered searches
_UNCG_SCHOOL_FRAGMENT = "greensboro"


async def match_professor(
    banner_name: str,
    school_id: str = UNCG_SCHOOL_ID,
    num_reviews: int = 20,
    threshold: float = FULL_NAME_THRESHOLD,
) -> Optional[ProfessorRMP]:
    """
    Given a Banner instructor name, find and return the best matching
    RMP professor profile with reviews.

    Tries up to four search strategies, stopping as soon as a candidate
    scores above threshold. This avoids false positives from the RMP school
    filter returning professors from other schools with the same first/last name.

      1. Full name + school filter
      2. Last name + school filter
      3. Full name, unfiltered — keep only UNCG results
      4. Last name, unfiltered — keep only UNCG results
    """
    normalized = normalize_banner_name(banner_name)

    if normalized.is_placeholder:
        logger.info(f"Skipping placeholder name: '{banner_name}'")
        return None

    logger.info(f"Matching '{banner_name}' -> normalized: '{normalized.full_name}'")

    search_term = normalized.full_name if len(normalized.first_name) > 1 else normalized.last_name
    last_name = normalized.last_name

    # Build ordered strategies, deduplicating when search_term == last_name
    strategies: list[tuple[str, str | None]] = []
    seen_strats: set[tuple[str, str | None]] = set()
    for term, sid in [
        (search_term, school_id),
        (last_name, school_id),
        (search_term, None),
        (last_name, None),
    ]:
        key = (term, sid)
        if key not in seen_strats:
            strategies.append(key)
            seen_strats.add(key)

    all_candidates: list[ProfessorRMP] = []
    seen_ids: set[str] = set()
    scored: list[tuple[float, ProfessorRMP]] = []

    for term, sid in strategies:
        try:
            results = await search_professor(term, sid)
        except Exception as e:
            logger.warning(f"RMP search '{term}' (school={sid}) failed: {e}")
            continue

        # For unfiltered searches, restrict to UNCG by school name
        if sid is None:
            results = [p for p in results if _UNCG_SCHOOL_FRAGMENT in p.school.lower()]

        # Accumulate new candidates (dedup by RMP ID)
        for p in results:
            if p.rmp_id not in seen_ids:
                seen_ids.add(p.rmp_id)
                all_candidates.append(p)

        # Score all accumulated candidates and stop if we have a match
        scored = [
            (s, p) for p in all_candidates
            if (s := _score_match(normalized, p)) >= threshold
        ]
        if scored:
            logger.debug(
                f"Found {len(scored)} match(es) after searching '{term}' "
                f"(school={'filtered' if sid else 'unfiltered'})"
            )
            break

    if not scored:
        # Name-change fallback: professor may be listed under a different last name on RMP
        # (marriage, divorce, etc.). Only apply when exactly ONE candidate has a matching
        # first name — uniqueness prevents false positives from common names (e.g. "Martin").
        if len(normalized.first_name) > 2:
            name_change_candidates = [
                p for p in all_candidates
                if normalized.first_name.lower() == p.first_name.lower()
                and fuzz.ratio(normalized.last_name.lower(), p.last_name.lower()) < LAST_NAME_THRESHOLD
            ]
            if len(name_change_candidates) == 1:
                nc = name_change_candidates[0]
                logger.info(
                    f"Name-change match: '{banner_name}' -> {nc.name} "
                    f"(exact first name, different last — likely name change)"
                )
                scored = [(72.0, nc)]
            else:
                logger.info(
                    f"No RMP match above threshold ({threshold}) for '{banner_name}'. "
                    f"Best candidates: {[p.name for p in all_candidates[:3]]}"
                )
                return None
        else:
            logger.info(
                f"No RMP match above threshold ({threshold}) for '{banner_name}'. "
                f"Best candidates: {[p.name for p in all_candidates[:3]]}"
            )
            return None

    # Sort by score descending, take the best match
    scored.sort(key=lambda x: x[0], reverse=True)
    best_score, best_prof = scored[0]

    logger.info(f"Best match: {best_prof.name} (score={best_score:.1f})")

    # Fetch full details with reviews
    if best_prof.num_ratings > 0:
        try:
            full_prof = await get_professor_with_reviews(best_prof.rmp_id, num_reviews)
            if full_prof:
                return full_prof
        except Exception as e:
            logger.error(f"Failed to fetch reviews for {best_prof.name}: {e}")

    # Return without reviews if we couldn't fetch them
    return best_prof


async def match_professors_batch(
    banner_names: list[str],
    school_id: str = UNCG_SCHOOL_ID,
    num_reviews: int = 20,
) -> dict[str, Optional[ProfessorRMP]]:
    """
    Match multiple Banner instructor names to RMP profiles.

    Deduplicates names so we don't search for the same professor twice.

    Args:
        banner_names: List of raw instructor names from Banner
        school_id: RMP school ID
        num_reviews: Number of reviews to fetch per professor

    Returns:
        Dict mapping each banner_name to its matched ProfessorRMP (or None).
    """
    results: dict[str, Optional[ProfessorRMP]] = {}
    seen: dict[str, Optional[ProfessorRMP]] = {}  # Cache by normalized last name

    for name in banner_names:
        normalized = normalize_banner_name(name)

        if normalized.is_placeholder:
            results[name] = None
            continue

        # Check cache by last name to avoid duplicate searches
        cache_key = normalized.last_name.lower()
        if cache_key in seen:
            results[name] = seen[cache_key]
            logger.info(f"Cache hit for '{name}' -> {seen[cache_key].name if seen[cache_key] else 'None'}")
            continue

        # Perform the match
        prof = await match_professor(name, school_id, num_reviews)
        results[name] = prof
        seen[cache_key] = prof

    return results


# ---------------------------------------------------------------------------
# CLI for testing
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import asyncio
    import json
    import sys

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    # Test name normalization
    test_names = [
        "Ariyawansa, Chandana",
        "Ariyawansa, C",
        "Staff",
        "TBA",
        "Smith, John (P)",
        "Johnson, Mary Jane",
        "O'Brien, Patrick Jr.",
        "",
    ]

    print("=== Name Normalization Tests ===")
    for name in test_names:
        n = normalize_banner_name(name)
        if n.is_placeholder:
            print(f"  '{name}' -> [PLACEHOLDER]")
        else:
            print(f"  '{name}' -> first='{n.first_name}' last='{n.last_name}' full='{n.full_name}'")

    # If a name is provided as CLI arg, try matching against RMP
    if len(sys.argv) > 1:
        name = sys.argv[1]
        print(f"\n=== RMP Matching for '{name}' ===")

        async def main():
            prof = await match_professor(name)
            if prof:
                print(f"  Matched: {prof.name}")
                print(f"  Rating: {prof.avg_rating}/5.0")
                print(f"  Reviews: {len(prof.reviews)}")
                print(json.dumps(prof.to_dict(), indent=2))
            else:
                print("  No match found.")

        asyncio.run(main())
    else:
        print("\nPass a name as CLI arg to test RMP matching.")
        print("  Example: python -m backend.matching.fuzzy 'Ariyawansa, Chandana'")
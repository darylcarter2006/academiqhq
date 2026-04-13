"""
Fuzzy-match a Banner instructor name against an RMP candidate name.
Returns True if the names are close enough to be the same person.
"""
from rapidfuzz import fuzz


def normalize(name: str) -> str:
    """Lower-case, strip punctuation, collapse whitespace."""
    import re
    name = name.lower()
    name = re.sub(r'[^a-z\s]', '', name)
    return ' '.join(name.split())


def names_match(banner_name: str, rmp_name: str, threshold: int = 82) -> bool:
    """
    Return True if banner_name and rmp_name likely refer to the same person.
    Uses token-sort ratio so "Smith John" matches "John Smith".
    """
    a = normalize(banner_name)
    b = normalize(rmp_name)
    score = fuzz.token_sort_ratio(a, b)
    return score >= threshold


def best_match(banner_name: str, candidates: list[str], threshold: int = 82) -> str | None:
    """Return the best-matching candidate name, or None if nothing clears the threshold."""
    from rapidfuzz import process
    result = process.extractOne(
        normalize(banner_name),
        [normalize(c) for c in candidates],
        scorer=fuzz.token_sort_ratio,
    )
    if result and result[1] >= threshold:
        idx = result[2]
        return candidates[idx]
    return None

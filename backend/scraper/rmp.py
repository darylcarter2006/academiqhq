"""
Fetches professor data from Rate My Professors via their GraphQL API.
Results are cached in SQLite to avoid hammering RMP.
"""
import httpx
from matching.fuzzy import best_match
from db.database import get_cached_rmp, set_cached_rmp

RMP_GQL = 'https://www.ratemyprofessors.com/graphql'
UNCG_SCHOOL_ID = 'U2Nob29sLTExOTE='   # Base64 of "School-1191" (UNCG's RMP school ID)

HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 '
        '(KHTML, like Gecko) Chrome/124.0 Safari/537.36'
    ),
    'Content-Type': 'application/json',
    'Referer': 'https://www.ratemyprofessors.com/',
    'Authorization': 'Basic dGVzdDp0ZXN0',  # RMP's public basic auth token
}
TIMEOUT = httpx.Timeout(15.0)


SEARCH_QUERY = '''
query TeacherSearchQuery($text: String!, $schoolID: ID!) {
  newSearch {
    teachers(query: {text: $text, schoolID: $schoolID}, first: 5) {
      edges {
        node {
          id
          firstName
          lastName
          avgRating
          avgDifficulty
          wouldTakeAgainPercent
          numRatings
          legacyId
          teacherRatingTags {
            tagName
          }
        }
      }
    }
  }
}
'''


async def get_rmp_data(instructor_name: str) -> dict:
    """
    Return RMP data dict for the given instructor name.
    Returns {} if no match found.  Uses SQLite cache.
    """
    cached = get_cached_rmp(instructor_name)
    if cached is not None:
        return cached

    result = await _fetch_rmp(instructor_name)
    set_cached_rmp(instructor_name, result)
    return result


async def _fetch_rmp(instructor_name: str) -> dict:
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(
                RMP_GQL,
                json={
                    'query': SEARCH_QUERY,
                    'variables': {
                        'text': instructor_name,
                        'schoolID': UNCG_SCHOOL_ID,
                    },
                },
                headers=HEADERS,
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception:
        return {}

    edges = (
        data.get('data', {})
            .get('newSearch', {})
            .get('teachers', {})
            .get('edges', [])
    )
    if not edges:
        return {}

    # Pick the edge whose name best matches the Banner name
    candidates = [
        f"{e['node']['firstName']} {e['node']['lastName']}"
        for e in edges
    ]
    matched_name = best_match(instructor_name, candidates)
    if not matched_name:
        return {}

    node = next(
        e['node'] for e in edges
        if f"{e['node']['firstName']} {e['node']['lastName']}" == matched_name
    )

    tags = [t['tagName'] for t in (node.get('teacherRatingTags') or [])]
    legacy_id = node.get('legacyId')

    return {
        'rating': node.get('avgRating'),
        'difficulty': node.get('avgDifficulty'),
        'would_take_again': node.get('wouldTakeAgainPercent'),
        'num_ratings': node.get('numRatings'),
        'tags': tags[:6],  # cap tags
        'url': f'https://www.ratemyprofessors.com/professor/{legacy_id}' if legacy_id else None,
    }

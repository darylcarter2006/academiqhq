import logging
from typing import Any
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field

from auth import get_current_user
from db.database import get_schedule, upsert_schedule, delete_course_from_schedule
from limiter import limiter

logger = logging.getLogger(__name__)
router = APIRouter()

# recommend.py limits at 5/minute because each call costs a Claude API
# request. These routes only do a Postgres read/write with no external API
# cost, so a much more generous per-client limit is sane — this just bounds
# abuse (e.g. a buggy frontend retry loop) rather than protecting a paid
# resource.
SCHEDULE_RATE_LIMIT = "30/minute"


class SchedulePayload(BaseModel):
    semester: str = Field(..., min_length=0, max_length=50)
    courses: list[dict[str, Any]] = Field(default_factory=list)


@router.get('/schedule/{user_id}')
@limiter.limit(SCHEDULE_RATE_LIMIT)
async def get_user_schedule(
    request: Request,
    user_id: str,
    current_user: str = Depends(get_current_user),
):
    if user_id != current_user:
        raise HTTPException(status_code=403, detail="Forbidden.")
    schedule = get_schedule(user_id)
    if schedule is None:
        return {'user_id': user_id, 'semester': '', 'courses': []}
    return schedule


@router.post('/schedule/{user_id}')
@limiter.limit(SCHEDULE_RATE_LIMIT)
async def save_user_schedule(
    request: Request,
    user_id: str,
    payload: SchedulePayload,
    current_user: str = Depends(get_current_user),
):
    if user_id != current_user:
        raise HTTPException(status_code=403, detail="Forbidden.")
    if len(payload.courses) > 20:
        raise HTTPException(status_code=400, detail="Too many courses.")
    return upsert_schedule(user_id, payload.semester, payload.courses)


@router.delete('/schedule/{user_id}/course/{crn}')
@limiter.limit(SCHEDULE_RATE_LIMIT)
async def remove_course(
    request: Request,
    user_id: str,
    crn: str,
    current_user: str = Depends(get_current_user),
):
    if user_id != current_user:
        raise HTTPException(status_code=403, detail="Forbidden.")
    updated = delete_course_from_schedule(user_id, crn)
    if updated is None:
        raise HTTPException(status_code=404, detail="Schedule not found.")
    return updated

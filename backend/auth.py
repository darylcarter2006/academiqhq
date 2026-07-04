import os
import jwt
from fastapi import Header, HTTPException

_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")


def get_current_user(authorization: str = Header(...)) -> str:
    if not _SECRET:
        raise HTTPException(status_code=503, detail="Auth not configured.")
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header.")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        # verify_aud=False is required — Supabase tokens have aud="authenticated"
        # and PyJWT raises InvalidAudienceError without this flag.
        payload = jwt.decode(
            token,
            _SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token.")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing subject.")
    return user_id

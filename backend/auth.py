import os
import json
import time
import logging
import jwt
import httpx
from fastapi import Header, HTTPException

logger = logging.getLogger(__name__)

_SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")

# kid -> (public_key_object, algorithm_string)
_PUBLIC_KEYS: dict[str, tuple] = {}

_last_jwks_fetch = 0.0
_JWKS_REFRESH_COOLDOWN = 60  # seconds — bounds Supabase hits from bad tokens


def _refresh_jwks_if_stale() -> None:
    """Re-fetch JWKS at most once per cooldown window.

    Covers a failed fetch at startup and Supabase signing-key rotation,
    neither of which should require a process restart to recover from.
    """
    global _last_jwks_fetch
    now = time.monotonic()
    if now - _last_jwks_fetch < _JWKS_REFRESH_COOLDOWN:
        return
    _last_jwks_fetch = now
    load_jwks()


def load_jwks() -> None:
    global _last_jwks_fetch
    _last_jwks_fetch = time.monotonic()
    if not _SUPABASE_URL:
        logger.warning("SUPABASE_URL not set — schedule auth will not work")
        return
    try:
        url = f"{_SUPABASE_URL}/auth/v1/.well-known/jwks.json"
        resp = httpx.get(url, timeout=10)
        resp.raise_for_status()
        for jwk in resp.json().get("keys", []):
            kid = jwk.get("kid", "default")
            alg = jwk.get("alg", "ES256")
            if alg == "ES256":
                key = jwt.algorithms.ECAlgorithm.from_jwk(json.dumps(jwk))
            elif alg == "RS256":
                key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(jwk))
            else:
                logger.warning("Unsupported JWK algorithm: %s", alg)
                continue
            _PUBLIC_KEYS[kid] = (key, alg)
            logger.info("Loaded JWKS key kid=%s alg=%s", kid, alg)
    except Exception as exc:
        logger.error("Failed to load JWKS from %s: %s", _SUPABASE_URL, exc)


def get_current_user(authorization: str = Header(...)) -> str:
    if not _PUBLIC_KEYS:
        _refresh_jwks_if_stale()
    if not _PUBLIC_KEYS:
        raise HTTPException(status_code=503, detail="Auth not configured.")
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header.")

    token = authorization.removeprefix("Bearer ").strip()

    try:
        header = jwt.get_unverified_header(token)
        kid = header.get("kid", "default")

        if kid not in _PUBLIC_KEYS:
            _refresh_jwks_if_stale()
        if kid not in _PUBLIC_KEYS:
            raise HTTPException(status_code=401, detail="Unknown token signing key.")

        public_key, alg = _PUBLIC_KEYS[kid]
        payload = jwt.decode(
            token,
            public_key,
            algorithms=[alg],
            options={"verify_aud": False},
        )
    except HTTPException:
        raise
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired.")
    except jwt.InvalidTokenError as exc:
        logger.error("JWT verification failed: %s", exc)
        raise HTTPException(status_code=401, detail="Invalid token.")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing subject.")
    return user_id

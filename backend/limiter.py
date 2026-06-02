from fastapi import Request
from slowapi import Limiter


def _get_client_ip(request: Request) -> str:
    # Render (and most reverse proxies) append the real client IP as the
    # first entry in X-Forwarded-For. Without this, every request would
    # share the proxy's IP and trigger the rate limit as one user.
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host


limiter = Limiter(key_func=_get_client_ip, default_limits=["60/minute"])

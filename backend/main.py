"""
Academiq — FastAPI backend entry point.

Environment variables:
    ANTHROPIC_API_KEY   Required. Claude API key.
    ALLOWED_ORIGINS     Comma-separated list of allowed CORS origins.
                        Defaults to localhost only.
                        Production: "https://academiqhq.com,https://www.academiqhq.com"
    PORT                HTTP port (default 8000; Railway injects this automatically).
"""

import logging
import os
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from limiter import limiter
from routes.recommend import router

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    datefmt="%H:%M:%S",
)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# CORS origins — never wildcard in production
# ---------------------------------------------------------------------------

_raw_origins = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:4173,http://127.0.0.1:5173",
)
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Academiq",
    version="1.0.0",
    docs_url=None,   # disable in production
    redoc_url=None,
    openapi_url=None,
)

# Rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["Content-Type"],
)

# ---------------------------------------------------------------------------
# Security headers + body size limit
# ---------------------------------------------------------------------------

MAX_BODY_BYTES = 8_192  # 8 KB — requests larger than this are rejected


@app.middleware("http")
async def security_middleware(request: Request, call_next):
    # Reject oversized request bodies
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_BODY_BYTES:
        return JSONResponse(status_code=413, content={"detail": "Request body too large."})

    response = await call_next(request)

    # Security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"

    return response


# ---------------------------------------------------------------------------
# Custom error handlers — never expose stack traces
# ---------------------------------------------------------------------------

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception on %s %s: %r", request.method, request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred. Please try again."},
    )


@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    return JSONResponse(status_code=404, content={"detail": "Not found."})


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

# Health endpoint must be registered before the API router so it is never
# shadowed by router-level middleware. Exempted from rate limiting so
# UptimeRobot / Render health checks never get a 429 that looks like 405.
@app.api_route("/api/health", methods=["GET", "HEAD"], include_in_schema=False)
@limiter.exempt
async def health():
    return JSONResponse({"status": "ok"})


app.include_router(router, prefix="/api")


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def startup():
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        logger.warning("ANTHROPIC_API_KEY not set — Claude ranking will fail on every request")
    else:
        logger.info("ANTHROPIC_API_KEY present (prefix: %s...)", api_key[:12])
    logger.info("Allowed CORS origins: %s", ALLOWED_ORIGINS)
    logger.info("Academiq backend started")

"""
UNCG Professor Recommender - Backend
=====================================

Main FastAPI application. Run with:
    uvicorn backend.main:app --reload --port 8000

Environment variables:
    ANTHROPIC_API_KEY   - Required. Your Claude API key.
    CACHE_TTL           - Optional. Cache TTL in seconds (default: 86400 = 24h).
    DB_PATH             - Optional. Path to SQLite cache file.
"""

import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.recommend import router

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    datefmt="%H:%M:%S",
)

# Quiet down httpx logging
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(
    title="UNCG Professor Recommender",
    description=(
        "AI-powered professor recommendations for UNCG students. "
        "Enter a course code and describe what you want in a professor. "
        "Get ranked recommendations with explanations based on Rate My Professors data."
    ),
    version="0.1.0",
)

# CORS: allow frontend origins
# In production, lock this down to your Vercel domain
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",       # Local React dev server
        "http://localhost:5173",       # Vite dev server
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        # Add your Vercel domain here when deployed:
        # "https://your-app.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routes
app.include_router(router, prefix="/api")


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def startup():
    """Initialize cache and validate configuration on startup."""
    # Check for API key
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        logger.warning(
            "ANTHROPIC_API_KEY not set. The /recommend endpoint will fail. "
            "Other endpoints (professors, health) will still work."
        )
    else:
        logger.info("Claude API key configured")

    logger.info("UNCG Professor Recommender backend started")


# ---------------------------------------------------------------------------
# Root
# ---------------------------------------------------------------------------

@app.get("/")
async def root():
    return {
        "app": "UNCG Professor Recommender",
        "version": "0.1.0",
        "docs": "/docs",
        "health": "/api/health",
    }
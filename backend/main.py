"""
UNCG Professor Recommender - Backend
=====================================

Environment variables:
    ANTHROPIC_API_KEY   - Required.
    PORT                - HTTP port (default 8000, Railway injects this automatically).
"""

import logging
import os
from pathlib import Path
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

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
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Academiq",
    version="1.0.0",
    # Disable docs in production to keep the surface clean
    docs_url="/api/docs",
    redoc_url=None,
)

# CORS — only needed for local dev (in prod the frontend is same-origin)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:4173",
        "http://127.0.0.1:5173",
        "https://academiqhq.com",
        "https://www.academiqhq.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(router, prefix="/api")

# ---------------------------------------------------------------------------
# Serve React frontend (production build)
# ---------------------------------------------------------------------------

FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"

if FRONTEND_DIST.exists():
    # Serve static assets (JS, CSS, images) from /assets and root
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        """Catch-all: serve index.html for any non-API path (SPA routing)."""
        index = FRONTEND_DIST / "index.html"
        return FileResponse(str(index))
else:
    logger.warning("Frontend dist not found — run 'npm run build' in frontend/")


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def startup():
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        logger.warning("ANTHROPIC_API_KEY not set — /api/recommend will fail")
    else:
        logger.info("Claude API key configured")
    logger.info("Academiq backend started (frontend dist: %s)", "found" if FRONTEND_DIST.exists() else "missing")

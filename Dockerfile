# ── Stage 1: build the React frontend ──────────────────────────────────────
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


# ── Stage 2: Python backend + compiled frontend ─────────────────────────────
FROM python:3.12-slim

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ ./backend/

# Copy built frontend into the location main.py expects
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Railway injects PORT; default to 8000 for local docker runs
ENV PORT=8000

WORKDIR /app/backend
CMD uvicorn main:app --host 0.0.0.0 --port $PORT

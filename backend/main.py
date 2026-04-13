import os
from dotenv import load_dotenv
load_dotenv()  # reads backend/.env into os.environ before anything else

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.recommend import router

app = FastAPI(title="UNCG Professor Recommender")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173"],
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type"],
)

app.include_router(router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}

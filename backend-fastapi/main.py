from fastapi import FastAPI
from dotenv import load_dotenv

# load environment variables from .env (optional)
load_dotenv()

from fastapi.middleware.cors import CORSMiddleware
from core.config import settings

from database.db import engine
from database.models import Base

# create tables automatically for development; in production use Alembic migrations
Base.metadata.create_all(bind=engine)

# configure basic logging
import logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

# import routers after environment/config is ready
from routes import auth, dashboard, generation, lectures, documents

app = FastAPI()

# log some settings (exclude sensitive fields)
logging.getLogger(__name__).info("app starting with config: %s", {k: v for k, v in settings.dict().items() if k != 'secret_key'})

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    max_age=3600,
)

app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(generation.router)
app.include_router(lectures.router)
app.include_router(documents.router)

@app.get("/health")
def health_check():
    """Simple health check endpoint"""
    return {"status": "ok", "message": "Backend is running"}

@app.get("/")
def root():
    """Root endpoint"""
    return {"message": "Project Notes API", "docs": "/docs"}

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from core.config import settings

# read from environment (or .env) with sensible default for development
DATABASE_URL = settings.database_url

# for sqlite we need to pass check_same_thread
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,  # help with dropped connections in production
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
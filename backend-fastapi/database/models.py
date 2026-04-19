from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, Text
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)  # Email is now required
    hashed_password = Column(String)
    email_verified = Column(Boolean, default=False)
    otp = Column(String, nullable=True)
    otp_expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    folders = relationship("Folder", back_populates="owner", cascade="all, delete-orphan")
    notes = relationship("Note", back_populates="owner", cascade="all, delete-orphan")

class Folder(Base):
    __tablename__ = "folders"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    owner = relationship("User", back_populates="folders")
    notes = relationship("Note", back_populates="folder", cascade="all, delete-orphan")

class CachedNote(Base):
    """Global note cache - stores generated notes keyed by source URL"""
    __tablename__ = "cached_notes"
    
    id = Column(Integer, primary_key=True, index=True)
    # Unique identifier for the source (URL or file hash)
    source_url = Column(String, unique=True, index=True)
    title = Column(String)
    subject = Column(String)
    content = Column(Text)
    status = Column(String, default="COMPLETED")  # PENDING, PROCESSING, COMPLETED, FAILED
    video_path = Column(String, nullable=True)    # Path to downloaded video file
    source_type = Column(String, nullable=True)  # youtube, pdf, ppt, image, video
    video_id = Column(String, nullable=True, index=True)  # For YouTube videos
    created_at = Column(DateTime, default=datetime.utcnow)
    last_accessed = Column(DateTime, default=datetime.utcnow)
    access_count = Column(Integer, default=0)  # Track how many times this cached note was used

class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    subject = Column(String)
    content = Column(String)
    status = Column(String, default="pending")
    video_url = Column(String, nullable=True)  # Could be YT link or local path
    source_type = Column(String, nullable=True)  # youtube, pdf, ppt, image, video
    progress = Column(Integer, default=0)  # Progress percentage (0-100)
    progress_status = Column(String, default="")  # Detailed status message
    is_favorite = Column(Boolean, default=False)  # Mark as favorite
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    folder_id = Column(Integer, ForeignKey("folders.id"), nullable=True, index=True)
    
    owner = relationship("User", back_populates="notes")
    folder = relationship("Folder", back_populates="notes")


class Lecture(Base):
    __tablename__ = "lectures"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    notes = Column(String, nullable=True)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)

    # optional relationship to user if required later
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    # owner = relationship("User")  # uncomment if needed

"""
Cached Notes Service - Manages globally cached notes
Stores generated notes by source URL to avoid regenerating for the same source
"""

import hashlib
import logging
from datetime import datetime
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from database.models import CachedNote
from services.ai_generator import extract_video_id

logger = logging.getLogger(__name__)

# Known failure placeholders/messages that should never be reused as valid notes.
_INVALID_CONTENT_MARKERS = (
    "ai note generation failure troubleshooting",
    "unable to generate ai notes due to service error",
    "check that ollama is running properly",
    "try running: ollama pull llama3",
    "please contact support if the issue persists",
    "ai quota exceeded for all models",
    "failed to upload video file to gemini",
    "timed out waiting for gemini to process the file",
)


def is_reusable_note_content(content: Optional[str]) -> bool:
    """Return True only for content that looks like real generated notes."""
    if not isinstance(content, str):
        return False

    normalized = content.strip().lower()
    if not normalized:
        return False

    if normalized.startswith("failed:"):
        return False

    return not any(marker in normalized for marker in _INVALID_CONTENT_MARKERS)

def normalize_youtube_url(url: str) -> str:
    """Normalize YouTube URLs to a consistent format"""
    video_id = extract_video_id(url)
    if video_id:
        return f"https://www.youtube.com/watch?v={video_id}"
    return url.strip()

def generate_source_hash(source_url: str) -> str:
    """Generate a hash for the source URL for consistency"""
    return hashlib.md5(source_url.encode()).hexdigest()

def get_cached_note(db: Session, source_url: str) -> Optional[CachedNote]:
    """
    Retrieve a cached note by source URL.
    Updates last_accessed timestamp and access_count.
    
    Args:
        db: Database session
        source_url: The source URL (YouTube link, file path, etc.)
        
    Returns:
        CachedNote if found, None otherwise
    """
    # Normalize YouTube URLs
    if 'youtube.com' in source_url.lower() or 'youtu.be' in source_url.lower():
        source_url = normalize_youtube_url(source_url)
    
    cached = db.query(CachedNote).filter(CachedNote.source_url == source_url).first()
    
    if cached:
        # If a bad placeholder slipped into cache previously, remove and treat as miss.
        if not is_reusable_note_content(cached.content):
            logger.warning("Invalid cached content found for %s; deleting stale cache entry", source_url)
            db.delete(cached)
            db.commit()
            return None

        # Update access statistics
        cached.last_accessed = datetime.utcnow()
        cached.access_count += 1
        db.commit()
        logger.info(f"Cache hit for {source_url} (access #{cached.access_count})")
    
    return cached

def set_cached_note_status(
    db: Session,
    source_url: str,
    status: str,
    video_path: Optional[str] = None
) -> CachedNote:
    """Set the status of a cached note, creating a placeholder if necessary."""
    # Normalize YouTube URLs
    if 'youtube.com' in source_url.lower() or 'youtu.be' in source_url.lower():
        source_url = normalize_youtube_url(source_url)
        
    existing = db.query(CachedNote).filter(CachedNote.source_url == source_url).first()
    now = datetime.utcnow()
    
    if existing:
        existing.status = status
        if video_path is not None:
            existing.video_path = video_path
        existing.last_accessed = now
        db.commit()
        return existing
    else:
        cached_note = CachedNote(
            source_url=source_url,
            status=status,
            video_path=video_path,
            created_at=now,
            last_accessed=now,
            access_count=0
        )
        db.add(cached_note)
        db.commit()
        return cached_note

def save_cached_note(
    db: Session,
    source_url: str,
    title: str,
    subject: str,
    content: str,
    source_type: str,
    video_id: Optional[str] = None,
    status: str = "COMPLETED",
    video_path: Optional[str] = None
) -> Optional[CachedNote]:
    """
    Save generated notes to the global cache.
    If a note for this URL already exists, update it.
    
    Args:
        db: Database session
        source_url: The source URL
        title: Note title
        subject: Note subject/category
        content: Generated note content
        source_type: Type of source (youtube, pdf, etc.)
        video_id: YouTube video ID (if applicable)
        status: The processing status (default: COMPLETED)
        video_path: Downloaded video path (if any)
        
    Returns:
        The created/updated CachedNote, or None when content is not cacheable.
    """
    if not is_reusable_note_content(content):
        logger.warning("Skipping cache save for %s because content appears invalid", source_url)
        return None

    # Normalize YouTube URLs
    if 'youtube.com' in source_url.lower() or 'youtu.be' in source_url.lower():
        source_url = normalize_youtube_url(source_url)
    
    # Check if already cached
    existing = db.query(CachedNote).filter(CachedNote.source_url == source_url).first()
    
    now = datetime.utcnow()
    
    if existing:
        # Update existing cache entry
        existing.title = title
        existing.subject = subject
        existing.content = content
        existing.source_type = source_type
        existing.video_id = video_id or existing.video_id
        existing.status = status
        if video_path is not None:
            existing.video_path = video_path
        existing.last_accessed = now
        logger.info(f"Updated cached note for {source_url}")
        db.commit()
        return existing
    else:
        # Create new cache entry
        cached_note = CachedNote(
            source_url=source_url,
            title=title,
            subject=subject,
            content=content,
            source_type=source_type,
            video_id=video_id,
            status=status,
            video_path=video_path,
            created_at=now,
            last_accessed=now,
            access_count=0
        )
        db.add(cached_note)
        db.commit()
        logger.info(f"Saved new cached note for {source_url}")
        return cached_note

def get_cache_stats(db: Session) -> dict:
    """Get statistics about the cached notes"""
    total_cached = db.query(CachedNote).count()
    total_accesses = db.query(CachedNote).with_entities(
        db.func.sum(CachedNote.access_count).label('total')
    ).first()
    
    total_accesses_count = total_accesses[0] or 0
    
    return {
        "total_cached_notes": total_cached,
        "total_cache_accesses": total_accesses_count,
        "average_accesses_per_note": (
            total_accesses_count / total_cached if total_cached > 0 else 0
        )
    }

def clear_cache(db: Session) -> int:
    """Clear all cached notes. Use with caution!"""
    count = db.query(CachedNote).delete()
    db.commit()
    logger.warning(f"Cleared {count} cached notes from database")
    return count

def cleanup_old_cache(db: Session, days: int = 30) -> int:
    """
    Remove cached notes that haven't been accessed in N days.
    Useful for cleanup of stale cache.
    
    Args:
        db: Database session
        days: Delete cached notes not accessed in this many days
        
    Returns:
        Number of entries deleted
    """
    from datetime import timedelta
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    count = db.query(CachedNote).filter(CachedNote.last_accessed < cutoff_date).delete()
    db.commit()
    logger.info(f"Cleaned up {count} cached notes (not accessed in {days} days)")
    return count

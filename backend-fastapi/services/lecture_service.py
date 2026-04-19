from typing import Optional
import logging

from database.models import Lecture, Note

logger = logging.getLogger(__name__)

def create_lecture(db, data, notes: Optional[str] = None, status: str = "pending") -> Lecture:
    """Persist a new Lecture and return the instance."""
    try:
        new_lecture = Lecture(
            title=data.title,
            subject=data.subject,
            notes=notes,
            status=status,
            # persist owner information so access control works
            user_id=getattr(data, 'user_id', None)
        )
        db.add(new_lecture)
        db.commit()
        db.refresh(new_lecture)
        logger.info("created lecture id=%s (title=%s, user_id=%s)", new_lecture.id, new_lecture.title, new_lecture.user_id)
        
        # Also create a corresponding Note record if user_id is present
        if hasattr(data, 'user_id') and data.user_id:
            new_note = Note(
                title=data.title,
                subject=data.subject,
                content=notes,
                status=status,
                user_id=data.user_id
            )
            db.add(new_note)
            db.commit()
            db.refresh(new_note)
            logger.info("created note id=%s for lecture %s (title=%s, user_id=%s)", 
                       new_note.id, new_lecture.id, new_note.title, data.user_id)
        else:
            logger.warning("lecture %s created but no user_id to create note", new_lecture.id)
        
        return new_lecture
    except Exception as e:
        logger.exception("error creating lecture: %s", e)
        raise


def get_all_lectures(db):
    """Return all lecture records."""
    return db.query(Lecture).all()

def get_lecture_by_id(db, lecture_id: int) -> Optional[Lecture]:
    """Fetch a single lecture; returns None if not found."""
    return db.query(Lecture).filter(Lecture.id == lecture_id).first()
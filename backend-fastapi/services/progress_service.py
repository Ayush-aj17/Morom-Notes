"""
Progress tracking service for note generation tasks.
Maintains real-time progress updates for each note being processed.
"""

from typing import Dict, Optional
from pydantic import BaseModel

class ProgressUpdate(BaseModel):
    """Model for progress updates"""
    note_id: int
    progress: int  # 0-100
    status: str  # Human-readable status message
    
class ProgressTracker:
    """In-memory progress tracker for background tasks"""
    
    def __init__(self):
        self._progress: Dict[int, ProgressUpdate] = {}
    
    def start(self, note_id: int, status: str = "Starting..."):
        """Initialize progress tracking for a note"""
        self._progress[note_id] = ProgressUpdate(
            note_id=note_id,
            progress=0,
            status=status
        )
    
    def update(self, note_id: int, progress: int, status: str):
        """Update progress for a note"""
        progress = max(0, min(100, progress))  # Clamp between 0-100
        if note_id in self._progress:
            self._progress[note_id] = ProgressUpdate(
                note_id=note_id,
                progress=progress,
                status=status
            )
    
    def get(self, note_id: int) -> Optional[ProgressUpdate]:
        """Get current progress for a note"""
        return self._progress.get(note_id)
    
    def complete(self, note_id: int):
        """Mark task as complete (100%)"""
        self.update(note_id, 100, "Completed!")
    
    def clear(self, note_id: int):
        """Clear progress tracking for a note"""
        self._progress.pop(note_id, None)
    
    def sync_to_db(self, note_id: int, db_session):
        """Sync progress from tracker to database Note record"""
        from database.models import Note
        progress_update = self.get(note_id)
        if progress_update:
            note = db_session.query(Note).filter(Note.id == note_id).first()
            if note:
                note.progress = progress_update.progress
                note.progress_status = progress_update.status
                db_session.commit()

# Global progress tracker instance
progress_tracker = ProgressTracker()

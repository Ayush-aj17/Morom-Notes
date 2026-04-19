import os
import logging
from database.db import SessionLocal

logger = logging.getLogger(__name__)
from database.models import Lecture, Note
from services import (
    video_service,
    transcription_service,
    ai_service,
)


def process_lecture(lecture_id: int, file_location: str):
    db = SessionLocal()
    note_id = None
    try:
        # 1️⃣ extract audio
        logger.info("processing lecture %s, file %s", lecture_id, file_location)
        audio_path = video_service.extract_audio(file_location)
        logger.info("audio extracted to %s", audio_path)

        # 2️⃣ transcription
        logger.info("starting transcription")
        transcript = transcription_service.transcribe_audio(audio_path)
        logger.info("transcription complete, length: %d chars", len(transcript))

        # 3️⃣ AI notes
        logger.info("generating notes with AI")
        notes = ai_service.generate_notes_from_transcript(transcript)
        logger.info("ai notes generated for lecture %s, length: %d chars", lecture_id, len(notes))

        # clean up intermediate files to avoid disk filling up
        try:
            if os.path.exists(audio_path):
                os.remove(audio_path)
            if os.path.exists(file_location):
                os.remove(file_location)
        except Exception as e:
            logger.warning("error cleaning up files: %s", e)

        # 4️⃣ update DB
        lecture = db.get(Lecture, lecture_id)
        logger.debug("fetched lecture record %s", lecture_id)
        if not lecture:
            logger.error("lecture %s not found", lecture_id)
            return

        logger.info("updating lecture %s status to completed", lecture_id)
        lecture.status = "completed"
        lecture.notes = notes
        db.commit()
        
        # Also update the corresponding Note record with the generated content
        if lecture.user_id:
            # Find note by lecture_id, title, and user_id
            note = db.query(Note).filter(
                Note.user_id == lecture.user_id,
                Note.title == lecture.title,
            ).first()
            
            if note:
                note_id = note.id
                logger.info("updating note %s with generated content", note.id)
                note.content = notes
                note.status = "completed"
                db.commit()
                logger.info("note %s updated successfully", note.id)
            else:
                logger.warning("note not found for lecture %s (user_id=%s, title=%s)", 
                              lecture_id, lecture.user_id, lecture.title)
        
    except Exception as exc:
        logger.exception("error processing lecture %s: %s", lecture_id, exc)
        # update status to failed if possible
        try:
            obj = db.get(Lecture, lecture_id)
            if obj:
                obj.status = "failed"
                db.commit()
                logger.info("lecture %s marked as failed", lecture_id)
                
            # Also mark corresponding Note as failed
            if note_id:
                note = db.get(Note, note_id)
                if note:
                    note.status = "failed"
                    db.commit()
                    logger.info("note %s marked as failed", note_id)
        except Exception as err:
            logger.error("error marking as failed: %s", err)
        raise
    finally:
        db.close()

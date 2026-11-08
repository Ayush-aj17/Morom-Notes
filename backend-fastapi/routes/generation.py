import logging

from fastapi import APIRouter, Depends, HTTPException, Form, BackgroundTasks

from sqlalchemy.orm import Session

from database.db import get_db

from database.models import User, Note

from routes.dashboard import get_current_user

from services.progress_service import progress_tracker

from services.cache_service import get_cached_note, save_cached_note, is_reusable_note_content

import tempfile

import os



from services.ai_generator import generate_notes_from_video_file, generate_notes_from_url



logger = logging.getLogger(__name__)



router = APIRouter(prefix="/api/notes", tags=["generation"])



@router.post("/generate")

async def generate_note(

    background_tasks: BackgroundTasks,

    video_url: str = Form(None),

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user)

):

    try:

        logger.info("user %s requested note generation", current_user.username)



        # sanity check for AI client configuration

        from services.ai_generator import _has_google_genai, initialize_client

        try:

            initialize_client()

        except Exception as exc:

            logger.error("AI client initialization failed: %s", exc)

            raise HTTPException(

                status_code=500,

                detail="AI generation not configured: %s" % str(exc)

            )



        if not video_url:
            raise HTTPException(status_code=400, detail="A YouTube video_url is required.")
        pipeline = "audio-video"

        if video_url:

            video_url = video_url.strip()

            if not (
                video_url.startswith(("http://www.youtube.com/", "https://www.youtube.com/",
                                      "http://youtube.com/", "https://youtube.com/",
                                      "http://youtu.be/", "https://youtu.be/"))
            ):

                raise HTTPException(status_code=400, detail="video_url must be a valid YouTube link.")



        from core.config import settings as _settings



        new_note = Note(

            title="",

            subject="",

            content="",

            status="processing",

            video_url=video_url,

            user_id=current_user.id

        )

        db.add(new_note)

        db.commit()

        db.refresh(new_note)

        

        logger.info("Created note %d for user %s, starting background task", new_note.id, current_user.username)



        def _do_work(note_id: int, video_url: str, temp_file_path: str = None, filename: str = None, mime_type: str = None, pipeline: str = "audio-video"):

            from database.db import SessionLocal

            from services.ai_generator import get_file_title, detect_source_type, get_youtube_title, generate_title_from_content

            

            _db = SessionLocal()

            

            def update_progress(progress: int, status: str):

                """Helper to update both tracker and database"""

                progress_tracker.update(note_id, progress, status)

                try:

                    progress_tracker.sync_to_db(note_id, _db)

                except Exception as e:

                    logger.warning(f"Failed to sync progress to DB: {e}")

            

            progress_tracker.start(note_id, "Initializing...")

            update_progress(0, "Initializing...")

            

            try:

                generated_content = ""

                title = "Untitled Notes"

                source_type = None

                subject = ""

                

                # Extract title and source_type FIRST - these should always be set

                if temp_file_path is not None:

                    # For uploaded files, start with filename-based title

                    title = get_file_title(filename)

                    source_type = detect_source_type(filename=filename)

                    subject = "Uploaded Video"

                else:

                    # For YouTube, try to extract title

                    title = get_youtube_title(video_url)

                    if title is None:

                        # If extraction fails, use placeholder - will be updated after content generation

                        title = "YouTube Lecture"

                    source_type = detect_source_type(video_url=video_url)

                    subject = "Online Video"

                

                # Save title and subject immediately (before content generation)

                n = _db.get(Note, note_id)

                if n:

                    n.title = title

                    n.subject = subject

                    n.source_type = source_type

                    # Save the video_url if it's a YouTube/online link

                    if not temp_file_path:

                        n.video_url = video_url

                    _db.commit()

                

                # Check cache FIRST for YouTube links before generating
                if temp_file_path is None and video_url and ('youtube.com' in video_url.lower() or 'youtu.be' in video_url.lower()):
                    update_progress(10, "Checking cache...")
                    cached = get_cached_note(_db, video_url)
                    
                    if cached and cached.status == "COMPLETED":
                        # Use cached content!
                        generated_content = cached.content
                        title = cached.title
                        update_progress(95, "Retrieved from cache (0 API calls)...")
                        logger.info(f"Cache HIT for YouTube video: {video_url} - skipped generation!")
                    elif cached and cached.status == "PROCESSING":
                        logger.info("Video is already being processed in another task.")
                        update_progress(100, "Processing already in progress by another task.")
                        n = _db.get(Note, note_id)
                        if n:
                            n.status = "failed"
                            n.content = "This video is currently being processed. Please check back later."
                            _db.commit()
                        return
                    else:
                        from services.cache_service import set_cached_note_status
                        # Mark as PROCESSING
                        set_cached_note_status(_db, video_url, "PROCESSING")
                        
                        existing_video_path = None
                        if cached and cached.video_path and os.path.exists(cached.video_path):
                            existing_video_path = cached.video_path
                        
                        try:
                            # Not in cache or failed previously, generate it
                            update_progress(10, "Initializing video download...")
                            # Pass the progress callback so the DL step updates the UI live
                            generated_content, new_video_path = generate_notes_from_url(
                                video_url, 
                                progress_callback=update_progress,
                                existing_video_path=existing_video_path,
                                pipeline=pipeline
                            )
                            update_progress(88, "Drafting final notes structuring...")
                            
                            # Save to cache for future use
                            update_progress(92, "Saving to cache...")
                            save_cached_note(
                                _db,
                                source_url=video_url,
                                title=title,
                                subject=subject,
                                content=generated_content,
                                source_type=source_type,
                                status="COMPLETED",
                                video_path=new_video_path
                            )
                            logger.info(f"Cache MISS - generated and saved notes for: {video_url}")
                        except Exception as gen_err:
                            set_cached_note_status(_db, video_url, "FAILED")
                            raise gen_err

                else:

                    # For uploaded files, just generate normally (no cache for uploaded files)

                    if temp_file_path is not None:

                        update_progress(5, f"Reading file: {filename}")

                        suffix = os.path.splitext(filename)[1] if filename else ".mp4"

                        pass  # File is already on disk

                        try:

                            update_progress(15, "Uploading video for processing...")

                            generated_content = generate_notes_from_video_file(temp_file_path, mime_type=mime_type or "video/mp4", progress_callback=update_progress, pipeline=pipeline)

                            update_progress(88, "Drafting final notes structuring...")

                        finally:

                            if os.path.exists(temp_file_path):

                                os.remove(temp_file_path)

                    else:
                        # Other online URLs (non-YouTube)
                        update_progress(10, "Downloading video metadata...")
                        generated_content, _ = generate_notes_from_url(video_url, pipeline=pipeline)
                        update_progress(85, "Generating notes from transcript...")



                # After content generation, improve title if needed

                if not is_reusable_note_content(generated_content):

                    raise ValueError("Generated content is invalid or contains failure placeholder text")



                update_progress(90, "Improving title...")

                if generated_content:

                    # For uploaded files or failed YouTube extraction, generate a better title

                    if temp_file_path is not None or get_youtube_title(video_url) is None:

                        improved_title = generate_title_from_content(generated_content)

                        if improved_title and improved_title != "Study Notes":

                            title = improved_title

                

                update_progress(95, "Saving to database...")

                

                n = _db.get(Note, note_id)

                if n:

                    n.title = title  # Update with improved title

                    n.content = generated_content

                    n.status = "generated"

                    n.progress = 100

                    n.progress_status = "Completed!"

                    _db.commit()

                    progress_tracker.complete(note_id)

            except Exception as e:

                logger.exception("error during background note generation for %s", note_id)

                _db.rollback()

                error_message = f"Failed: {str(e)}".strip()

                if len(error_message) > 300:

                    error_message = error_message[:297] + "..."

                n = _db.get(Note, note_id)

                if n:

                    n.status = "failed"

                    n.progress = 0

                    n.progress_status = error_message

                    _db.commit()

                update_progress(0, error_message)

            finally:

                _db.close()

        

        if _settings.testing:
            _do_work(new_note.id, video_url, pipeline=pipeline)
            logger.info("ran YouTube generation immediately for note %s (testing mode)", new_note.id)
        else:
            background_tasks.add_task(_do_work, new_note.id, video_url, None, None, None, pipeline)
            logger.info("queued YouTube note generation for note %s", new_note.id)



        return {"message": "Note generation started", "note_id": new_note.id}

    

    except HTTPException:

        raise

    except Exception as e:

        logger.exception("Unexpected error in generate_note: %s", e)

        raise HTTPException(

            status_code=500,

            detail=f"Internal server error: {str(e)}"

        )









@router.get("/progress/{note_id}")

async def get_progress(

    note_id: int,

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user)

):

    """Get current generation progress for a note"""

    # Verify the note belongs to the current user

    note = db.query(Note).filter(Note.id == note_id, Note.user_id == current_user.id).first()

    if not note:

        raise HTTPException(status_code=404, detail="Note not found")



    # Self-heal inconsistent DB rows where content/save finished but status stayed processing.

    db_status = (note.status or "").strip().lower()

    db_progress_status = (note.progress_status or "").strip().lower()

    note_progress = note.progress if note.progress is not None else 0

    has_valid_content = is_reusable_note_content(note.content)



    if db_status == "processing" and (

        note_progress >= 100

        or db_progress_status.startswith("completed")

        or (has_valid_content and note_progress >= 95 and not db_progress_status.startswith("failed"))

    ):

        note.status = "generated"

        note.progress = 100

        note.progress_status = note.progress_status or "Completed!"

        db.commit()

        db.refresh(note)

    

    # First honor terminal DB state. This avoids stale in-memory tracker values

    # (for example, old 95% updates) masking a completed generation.

    if note.status == "generated":

        progress_tracker.clear(note_id)

        return {

            "note_id": note_id,

            "progress": 100,

            "status": note.progress_status or "Completed!",

            "note_status": note.status

        }

    if note.status == "failed":

        progress_tracker.clear(note_id)

        return {

            "note_id": note_id,

            "progress": 0,

            "status": note.progress_status or "Failed",

            "note_status": note.status

        }



    # Get progress from tracker for active tasks

    progress = progress_tracker.get(note_id)



    if progress:

        status_text = (progress.status or "").strip().lower()

        if progress.progress >= 100 or status_text.startswith("completed"):

            live_status = "generated"

        elif status_text.startswith("failed"):

            live_status = "failed"

        else:

            live_status = "processing"



        return {

            "note_id": note_id,

            "progress": progress.progress,

            "status": progress.status,

            "note_status": live_status

        }



    # Tracker doesn't have data (e.g., restart); fall back to DB progress.

    if note.status == "processing":

        return {

            "note_id": note_id,

            "progress": note.progress if note.progress is not None else 0,

            "status": note.progress_status or "Processing...",

            "note_status": note.status

        }



    # Pending or unknown status

    return {

        "note_id": note_id,

        "progress": note.progress or 0,

        "status": note.progress_status or note.status,

        "note_status": note.status

    }





# ==================== CACHE MANAGEMENT ENDPOINTS ====================



@router.get("/cache/stats")

async def get_cache_stats(

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user)

):

    """Get cache statistics (storage usage, hit rates, etc.)"""

    from services.cache_service import get_cache_stats

    

    stats = get_cache_stats(db)

    return {

        **stats,

        "message": "Cache is enabled - YouTube notes are stored globally and reused across users"

    }





@router.get("/cache/list")

async def list_cached_notes(

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user),

    skip: int = 0,

    limit: int = 50

):

    """List all cached notes with access statistics"""

    from database.models import CachedNote

    

    cached_notes = db.query(CachedNote).order_by(

        CachedNote.last_accessed.desc()

    ).offset(skip).limit(limit).all()

    

    return {

        "total": db.query(CachedNote).count(),

        "cached_notes": [

            {

                "id": note.id,

                "source_url": note.source_url,

                "title": note.title,

                "source_type": note.source_type,

                "access_count": note.access_count,

                "created_at": note.created_at.isoformat(),

                "last_accessed": note.last_accessed.isoformat(),

                "content_length": len(note.content) if note.content else 0

            }

            for note in cached_notes

        ],

        "skip": skip,

        "limit": limit

    }





@router.post("/cache/clear")

async def clear_cache(

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user)

):

    """Clear all cached notes. Warning: This will regenerate notes on next request!"""

    # Only allow admins or use with caution

    from services.cache_service import clear_cache

    from database.models import CachedNote

    

    count = clear_cache(db)

    return {

        "message": f"Cache cleared successfully",

        "deleted_cached_notes": count,

        "note": "Future YouTube video generations will need to regenerate notes"

    }





@router.get("/cache/check")

async def check_cached_note(

    video_url: str,

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user)

):

    """Check if a specific YouTube video has cached notes"""

    from services.cache_service import get_cached_note

    

    cached = get_cached_note(db, video_url)

    

    if cached:

        return {

            "cached": True,

            "title": cached.title,

            "source_url": cached.source_url,

            "access_count": cached.access_count,

            "created_at": cached.created_at.isoformat(),

            "last_accessed": cached.last_accessed.isoformat(),

            "content_preview": cached.content[:200] + "..." if cached.content else ""

        }

    else:

        return {

            "cached": False,

            "message": "No cached notes for this video. Will be generated on next request."

        }

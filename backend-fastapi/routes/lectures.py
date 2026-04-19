import os
import shutil
import uuid
import logging

from models.lecture_models import LectureInfo, LectureResponse
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database.db import get_db
from database.models import Lecture, User
from services import lecture_service, queue_service, pdf_service
from routes.dashboard import get_current_user

# set up logging and upload directory
logger = logging.getLogger(__name__)
from core.config import settings

UPLOAD_DIR = settings.upload_dir
os.makedirs(UPLOAD_DIR, exist_ok=True)

router = APIRouter()

ALLOWED_EXTENSIONS = {".mp4", ".mov", ".mkv", ".avi"}

@router.get("/")
def home():
    return {"message": "Backend is running"}

@router.post("/upload")
async def upload_lecture(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Receive a video upload, store it safely, create a lecture record, and queue processing."""

    # ---------- FILE VALIDATION ----------
    filename = os.path.basename(file.filename or "")
    file_ext = os.path.splitext(filename)[1].lower()

    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Upload a video file."
        )

    # ---------- SAVE FILE ----------
    # ensure upload size within configured limit
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    try:
        file.file.seek(0, os.SEEK_END)
        size = file.file.tell()
        file.file.seek(0)
    except Exception:
        size = None
    if size is not None and size > max_bytes:
        raise HTTPException(status_code=413, detail="Uploaded file is too large")

    # Use a random uuid to avoid collisions and path traversal
    safe_name = f"{uuid.uuid4()}{file_ext}"
    file_location = os.path.join(UPLOAD_DIR, safe_name)

    with open(file_location, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # ---------- CREATE DB ENTRY ----------
    lecture_data = LectureInfo(
        title=filename,
        subject="Auto Generated",
        user_id=current_user.id
    )

    saved = lecture_service.create_lecture(
        db,
        lecture_data,
        notes=None,
        status="processing"
    )

    # ---------- BACKGROUND AI PROCESS ----------
    queue_service.add_task(
        saved.id,
        file_location
    )

    # ---------- RESPONSE ----------
    return {
        "message": "Upload successful",
        "lecture_id": saved.id,
        "status": saved.status
    }


@router.post("/lecture-info", response_model=LectureResponse)
def lecture_info(
    data: LectureInfo,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Convenience endpoint to create a lecture without uploading a file."""
    # ensure ownership is recorded
    data.user_id = current_user.id
    return lecture_service.create_lecture(db, data)


@router.get("/lectures", response_model=list[LectureResponse])
def get_lectures(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # only return lectures belonging to current user
    return db.query(Lecture).filter(Lecture.user_id == current_user.id).all()

@router.get("/lectures/{lecture_id}", response_model=LectureResponse)
def get_lecture(lecture_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lecture = lecture_service.get_lecture_by_id(db, lecture_id)
    if not lecture or lecture.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Lecture not found")
    return lecture

@router.post("/export-pdf")
def export_pdf(data: dict, current_user: User = Depends(get_current_user)):
    html_content = data.get("content", "")

    pdf_path = pdf_service.generate_pdf_from_html(
        html_content,
        "notes_export"
    )

    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename="notes.pdf"
    )

@router.get("/lectures/{lecture_id}/status")
def get_lecture_status(
    lecture_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    lecture = lecture_service.get_lecture_by_id(db, lecture_id)
    if not lecture or lecture.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Lecture not found")
    return {"id": lecture.id, "status": lecture.status}


@router.post("/generate-notes")
def generate_notes(file_path: str, current_user: User = Depends(get_current_user)):
    # for backwards compatibility, very simple endpoint
    return ai_service.generate_notes_from_video(file_path)

class EditRequest(BaseModel):
    notes: str
    instruction: str

@router.post("/ai-edit")
def ai_edit_notes(data: EditRequest, current_user: User = Depends(get_current_user)):

    prompt = f"""
You are an expert editor.

Given NOTES and USER INSTRUCTION,
rewrite the notes accordingly.

Instruction:
{data.instruction}

Notes:
{data.notes}

Return ONLY updated notes.
"""

    from services import ai_service

    updated = ai_service.generate_notes_from_transcript(prompt)
    
    # DEBUG: Show raw AI response
    print("\n" + "="*80)
    print(f"LECTURES.PY - AI RESPONSE (First 800 chars):")
    print("="*80)
    print(updated[:800])
    print("="*80 + "\n")

    return {"updated_notes": updated}
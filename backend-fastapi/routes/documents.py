from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, status, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
import os
import logging
from pathlib import Path

from database.db import get_db
from database.models import Note, User
from services.document_processor import DocumentProcessor
from services.auth import verify_password
from services.progress_service import progress_tracker
from services.ai_generator import generate_notes_from_transcript
from services.cache_service import is_reusable_note_content
from routes.dashboard import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/documents", tags=["documents"])

UPLOAD_DIR = "uploads/documents"
ALLOWED_DOCUMENT_TYPES = {
    'pdf': 'pdf',
    'ppt': 'ppt',
    'pptx': 'ppt',
    'jpg': 'image',
    'jpeg': 'image',
    'png': 'image',
    'bmp': 'image',
    'gif': 'image'
}

# Ensure upload directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)

class DocumentNoteCreate(BaseModel):
    title: str
    subject: str = ""
    folder_id: int = None

def get_file_type(filename: str) -> str:
    """Get the file type from filename"""
    ext = filename.split('.')[-1].lower()
    return ALLOWED_DOCUMENT_TYPES.get(ext, None)

@router.post("/process")
async def process_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: str = "Extracted Notes",
    subject: str = "",
    folder_id: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Process a document (PDF, PPT, Image) and create a note with extracted content
    Returns immediately with note_id, processing happens in background
    """
    # Verify file type
    file_type = get_file_type(file.filename)
    if not file_type:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Supported: PDF, PPT, PPTX, JPG, JPEG, PNG, BMP, GIF"
        )
    
    # Check file size (max 50MB)
    file_size = len(await file.read())
    await file.seek(0)  # Reset file pointer
    
    if file_size > 50 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File size exceeds 50MB limit")
    
    # Generate initial title from filename
    from services.ai_generator import get_file_title
    initial_title = get_file_title(file.filename) if not title else title
    
    # Create a note with initial status
    note = Note(
        title=initial_title,
        subject=subject or f"Extracted from {file.filename}",
        content="",
        user_id=current_user.id,
        folder_id=folder_id,
        status="processing",
        progress=0,
        progress_status="Starting document processing...",
        source_type=f"Uploaded {file_type}"
    )
    
    db.add(note)
    db.commit()
    db.refresh(note)
    
    # Start background processing
    def _process_in_background(note_id: int, filename: str, file_data: bytes, file_type_val: str):
        from database.db import SessionLocal
        from services.ai_generator import generate_title_from_content
        _db = SessionLocal()

        def update_progress(progress: int, status_text: str):
            progress_tracker.update(note_id, progress, status_text)
            try:
                progress_tracker.sync_to_db(note_id, _db)
            except Exception as sync_err:
                logger.warning(f"Failed to sync document progress to DB: {sync_err}")
        
        progress_tracker.start(note_id, "Starting document processing...")
        update_progress(0, "Starting document processing...")
        
        try:
            temp_file_path = os.path.join(UPLOAD_DIR, filename)
            
            update_progress(10, f"Reading {file_type_val} file...")
            with open(temp_file_path, "wb") as temp_file:
                temp_file.write(file_data)
            
            update_progress(25, f"Extracting text from {file_type_val}...")
            extracted_text, cleaned_text = DocumentProcessor.process_document(
                temp_file_path,
                file_type_val
            )
            
            update_progress(50, "Analyzing content with AI...")
            
            # Generate formatted notes from extracted content using AI.
            # If AI returns fallback/error placeholder text, treat as failure.
            generated_content = generate_notes_from_transcript(cleaned_text)
            if not is_reusable_note_content(generated_content):
                raise ValueError("AI generation returned invalid/fallback content")

            # DEBUG: Show raw AI response
            print("\n" + "="*80)
            print(f"DOCUMENTS.PY - AI RESPONSE (First 800 chars):")
            print("="*80)
            print(generated_content[:800])
            print("="*80 + "\n")
            logger.info(f"AI notes generated for document note {note_id}, length: {len(generated_content)} chars")
            
            update_progress(85, "Improving title from content...")
            
            # Generate a better title from the content
            improved_title = generate_title_from_content(generated_content)
            final_title = improved_title if improved_title and improved_title != "Study Notes" else initial_title
            
            update_progress(90, "Saving notes to database...")
            
            # Update the note with the AI-generated content and improved title
            n = _db.get(Note, note_id)
            if n:
                n.title = final_title
                n.content = generated_content
                n.status = "generated"
                n.progress = 100
                n.progress_status = "Completed!"
                _db.commit()
            
            update_progress(100, "Completed!")
            
            # Clean up temporary file
            try:
                os.remove(temp_file_path)
            except Exception as e:
                logger.warning(f"Could not delete temporary file: {e}")
        
        except Exception as e:
            logger.error(f"Error processing document: {e}")
            error_message = f"Failed: {str(e)}"
            n = _db.get(Note, note_id)
            if n:
                n.status = "failed"
                n.progress = 0
                n.progress_status = error_message
                _db.commit()
            update_progress(0, error_message)
            
            # Clean up temp file on error
            try:
                if os.path.exists(temp_file_path):
                    os.remove(temp_file_path)
            except:
                pass
        finally:
            _db.close()
    
    file_data = await file.read()
    background_tasks.add_task(_process_in_background, note.id, file.filename, file_data, file_type)
    
    return {
        "success": True,
        "note_id": note.id,
        "title": note.title,
        "message": "Document processing started"
    }

@router.post("/extract-text")
async def extract_text_only(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Extract text from a document without creating a note
    Returns both raw extracted and cleaned text
    """
    file_type = get_file_type(file.filename)
    if not file_type:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Supported: PDF, PPT, PPTX, JPG, JPEG, PNG, BMP, GIF"
        )
    
    try:
        # Save uploaded file temporarily
        temp_file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(temp_file_path, "wb") as temp_file:
            content = await file.read()
            temp_file.write(content)
        
        # Process the document
        extracted_text, cleaned_text = DocumentProcessor.process_document(
            temp_file_path,
            file_type
        )
        
        # Clean up temporary file
        try:
            os.remove(temp_file_path)
        except Exception as e:
            logger.warning(f"Could not delete temporary file: {e}")
        
        return {
            "success": True,
            "filename": file.filename,
            "file_type": file_type,
            "extracted_text": extracted_text,
            "cleaned_text": cleaned_text,
            "character_count": len(cleaned_text)
        }
    
    except Exception as e:
        logger.error(f"Error extracting text: {e}")
        # Clean up temporary file on error
        try:
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
        except:
            pass
        
        raise HTTPException(
            status_code=500,
            detail=f"Error extracting text: {str(e)}"
        )

@router.post("/extract-text-multi")
async def extract_text_multi(
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Extract text from multiple documents without creating a note
    Returns combined text from all files
    """
    if not files:
        raise HTTPException(
            status_code=400,
            detail="No files provided"
        )
    
    try:
        all_extracted_text = []
        temp_file_paths = []
        
        # Process each file
        for file in files:
            file_type = get_file_type(file.filename)
            if not file_type:
                logger.warning(f"Unsupported file type: {file.filename}, skipping")
                continue
            
            # Save uploaded file temporarily
            temp_file_path = os.path.join(UPLOAD_DIR, file.filename)
            with open(temp_file_path, "wb") as temp_file:
                content = await file.read()
                temp_file.write(content)
            temp_file_paths.append(temp_file_path)
            
            # Process the document
            extracted_text, cleaned_text = DocumentProcessor.process_document(
                temp_file_path,
                file_type
            )
            
            # Add source header and extracted text
            all_extracted_text.append(f"=== FROM: {file.filename} ===\n{cleaned_text}\n")
        
        # Combine all text
        combined_text = "\n".join(all_extracted_text)
        
        # Clean up temporary files
        for temp_path in temp_file_paths:
            try:
                os.remove(temp_path)
            except:
                pass
        
        if not combined_text.strip():
            raise HTTPException(
                status_code=400,
                detail="No text could be extracted from the provided files"
            )
        
        return {
            "extracted_text": combined_text,
            "cleaned_text": combined_text,
            "character_count": len(combined_text),
            "files_processed": len(files)
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error extracting text from multiple files: {e}")
        # Clean up temp files on error
        try:
            for temp_path in temp_file_paths:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
        except:
            pass
        
        raise HTTPException(
            status_code=500,
            detail=f"Error extracting text: {str(e)}"
        )

@router.post("/process-multi")
async def process_multiple_documents(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    title: str = "Compiled Notes",
    subject: str = "",
    folder_id: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Process multiple documents (PDF, PPT, Image) and create a single note with combined content
    Returns immediately with note_id, processing happens in background
    """
    if not files:
        raise HTTPException(
            status_code=400,
            detail="No files provided"
        )
    
    # Verify all file types
    valid_files = []
    for file in files:
        file_type = get_file_type(file.filename)
        if not file_type:
            logger.warning(f"Unsupported file type: {file.filename}, skipping")
        else:
            valid_files.append((file, file_type))
    
    if not valid_files:
        raise HTTPException(
            status_code=400,
            detail="No valid files provided. Supported: PDF, PPT, PPTX, JPG, JPEG, PNG, BMP, GIF"
        )
    
    # Validate total file size
    total_size = sum(f[0].__dict__.get('file_size', 0) for f in valid_files) if hasattr(valid_files[0][0], 'file_size') else 0
    max_total_size = 200 * 1024 * 1024  # 200MB total limit
    if total_size > max_total_size and total_size > 0:
        raise HTTPException(status_code=413, detail="Combined file size exceeds 200MB limit")
    
    # Build source_type string from file types
    file_types_set = set(file_type for _, file_type in valid_files)
    source_type_str = ", ".join(sorted(file_types_set))
    
    # Generate initial title from number of files
    from services.ai_generator import get_file_title
    initial_title = title if title else f"Notes from {len(valid_files)} files"
    
    # Create a note with initial status
    note = Note(
        title=initial_title,
        subject=subject,
        content="",
        user_id=current_user.id,
        folder_id=folder_id,
        status="processing",
        progress=0,
        progress_status=f"Starting document processing ({len(valid_files)} files)...",
        source_type=f"Uploaded {source_type_str}"
    )
    
    db.add(note)
    db.commit()
    db.refresh(note)
    
    # Start background processing
    def _process_multi_in_background(note_id: int, files_data: list, title_val: str):
        from database.db import SessionLocal
        from services.ai_generator import generate_title_from_content
        _db = SessionLocal()

        def update_progress(progress: int, status_text: str):
            progress_tracker.update(note_id, progress, status_text)
            try:
                progress_tracker.sync_to_db(note_id, _db)
            except Exception as sync_err:
                logger.warning(f"Failed to sync multi-document progress to DB: {sync_err}")
        
        progress_tracker.start(note_id, "Starting document processing...")
        update_progress(0, "Starting document processing...")
        
        try:
            all_extracted_text = []
            temp_file_paths = []
            
            # Process each file
            for idx, file_obj in enumerate(files_data):
                progress_percent = int(10 + (idx / len(files_data)) * 40)
                update_progress(progress_percent, f"Processing file {idx + 1}/{len(files_data)}: {file_obj['filename']}")
                
                temp_file_path = os.path.join(UPLOAD_DIR, file_obj['filename'])
                
                # Write file data
                with open(temp_file_path, "wb") as temp_file:
                    temp_file.write(file_obj['data'])
                temp_file_paths.append(temp_file_path)
                
                # Extract text from this file
                extracted_text, cleaned_text = DocumentProcessor.process_document(
                    temp_file_path,
                    file_obj['file_type']
                )
                
                # Add source header
                all_extracted_text.append(f"=== FROM: {file_obj['filename']} ===\n{cleaned_text}\n")
            
            # Combine all text
            combined_text = "\n".join(all_extracted_text)
            
            update_progress(55, "Analyzing combined content with AI...")
            
            # Generate formatted notes from combined content using AI.
            # If AI returns fallback/error placeholder text, treat as failure.
            generated_content = generate_notes_from_transcript(combined_text)
            if not is_reusable_note_content(generated_content):
                raise ValueError("AI generation returned invalid/fallback content")
            logger.info(f"AI notes generated for multi-doc note {note_id}, length: {len(generated_content)} chars")
            
            update_progress(85, "Improving title from content...")
            
            # Generate a better title from the content
            improved_title = generate_title_from_content(generated_content)
            final_title = improved_title if improved_title and improved_title != "Study Notes" else title_val
            
            update_progress(90, "Saving notes to database...")
            
            # Update the note with the AI-generated content and improved title
            n = _db.get(Note, note_id)
            if n:
                n.title = final_title
                n.content = generated_content
                n.status = "generated"
                n.progress = 100
                n.progress_status = "Completed!"
                _db.commit()
            
            update_progress(100, "Completed!")
            
            # Clean up temporary files
            for temp_path in temp_file_paths:
                try:
                    if os.path.exists(temp_path):
                        os.remove(temp_path)
                except Exception as e:
                    logger.warning(f"Could not delete temporary file {temp_path}: {e}")
        
        except Exception as e:
            logger.error(f"Error processing multiple documents: {e}")
            error_message = f"Failed: {str(e)}"
            n = _db.get(Note, note_id)
            if n:
                n.status = "failed"
                n.progress = 0
                n.progress_status = error_message
                _db.commit()
            update_progress(0, error_message)
            
            # Clean up temp files on error
            try:
                for temp_path in temp_file_paths:
                    if os.path.exists(temp_path):
                        os.remove(temp_path)
            except:
                pass
        finally:
            _db.close()
    
    # Prepare file data for background processing
    files_data = []
    for file_obj, file_type_val in valid_files:
        file_data = await file_obj.read()
        files_data.append({
            'filename': file_obj.filename,
            'file_type': file_type_val,
            'data': file_data
        })
    
    # Add background task
    background_tasks.add_task(_process_multi_in_background, note.id, files_data, initial_title)
    
    return {
        "success": True,
        "note_id": note.id,
        "title": note.title,
        "files_count": len(valid_files),
        "message": f"Processing {len(valid_files)} documents..."
    }

@router.get("/supported-formats")
async def get_supported_formats():
    """Get list of supported file formats"""
    return {
        "pdf": {
            "extensions": [".pdf"],
            "description": "PDF documents - extracts text and OCR from images"
        },
        "ppt": {
            "extensions": [".ppt", ".pptx"],
            "description": "PowerPoint presentations - best support for .pptx. Legacy .ppt may need conversion to .pptx"
        },
        "images": {
            "extensions": [".jpg", ".jpeg", ".png", ".bmp", ".gif"],
            "description": "Images - uses OCR to extract text (requires Tesseract OCR installed on server)"
        }
    }

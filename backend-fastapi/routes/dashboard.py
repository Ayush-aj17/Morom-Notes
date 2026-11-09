from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from database.db import get_db
from database.models import User, Folder, Note
from jose import jwt, JWTError
from services.auth import SECRET_KEY, ALGORITHM
from routes.auth import find_user_by_email
from fastapi.security import OAuth2PasswordBearer

router = APIRouter(prefix="/api", tags=["dashboard"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = find_user_by_email(db, email)
    if user is None:
        raise credentials_exception
    return user

class FolderCreate(BaseModel):
    name: str

class NoteRename(BaseModel):
    title: str

class NoteCreate(BaseModel):
    title: str
    content: str
    subject: str = ""
    folder_id: Optional[int] = None

class FolderResponse(BaseModel):
    id: int
    name: str

    class Config:
        # Pydantic v2 renamed orm_mode
        from_attributes = True

class NoteResponse(BaseModel):
    id: int
    title: str
    subject: str
    status: str
    folder_id: Optional[int]
    video_url: Optional[str] = None
    source_type: Optional[str] = None
    content: Optional[str] = None
    is_favorite: bool = False
    created_at: Optional[datetime] = None

    class Config:
        # Pydantic v2 renamed orm_mode
        from_attributes = True

@router.get("/folders", response_model=List[FolderResponse])
def get_folders(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Folder).filter(Folder.user_id == current_user.id).all()

@router.post("/folders", response_model=FolderResponse)
def create_folder(folder: FolderCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    new_folder = Folder(name=folder.name, user_id=current_user.id)
    db.add(new_folder)
    db.commit()
    db.refresh(new_folder)
    return new_folder

@router.put("/folders/{folder_id}", response_model=FolderResponse)
def rename_folder(folder_id: int, folder: FolderCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db_folder = db.query(Folder).filter(Folder.id == folder_id, Folder.user_id == current_user.id).first()
    if not db_folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    db_folder.name = folder.name
    db.commit()
    db.refresh(db_folder)
    return db_folder

class NoteResponseListItem(BaseModel):
    id: int
    title: str
    subject: str
    status: str
    folder_id: Optional[int]
    video_url: Optional[str] = None
    source_type: Optional[str] = None
    is_favorite: bool = False
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

@router.get("/notes", response_model=List[NoteResponseListItem])
def get_notes(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Note).filter(Note.user_id == current_user.id).all()

@router.put("/notes/{note_id}/move")
def move_note(note_id: int, folder_id: Optional[int] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    note = db.query(Note).filter(Note.id == note_id, Note.user_id == current_user.id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    # Validating folder if it's not None
    if folder_id is not None:
        folder = db.query(Folder).filter(Folder.id == folder_id, Folder.user_id == current_user.id).first()
        if not folder:
            raise HTTPException(status_code=404, detail="Folder not found")
            
    note.folder_id = folder_id
    db.commit()
    return {"message": "Moved successfully"}

@router.put("/notes/{note_id}/rename")
def rename_note(note_id: int, req: NoteRename, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    note = db.query(Note).filter(Note.id == note_id, Note.user_id == current_user.id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
        
    note.title = req.title
    db.commit()
    return {"message": "Renamed successfully"}

@router.put("/notes/{note_id}/favorite")
def toggle_favorite(note_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    note = db.query(Note).filter(Note.id == note_id, Note.user_id == current_user.id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    if note.is_favorite:
        # Removing from favorites
        note.is_favorite = False
        db.commit()
        db.refresh(note)
        
        # Check if there are any more favorites
        remaining_favorites = db.query(Note).filter(
            Note.user_id == current_user.id,
            Note.is_favorite == True
        ).count()
        
        # Delete Favorites folder if no more favorites
        if remaining_favorites == 0:
            favorites_folder = db.query(Folder).filter(
                Folder.user_id == current_user.id,
                Folder.name == "Favorites"
            ).first()
            if favorites_folder:
                db.delete(favorites_folder)
                db.commit()
    else:
        # Adding to favorites - create folder if needed
        note.is_favorite = True
        
        # Create Favorites folder if it doesn't exist
        favorites_folder = db.query(Folder).filter(
            Folder.user_id == current_user.id,
            Folder.name == "Favorites"
        ).first()
        
        if not favorites_folder:
            favorites_folder = Folder(name="Favorites", user_id=current_user.id)
            db.add(favorites_folder)
            db.commit()
        
        db.commit()
        db.refresh(note)
    
    return {"is_favorite": note.is_favorite}

@router.post("/notes", response_model=NoteResponse)
def create_note(req: NoteCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Create a new note (used for copy/paste functionality)"""
    note = Note(
        title=req.title,
        content=req.content,
        subject=req.subject,
        folder_id=req.folder_id,
        user_id=current_user.id,
        status="completed",
        source_type="Custom Note"
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return {
        "id": note.id,
        "title": note.title,
        "subject": note.subject,
        "status": note.status,
        "folder_id": note.folder_id,
        "content": note.content,
        "video_url": note.video_url,
        "source_type": note.source_type
    }

class NoteContentUpdate(BaseModel):
    content: str

@router.put("/notes/{note_id}")
def update_note_content(note_id: int, req: NoteContentUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    note = db.query(Note).filter(Note.id == note_id, Note.user_id == current_user.id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
        
    note.content = req.content
    db.commit()
    db.refresh(note)
    return {
        "id": note.id,
        "title": note.title,
        "subject": note.subject,
        "status": note.status,
        "folder_id": note.folder_id,
        "content": note.content,
        "video_url": note.video_url,
        "source_type": note.source_type
    }
@router.get("/notes/{note_id}", response_model=NoteResponse)
def get_note(note_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    note = db.query(Note).filter(Note.id == note_id, Note.user_id == current_user.id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    # Return note with all fields including video_url and source_type
    return {
        "id": note.id,
        "title": note.title,
        "subject": note.subject,
        "status": note.status,
        "folder_id": note.folder_id,
        "content": note.content,
        "video_url": note.video_url,
        "source_type": note.source_type
    }

class RefineRequest(BaseModel):
    instruction: str

class StudyBuddyRequest(BaseModel):
    conversation_id: Optional[str] = None
    message: str
    original_content: str

class ApplyChangesRequest(BaseModel):
    conversation_id: str
    original_content: str

@router.post("/notes/{note_id}/study-buddy")
def study_buddy_chat(note_id: int, req: StudyBuddyRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Multi-turn chat for refining notes.
    AI asks clarifying questions about where/how to apply changes.
    """
    note = db.query(Note).filter(Note.id == note_id, Note.user_id == current_user.id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    from services.ai_generator import study_buddy_chat_response
    import uuid
    
    try:
        # Generate conversation ID if first message
        conversation_id = req.conversation_id or str(uuid.uuid4())
        
        # Get AI response (clarifying questions about the change)
        ai_response = study_buddy_chat_response(
            original_content=req.original_content,
            user_message=req.message,
            conversation_id=conversation_id
        )
        
        return {
            "conversation_id": conversation_id,
            "response": ai_response
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/notes/{note_id}/study-buddy/apply")
def apply_buddy_changes(note_id: int, req: ApplyChangesRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Apply the changes discussed in the study buddy chat to the actual note.
    """
    note = db.query(Note).filter(Note.id == note_id, Note.user_id == current_user.id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    from services.ai_generator import apply_buddy_changes
    
    try:
        updated_content = apply_buddy_changes(
            original_content=req.original_content,
            conversation_id=req.conversation_id
        )
        
        note.content = updated_content
        db.commit()
        
        return {
            "message": "Changes applied successfully",
            "updated_content": updated_content
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/notes/{note_id}/refine")
def refine_note_endpoint(note_id: int, req: RefineRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    note = db.query(Note).filter(Note.id == note_id, Note.user_id == current_user.id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
        
    from services.ai_generator import refine_notes
    try:
        new_content = refine_notes(note.content, req.instruction)
        note.content = new_content
        db.commit()
        return {"message": "Refined successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
@router.delete("/notes/{note_id}")
def delete_note(note_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    note = db.query(Note).filter(Note.id == note_id, Note.user_id == current_user.id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    db.delete(note)
    db.commit()
    return {"message": "Note deleted successfully"}

@router.delete("/folders/{folder_id}")
def delete_folder(folder_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    folder = db.query(Folder).filter(Folder.id == folder_id, Folder.user_id == current_user.id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    
    # Delete all notes in the folder first
    db.query(Note).filter(Note.folder_id == folder_id).delete()
    db.delete(folder)
    db.commit()
    return {"message": "Folder deleted successfully"}
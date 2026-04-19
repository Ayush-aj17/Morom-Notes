#!/usr/bin/env python3
"""Test the complete note generation pipeline"""

import os
import sys
import logging
from datetime import datetime

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)

# Add parent to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database.db import SessionLocal
from database.models import User, Lecture, Note
from models.lecture_models import LectureInfo
from services import lecture_service, processing_service

def test_pipeline():
    """Test creating a lecture and note, then processing"""
    db = SessionLocal()
    
    try:
        # 1. Create or get test user
        logger.info("=" * 60)
        logger.info("Step 1: Getting/Creating test user")
        logger.info("=" * 60)
        
        test_user = db.query(User).filter(User.username == "test_user").first()
        if not test_user:
            from services.auth import get_password_hash
            test_user = User(
                username="test_user",
                hashed_password=get_password_hash("test123")
            )
            db.add(test_user)
            db.commit()
            db.refresh(test_user)
            logger.info("✓ Created test user (id=%s)", test_user.id)
        else:
            logger.info("✓ Using existing test user (id=%s)", test_user.id)
        
        # 2. Create lecture
        logger.info("\n" + "=" * 60)
        logger.info("Step 2: Creating lecture record")
        logger.info("=" * 60)
        
        lecture_data = LectureInfo(
            title="Test Lecture - " + datetime.now().strftime("%Y%m%d_%H%M%S"),
            subject="Test Subject",
            user_id=test_user.id
        )
        
        lecture = lecture_service.create_lecture(db, lecture_data, status="pending")
        logger.info("✓ Created lecture (id=%s, title=%s)", lecture.id, lecture.title)
        
        # 3. Check if note was created
        logger.info("\n" + "=" * 60)
        logger.info("Step 3: Checking if note was auto-created")
        logger.info("=" * 60)
        
        note = db.query(Note).filter(
            Note.user_id == test_user.id,
            Note.title == lecture.title
        ).first()
        
        if note:
            logger.info("✓ Note auto-created (id=%s, status=%s)", note.id, note.status)
        else:
            logger.error("✗ Note was NOT auto-created!")
            logger.error("  Expected: user_id=%s, title=%s", test_user.id, lecture.title)
            
            # List all notes for this user
            notes = db.query(Note).filter(Note.user_id == test_user.id).all()
            logger.error("  User has %d notes total:", len(notes))
            for n in notes:
                logger.error("    - Note(id=%s, title=%s, status=%s)", n.id, n.title, n.status)
        
        # 4. Test services
        logger.info("\n" + "=" * 60)
        logger.info("Step 4: Testing individual services")
        logger.info("=" * 60)
        
        # Test transcription
        logger.info("Testing transcription service...")
        try:
            from services.transcription_service import _get_model
            model = _get_model()
            logger.info("✓ Whisper model loaded successfully")
        except Exception as e:
            logger.error("✗ Whisper model failed: %s", e)
        
        # Test AI generation
        logger.info("Testing AI generation service...")
        try:
            test_text = "Loops are used in programming with for and while statements to repeat code."
            result = processing_service.ai_service.generate_notes_from_transcript(test_text)
            if result and len(result) > 0:
                logger.info("✓ AI generation works")
                logger.info("  Generated %d characters", len(result))
            else:
                logger.error("✗ AI generation returned empty result")
        except Exception as e:
            logger.error("✗ AI generation failed: %s", e)
        
        # Summary
        logger.info("\n" + "=" * 60)
        logger.info("Test Complete")
        logger.info("=" * 60)
        logger.info("Key findings:")
        logger.info("- Test user: %s (id=%s)", test_user.username, test_user.id)
        logger.info("- Lecture created: %s (id=%s)", lecture.title, lecture.id)
        logger.info("- Note auto-created: %s", "YES" if note else "NO")
        logger.info("=" * 60)
        
    except Exception as e:
        logger.exception("Test failed with error: %s", e)
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    test_pipeline()

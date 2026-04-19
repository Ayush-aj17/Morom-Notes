#!/usr/bin/env python3
"""
COMPLETE CLEANUP: Delete all users, folders, and notes from database
Use this after the delete_users.py upgrades to ensure complete cleanup
"""

import os
import sys
import logging
from typing import List

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database.db import SessionLocal
from database.models import User, Folder, Note, Lecture

def complete_cleanup():
    """Delete ALL records from the database - nuclear option"""
    
    db = SessionLocal()
    
    try:
        logger.info("=" * 60)
        logger.info("COMPLETE DATABASE CLEANUP")
        logger.info("=" * 60)
        
        # Get counts before deletion
        user_count = db.query(User).count()
        note_count = db.query(Note).count()
        folder_count = db.query(Folder).count()
        lecture_count = db.query(Lecture).count()
        
        logger.info(f"\nCurrent records:")
        logger.info(f"  Users: {user_count}")
        logger.info(f"  Folders: {folder_count}")
        logger.info(f"  Notes: {note_count}")
        logger.info(f"  Lectures: {lecture_count}")
        
        total = user_count + folder_count + note_count + lecture_count
        
        if total == 0:
            logger.info("\n✓ Database is already clean!")
            return True
        
        response = input(f"\n⚠️  NUCLEAR CLEANUP: This will delete ALL {total} records!\nAre you sure? (type 'DELETE ALL' to confirm): ")
        
        if response != 'DELETE ALL':
            logger.info("❌ Cleanup cancelled")
            return False
        
        # Delete in order (safest approach)
        logger.info("\n🗑️  Deleting records...")
        
        # Delete notes first (has foreign keys)
        note_deleted = db.query(Note).delete()
        logger.info(f"  ✓ Deleted {note_deleted} notes")
        
        # Delete folders
        folder_deleted = db.query(Folder).delete()
        logger.info(f"  ✓ Deleted {folder_deleted} folders")
        
        # Delete users
        user_deleted = db.query(User).delete()
        logger.info(f"  ✓ Deleted {user_deleted} users")
        
        # Delete lectures
        lecture_deleted = db.query(Lecture).delete()
        logger.info(f"  ✓ Deleted {lecture_deleted} lectures")
        
        db.commit()
        
        logger.info(f"\n✅ Database cleanup complete!")
        logger.info(f"   Total records deleted: {total}")
        logger.info("\n📝 Next steps:")
        logger.info("   1. Clear browser localStorage (F12 → Application → Local Storage)")
        logger.info("   2. Sign up with a fresh account")
        logger.info("   3. All data will be clean!")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error during cleanup: {str(e)}")
        db.rollback()
        return False
    finally:
        db.close()

if __name__ == '__main__':
    success = complete_cleanup()
    sys.exit(0 if success else 1)

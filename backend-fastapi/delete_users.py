#!/usr/bin/env python3
"""Delete all user records from the database"""

import os
import sys
import logging
from typing import List

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database.db import SessionLocal
from database.models import User, Folder, Note

def delete_all_users():
    """Delete all users and their associated data from the database"""
    
    db = SessionLocal()
    
    try:
        logger.info("=" * 60)
        logger.info("Deleting All User Records")
        logger.info("=" * 60)
        
        # Get count of users before deletion
        user_count = db.query(User).count()
        note_count = db.query(Note).filter(Note.user_id.isnot(None)).count()
        folder_count = db.query(Folder).filter(Folder.user_id.isnot(None)).count()
        
        logger.info(f"\nCurrent records:")
        logger.info(f"  Users: {user_count}")
        logger.info(f"  Notes (user-owned): {note_count}")
        logger.info(f"  Folders (user-owned): {folder_count}")
        
        # Confirm deletion
        if user_count == 0:
            logger.info("\n✓ No users to delete")
            return
        
        response = input(f"\n⚠️  This will delete {user_count} users and all their associated data.\nContinue? (yes/no): ")
        
        if response.lower() != 'yes':
            logger.info("Deletion cancelled")
            return
        
        # Delete orphaned notes and folders first (safety measure)
        logger.info("\nCleaning up orphaned records...")
        orphaned_notes = db.query(Note).filter(Note.user_id.isnot(None)).delete()
        orphaned_folders = db.query(Folder).filter(Folder.user_id.isnot(None)).delete()
        db.commit()
        logger.info(f"  Deleted {orphaned_notes} orphaned notes")
        logger.info(f"  Deleted {orphaned_folders} orphaned folders")
        
        # Delete all user data (cascade will handle remaining notes and folders)
        logger.info("\nDeleting user records...")
        deleted_count = db.query(User).delete()
        db.commit()
        
        logger.info(f"✓ Deleted {deleted_count} users")
        
        # Verify deletion
        remaining_users = db.query(User).count()
        logger.info(f"✓ Remaining users: {remaining_users}")
        
        logger.info("\n" + "=" * 60)
        logger.info("✓ User deletion completed successfully")
        logger.info("=" * 60)
        
    except Exception as e:
        db.rollback()
        logger.error(f"✗ Error deleting users: {str(e)}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    delete_all_users()

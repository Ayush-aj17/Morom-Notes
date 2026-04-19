#!/usr/bin/env python3
"""Delete all user accounts except the one with a specific email"""

import os
import sys
import logging
from typing import List

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database.db import SessionLocal
from database.models import User, Folder, Note

def delete_all_except_email(keep_email: str):
    """Delete all users except the one with the specified email"""
    
    db = SessionLocal()
    
    try:
        logger.info("=" * 60)
        logger.info("Deleting All Accounts Except One")
        logger.info("=" * 60)
        
        # Find the account to keep
        keep_user = db.query(User).filter(User.email == keep_email).first()
        
        if not keep_user:
            logger.error(f"\n✗ No account found with email: {keep_email}")
            logger.error("Please verify the email address is correct")
            return False
        
        logger.info(f"\n✓ Account to keep: @{keep_user.username} ({keep_email})")
        
        # Get all users except the one to keep
        users_to_delete = db.query(User).filter(User.email != keep_email).all()
        
        user_count = len(users_to_delete)
        
        if user_count == 0:
            logger.info("\n✓ No other accounts to delete")
            return True
        
        # Count associated data
        note_count = sum(db.query(Note).filter(Note.user_id == u.id).count() for u in users_to_delete)
        folder_count = sum(db.query(Folder).filter(Folder.user_id == u.id).count() for u in users_to_delete)
        
        logger.info(f"\nAccounts to delete: {user_count}")
        logger.info(f"  Notes (to be deleted): {note_count}")
        logger.info(f"  Folders (to be deleted): {folder_count}")
        
        # Confirm deletion
        response = input(f"\n⚠️  This will delete {user_count} user accounts and all their associated data.\nContinue? (yes/no): ")
        
        if response.lower() != 'yes':
            logger.info("\n✗ Deletion cancelled")
            return False
        
        # Delete users and their associated data (cascading)
        deleted_count = 0
        for user in users_to_delete:
            try:
                logger.info(f"  Deleting @{user.username}...")
                db.delete(user)
                db.commit()
                deleted_count += 1
            except Exception as e:
                db.rollback()
                logger.error(f"  ✗ Failed to delete @{user.username}: {str(e)}")
        
        logger.info(f"\n{'='*60}")
        logger.info(f"✓ Successfully deleted {deleted_count} accounts")
        logger.info(f"✓ Kept account: @{keep_user.username}")
        logger.info(f"{'='*60}")
        return True
        
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        db.rollback()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python delete_accounts_except_one.py <email_to_keep>")
        print("Example: python delete_accounts_except_one.py jatukarnaayush@gmail.com")
        sys.exit(1)
    
    email_to_keep = sys.argv[1]
    try:
        success = delete_all_except_email(email_to_keep)
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

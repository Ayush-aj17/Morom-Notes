#!/usr/bin/env python3
"""Automatically delete all users and clear database"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database.db import SessionLocal
from database.models import User, Folder, Note

db = SessionLocal()

try:
    # Delete in order: Notes, Folders, then Users (cascade will handle this anyway)
    notes_deleted = db.query(Note).delete()
    folders_deleted = db.query(Folder).delete()
    users_deleted = db.query(User).delete()
    
    db.commit()
    
    print(f"✓ Deleted {users_deleted} users")
    print(f"✓ Deleted {folders_deleted} folders")
    print(f"✓ Deleted {notes_deleted} notes")
    print("\n✓ Database cleaned successfully!")
    
except Exception as e:
    db.rollback()
    print(f"❌ Error: {e}")
finally:
    db.close()

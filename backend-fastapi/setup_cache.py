#!/usr/bin/env python3
"""
Setup script for Global Note Cache
Creates the cached_notes table in the database
"""

import os
import sys
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database.db import SessionLocal
from database.models import Base, CachedNote
from sqlalchemy import inspect

def setup_cache():
    """Initialize the cache tables"""
    
    db = SessionLocal()
    
    try:
        logger.info("=" * 60)
        logger.info("Setting up Global Note Cache")
        logger.info("=" * 60)
        
        # Check if table exists
        inspector = inspect(db.get_bind())
        existing_tables = inspector.get_table_names()
        
        if 'cached_notes' in existing_tables:
            logger.info("\n✓ Table 'cached_notes' already exists!")
            
            # Get stats
            count = db.query(CachedNote).count()
            logger.info(f"  Current cached notes: {count}")
            
            return True
        
        logger.info("\n📦 Creating cached_notes table...")
        
        # Create the table
        Base.metadata.create_all(db.get_bind())
        
        logger.info("✓ Table created successfully!")
        
        logger.info("\n" + "=" * 60)
        logger.info("✅ Cache System Ready!")
        logger.info("=" * 60)
        logger.info("\nThe global note cache is now active:")
        logger.info("  • YouTube videos will be cached globally")
        logger.info("  • Same video = instant notes for users (0 API calls)")
        logger.info("  • Use /api/notes/cache/stats to monitor")
        logger.info("\n📚 Check GLOBAL_CACHE_NOTES.md for full documentation")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Setup failed: {str(e)}")
        return False
    finally:
        db.close()

if __name__ == '__main__':
    success = setup_cache()
    sys.exit(0 if success else 1)

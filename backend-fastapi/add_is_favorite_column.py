#!/usr/bin/env python3
"""Add is_favorite column to notes table if it doesn't exist"""

import os
import sys
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database.db import engine
from sqlalchemy import inspect, Column, Boolean, text

logger.info("=" * 60)
logger.info("Adding is_favorite column to notes table")
logger.info("=" * 60)

try:
    # Check if column exists
    inspector = inspect(engine)
    columns = [col['name'] for col in inspector.get_columns('notes')]
    
    if 'is_favorite' in columns:
        logger.info("Column 'is_favorite' already exists. Skipping.")
    else:
        logger.info("Column 'is_favorite' does not exist. Adding it...")
        
        # Add the column
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE notes ADD COLUMN is_favorite BOOLEAN DEFAULT 0"))
            conn.commit()
            logger.info("Successfully added 'is_favorite' column to notes table!")
            
except Exception as e:
    logger.error(f"Error: {e}")
    logger.info("If using SQLite and this fails, you may need to manually recreate the table.")
    logger.info("Consider using reset_db.py if needed.")
    sys.exit(1)

logger.info("=" * 60)
logger.info("Migration complete!")
logger.info("=" * 60)

#!/usr/bin/env python3
"""Reset the database schema"""

import os
import sys
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database.db import engine, DATABASE_URL
from database.models import Base

logger.info("=" * 60)
logger.info("Resetting Database Schema")
logger.info("=" * 60)

logger.info("=" * 60)
logger.info("Resetting Database Schema")
logger.info("=" * 60)

# Get the database file path if using SQLite
if 'sqlite' in DATABASE_URL:
    db_path = DATABASE_URL.replace('sqlite:///', '').replace('sqlite://','')
    logger.info("Database file: %s", db_path)
    if os.path.exists(db_path):
        logger.info("Attempting to remove old database file...")
        try:
            os.remove(db_path)
            logger.info("✓ Old database removed")
        except PermissionError:
            logger.warning("⚠ Database file is locked (backend may still be running)")
            logger.info("  Proceeding to reset schema anyway...")

# Create all tables fresh
logger.info("Creating fresh database schema...")
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)
logger.info("✓ Database schema created successfully")

# Verify tables
logger.info("\nVerifying tables...")
inspector = __import__('sqlalchemy').inspect(engine)
tables = inspector.get_table_names()
logger.info("Tables created:")
for table in tables:
    columns = inspector.get_columns(table)
    logger.info(f"  {table}:")
    for col in columns:
        logger.info(f"    - {col['name']} ({col['type']})")

logger.info("\n" + "=" * 60)
logger.info("Database ready!")
logger.info("=" * 60)

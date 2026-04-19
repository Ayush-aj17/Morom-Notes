#!/usr/bin/env python3
"""Diagnostic script to test if all services can be initialized"""

import sys
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

print("=" * 60)
print("Testing Backend Services")
print("=" * 60)

# Test 1: Test imports
print("\n[1] Testing imports...")
try:
    from services import video_service, transcription_service, ai_service
    print("✓ All service imports successful")
except ImportError as e:
    print(f"✗ Import failed: {e}")
    sys.exit(1)

# Test 2: Test moviepy
print("\n[2] Testing moviepy (video audio extraction)...")
try:
    from moviepy import VideoFileClip
    print("✓ MoviePy available")
except ImportError as e:
    print(f"✗ MoviePy import failed: {e}")

# Test 3: Test whisper
print("\n[3] Testing whisper (audio transcription)...")
try:
    import whisper
    print("✓ Whisper available")
    print("  (Note: First use will download model, may take a while)")
except ImportError as e:
    print(f"✗ Whisper import failed: {e}")
    sys.exit(1)

# Test 4: Test ollama connection
print("\n[4] Testing Ollama (AI notes generation)...")
try:
    import ollama
    print("✓ Ollama client available")
    
    # Try to list models
    try:
        models = ollama.list()
        print(f"✓ Ollama connection successful")
        print(f"  Available models: {', '.join([m.model for m in models.models]) if models.models else 'None (pull a model with: ollama pull llama3)'}")
    except Exception as e:
        print(f"✗ Cannot connect to Ollama service: {e}")
        print("  Make sure Ollama is running: ollama serve")
        
except ImportError as e:
    print(f"✗ Ollama not available: {e}")

# Test 5: Test database connection
print("\n[5] Testing database connection...")
try:
    from database.db import get_db, engine
    from database.models import Base
    
    # Try to connect
    with engine.connect() as conn:
        print("✓ Database connection successful")
        Base.metadata.create_all(bind=engine)
        print("✓ Database tables created/verified")
except Exception as e:
    print(f"✗ Database connection failed: {e}")

print("\n" + "=" * 60)
print("Diagnostic Complete")
print("=" * 60)
print("\nTo fix issues:")
print("- If Ollama fails: Download from ollama.ai and run 'ollama serve'")
print("- If first Whisper use: Download model with 'whisper' command") 
print("- If database fails: Check DATABASE_URL in .env")
print("=" * 60)

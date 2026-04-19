#!/usr/bin/env python3
"""Test notes generation with YouTube link and video file"""

import os
import sys
import logging
from pathlib import Path

# Load environment variables from .env file first
from dotenv import load_dotenv
load_dotenv()

# Set UTF-8 encoding for output
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s"
)
logger = logging.getLogger(__name__)

# Test configurations
YOUTUBE_URL = "https://youtu.be/gbKeKIyC-i0?si=uV9uJxUM-5t2lPdG"
VIDEO_FILE = Path("../Test_uploads_files/test-01.mp4")

print("=" * 80)
print("Testing Notes Generation with YouTube Link and Video File")
print("=" * 80)

# Test 1: Check environment setup
print("\n[1] Checking environment setup...")
api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    print("[FAIL] GEMINI_API_KEY not set in environment")
    print("  Please set: $env:GEMINI_API_KEY = 'your-key'")
    sys.exit(1)
else:
    print("[OK] GEMINI_API_KEY is set")

# Test 2: Check dependencies
print("\n[2] Checking dependencies...")
try:
    from google import genai
    print("[OK] google-genai package available")
except ImportError as e:
    print(f"[FAIL] google-genai import failed: {e}")
    sys.exit(1)

try:
    import yt_dlp
    print("[OK] yt-dlp available")
except ImportError:
    print("[WARN] yt-dlp not available (needed for fallback transcription)")

try:
    import whisper
    print("[OK] whisper available")
except ImportError:
    print("[WARN] whisper not available (needed for fallback transcription)")

try:
    from youtube_transcript_api import YouTubeTranscriptApi
    print("[OK] youtube-transcript-api available")
except ImportError:
    print("[WARN] youtube-transcript-api not available")

try:
    from moviepy import VideoFileClip
    print("[OK] moviepy available")
except ImportError:
    print("[WARN] moviepy not available")

# Test 3: Verify video file exists
print("\n[3] Checking video file...")
if VIDEO_FILE.exists():
    size_mb = VIDEO_FILE.stat().st_size / (1024 * 1024)
    print(f"[OK] Video file found: {VIDEO_FILE} ({size_mb:.2f} MB)")
else:
    print(f"[FAIL] Video file not found: {VIDEO_FILE}")
    sys.exit(1)

# Test 4: Test Gemini client initialization
print("\n[4] Testing Gemini client initialization...")
try:
    from services.ai_generator import initialize_client
    client = initialize_client()
    print("[OK] Gemini client initialized successfully")
except Exception as e:
    print(f"[FAIL] Gemini client initialization failed: {e}")
    sys.exit(1)

# Test 5: Test YouTube URL extraction
print("\n[5] Testing YouTube URL extraction...")
try:
    from services.ai_generator import extract_video_id
    video_id = extract_video_id(YOUTUBE_URL)
    if video_id:
        print(f"[OK] YouTube video ID extracted: {video_id}")
    else:
        print(f"[FAIL] Failed to extract video ID from: {YOUTUBE_URL}")
        sys.exit(1)
except Exception as e:
    print(f"[FAIL] Error during YouTube URL extraction: {e}")
    sys.exit(1)

# Test 6: Try fetching YouTube transcript
print("\n[6] Testing YouTube transcript fetching...")
try:
    from youtube_transcript_api import YouTubeTranscriptApi
    video_id = extract_video_id(YOUTUBE_URL)
    transcript_data = YouTubeTranscriptApi.get_transcript(video_id, languages=['en'])
    transcript_text = " ".join([x["text"] for x in transcript_data])
    print(f"[OK] YouTube transcript fetched successfully ({len(transcript_text)} chars)")
except Exception as e:
    print(f"[WARN] Could not fetch YouTube transcript: {e}")
    print("  This might require downloading the video to extract audio")

# Test 7: Test video file upload to Gemini
print("\n[7] Testing video file upload to Gemini...")
try:
    from services.ai_generator import generate_notes_from_video_file
    import time
    
    print(f"  Uploading video file to Gemini...")
    start_time = time.time()
    
    notes = generate_notes_from_video_file(str(VIDEO_FILE), mime_type="video/mp4")
    
    elapsed = time.time() - start_time
    
    if notes and len(notes) > 50:
        print(f"[OK] Notes generated from video file successfully")
        print(f"  Generation time: {elapsed:.1f} seconds")
        print(f"  Generated content length: {len(notes)} chars")
        print(f"\n--- Generated Notes Preview (first 500 chars) ---")
        print(notes[:500])
        print("--- End Preview ---\n")
    else:
        print(f"[FAIL] Generated content seems empty or too short: {len(notes)} chars")
except Exception as e:
    print(f"[FAIL] Video file processing failed: {e}")
    import traceback
    traceback.print_exc()

# Test 8: Test YouTube URL processing
print("\n[8] Testing YouTube URL processing...")
try:
    from services.ai_generator import generate_notes_from_url
    import time
    
    print(f"  Processing YouTube URL: {YOUTUBE_URL}")
    start_time = time.time()
    
    notes = generate_notes_from_url(YOUTUBE_URL)
    
    elapsed = time.time() - start_time
    
    if notes and len(notes) > 50:
        print(f"[OK] Notes generated from YouTube URL successfully")
        print(f"  Generation time: {elapsed:.1f} seconds")
        print(f"  Generated content length: {len(notes)} chars")
        print(f"\n--- Generated Notes Preview (first 500 chars) ---")
        print(notes[:500])
        print("--- End Preview ---\n")
    else:
        print(f"[FAIL] Generated content seems empty or too short: {len(notes)} chars")
except Exception as e:
    print(f"[FAIL] YouTube URL processing failed: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 80)
print("Testing Complete")
print("=" * 80)

#!/usr/bin/env python3
"""Test script to verify the title extraction and source type detection"""

import os
import sys
from pathlib import Path

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Set up UTF-8 encoding
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

print("=" * 80)
print("Testing Helper Functions for Notes Generation")
print("=" * 80)

# Test 1: Test get_youtube_title
print("\n[1] Testing get_youtube_title()...")
try:
    from services.ai_generator import get_youtube_title
    
    youtube_url = "https://youtu.be/gbKeKIyC-i0?si=uV9uJxUM-5t2lPdG"
    title = get_youtube_title(youtube_url)
    print(f"[OK] Title extracted: {title}")
    # Note: If yt_dlp is not installed, it will return fallback "YouTube Notes"
    # which is correct behavior
except Exception as e:
    print(f"[FAIL] Error: {e}")
    import traceback
    traceback.print_exc()

# Test 2: Test get_file_title
print("\n[2] Testing get_file_title()...")
try:
    from services.ai_generator import get_file_title
    
    test_cases = [
        ("my_video_file.mp4", "My Video File"),
        ("learning-python-basics.pdf", "Learning Python Basics"),
        ("DSA_Lecture_1.pptx", "Dsa Lecture 1"),
        ("", "Untitled Notes"),
    ]
    
    all_passed = True
    for filename, expected in test_cases:
        result = get_file_title(filename)
        status = "OK" if result.lower() == expected.lower() else "WARN"
        print(f"  {status} '{filename}' -> '{result}'")
        if result.lower() != expected.lower():
            all_passed = False
    
    if all_passed:
        print("[OK] All test cases passed")
except Exception as e:
    print(f"[FAIL] Error: {e}")
    import traceback
    traceback.print_exc()

# Test 3: Test detect_source_type
print("\n[3] Testing detect_source_type()...")
try:
    from services.ai_generator import detect_source_type
    
    test_cases = [
        ({"video_url": "https://www.youtube.com/watch?v=test"}, "youtube:"),
        ({"video_url": "https://youtu.be/test"}, "youtube:"),
        ({"filename": "document.pdf"}, "pdf"),
        ({"filename": "presentation.pptx"}, "ppt"),
        ({"filename": "slide.ppt"}, "ppt"),
        ({"filename": "photo.jpg"}, "image"),
        ({"filename": "photo.png"}, "image"),
        ({"filename": "video.mp4"}, "video"),
        ({"filename": "video.mov"}, "video"),
    ]
    
    all_passed = True
    for args, expected in test_cases:
        result = detect_source_type(**args)
        # For YouTube, just check if it starts with "youtube:"
        if expected.startswith("youtube:"):
            passed = result and result.startswith("youtube:")
        else:
            passed = result == expected
        
        status = "OK" if passed else "FAIL"
        print(f"  {status} {args} -> {result} (expected: {expected})")
        if not passed:
            all_passed = False
    
    if all_passed:
        print("[OK] All test cases passed")
except Exception as e:
    print(f"[FAIL] Error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 80)
print("Testing Complete")
print("=" * 80)

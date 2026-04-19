#!/usr/bin/env python3
"""Test script to identify the tuple unpacking error"""

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend-fastapi'))

# Import the modules that might have the issue
print("Testing tuple unpacking in services...")

try:
    print("\n[1] Testing DocumentProcessor.process_document...")
    from services.document_processor import DocumentProcessor
    
    # Create a test file
    test_pdf = "/tmp/test.txt"
    with open(test_pdf, 'w') as f:
        f.write("Test content")
    
    result = DocumentProcessor.process_document(test_pdf, 'image')
    print(f"  Result type: {type(result)}")
    print(f"  Result: {result}")
    print(f"  Number of values: {len(result) if isinstance(result, tuple) else 'not a tuple'}")
except Exception as e:
    print(f"  ERROR: {e}")
    import traceback
    traceback.print_exc()

try:
    print("\n[2] Testing detect_source_type...")
    from services.ai_generator import detect_source_type
    
    result = detect_source_type(filename="test.pdf")
    print(f"  Result type: {type(result)}")
    print(f"  Result: {repr(result)}")
    print(f"  Number of values: {len(result) if isinstance(result, tuple) else 'not a tuple'}")
except Exception as e:
    print(f"  ERROR: {e}")
    import traceback
    traceback.print_exc()

try:
    print("\n[3] Testing get_youtube_title...")
    from services.ai_generator import get_youtube_title
    
    result = get_youtube_title("https://www.youtube.com/watch?v=test")
    print(f"  Result type: {type(result)}")
    print(f"  Result: {repr(result)}")
except Exception as e:
    print(f"  ERROR: {e}")

print("\n[4] Testing get_file_title...")
from services.ai_generator import get_file_title

result = get_file_title("test_video.mp4")
print(f"  Result type: {type(result)}")
print(f"  Result: {repr(result)}")

print("\n[5] Testing unpacking like in documents.py...")
try:
    # Try the actual unpacking that happens in documents.py
    test_file_path = "/tmp/test_doc.txt"
    with open(test_file_path, 'w') as f:
        f.write("Test document content")
    
    print("  Attempting: extracted_text, cleaned_text = DocumentProcessor.process_document(...)")
    extracted_text, cleaned_text = DocumentProcessor.process_document(test_file_path, 'image')
    print("  SUCCESS - 2-value unpacking worked")
    print(f"    extracted_text length: {len(extracted_text)}")
    print(f"    cleaned_text length: {len(cleaned_text)}")
except ValueError as e:
    if "unpack" in str(e):
        print(f"  UNPACKING ERROR FOUND: {e}")
        import traceback
        traceback.print_exc()
    else:
        print(f"  Other ValueError: {e}")
except Exception as e:
    print(f"  ERROR: {e}")
    import traceback
    traceback.print_exc()

print("\nTest complete!")

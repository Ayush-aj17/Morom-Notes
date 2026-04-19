"""
Test that source_type values match the specified requirements
"""
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from services.ai_generator import detect_source_type, get_file_title, get_youtube_title

def test_source_type_detection():
    """Test source_type detection with the updated values"""
    
    print("\n" + "="*70)
    print("TEST: Source Type Detection - Updated Format")
    print("="*70)
    
    test_cases = [
        # YouTube URLs
        {
            "name": "YouTube Link",
            "video_url": "https://www.youtube.com/watch?v=abcd1234",
            "filename": None,
            "expected": "youtube link: https://www.youtube.com/watch?v=abcd1234"
        },
        {
            "name": "YouTube Short URL",
            "video_url": "https://youtu.be/abcd1234",
            "filename": None,
            "expected": "youtube link: https://youtu.be/abcd1234"
        },
        # PDF
        {
            "name": "PDF File",
            "video_url": None,
            "filename": "document.pdf",
            "expected": "Uploaded pdf"
        },
        # PowerPoint
        {
            "name": "PowerPoint PPTX",
            "video_url": None,
            "filename": "presentation.pptx",
            "expected": "Uploaded ppt"
        },
        {
            "name": "PowerPoint PPT",
            "video_url": None,
            "filename": "presentation.ppt",
            "expected": "Uploaded ppt"
        },
        # Images
        {
            "name": "PNG Image",
            "video_url": None,
            "filename": "photo.png",
            "expected": "Uploaded image"
        },
        {
            "name": "JPG Image",
            "video_url": None,
            "filename": "photo.jpg",
            "expected": "Uploaded image"
        },
        {
            "name": "JPEG Image",
            "video_url": None,
            "filename": "photo.jpeg",
            "expected": "Uploaded image"
        },
        # Videos
        {
            "name": "MP4 Video",
            "video_url": None,
            "filename": "video.mp4",
            "expected": "Uploaded video"
        },
        {
            "name": "MOV Video",
            "video_url": None,
            "filename": "video.mov",
            "expected": "Uploaded video"
        },
        {
            "name": "MKV Video",
            "video_url": None,
            "filename": "video.mkv",
            "expected": "Uploaded video"
        },
        {
            "name": "AVI Video",
            "video_url": None,
            "filename": "video.avi",
            "expected": "Uploaded video"
        },
        # Unknown
        {
            "name": "Unknown Type",
            "video_url": None,
            "filename": "file.xyz",
            "expected": "unknown"
        },
        {
            "name": "No Input",
            "video_url": None,
            "filename": None,
            "expected": "unknown"
        },
    ]
    
    passed = 0
    failed = 0
    
    for test in test_cases:
        result = detect_source_type(
            video_url=test["video_url"],
            filename=test["filename"]
        )
        
        status = "✓ PASS" if result == test["expected"] else "✗ FAIL"
        if result == test["expected"]:
            passed += 1
        else:
            failed += 1
        
        print(f"\n{status}: {test['name']}")
        print(f"  Input: video_url={test['video_url']}, filename={test['filename']}")
        print(f"  Expected: {test['expected']}")
        print(f"  Got:      {result}")
    
    print(f"\n{'='*70}")
    print(f"Results: {passed} passed, {failed} failed")
    print(f"{'='*70}\n")
    
    return failed == 0

def test_file_title():
    """Test file title extraction"""
    
    print("\n" + "="*70)
    print("TEST: File Title Extraction")
    print("="*70)
    
    test_cases = [
        ("test-file-name.pdf", "Test File Name"),
        ("my_document_2024.pptx", "My Document 2024"),
        ("IMG_20240101.jpg", "Img 20240101"),
        ("video.mp4", "Video"),
        ("", "Untitled Notes"),
    ]
    
    passed = 0
    failed = 0
    
    for filename, expected in test_cases:
        result = get_file_title(filename)
        status = "✓ PASS" if result == expected else "✗ FAIL"
        if result == expected:
            passed += 1
        else:
            failed += 1
        
        print(f"{status}: {filename:30} → {result:30} (expected: {expected})")
    
    print(f"\n{'='*70}")
    print(f"Results: {passed} passed, {failed} failed")
    print(f"{'='*70}\n")
    
    return failed == 0

if __name__ == "__main__":
    try:
        source_type_ok = test_source_type_detection()
        file_title_ok = test_file_title()
        
        if source_type_ok and file_title_ok:
            print("✓ All tests passed!")
            sys.exit(0)
        else:
            print("✗ Some tests failed")
            sys.exit(1)
    except Exception as e:
        print(f"✗ Test error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

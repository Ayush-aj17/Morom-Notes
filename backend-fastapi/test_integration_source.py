"""
Integration test: Verify notes are created with correct title and source_type
"""
import os
import sys
from io import BytesIO

os.environ["TESTING"] = "true"
sys.path.insert(0, os.path.dirname(__file__))

from fastapi.testclient import TestClient
from main import app
from database.db import SessionLocal
from database.models import User, Note
from sqlalchemy import text

client = TestClient(app)

def get_auth_token():
    """Get authentication token"""
    response = client.post("/auth/signup", json={
        "username": "testuser_src",
        "email": "testuser_src@example.com",
        "password": "testpass123"
    })
    
    if response.status_code == 400:
        response = client.post("/auth/login", json={
            "username": "testuser_src",
            "password": "testpass123"
        })
    
    if response.status_code in [200, 201]:
        return response.json().get("access_token")
    
    print(f"Auth failed: {response.status_code}")
    print(response.text)
    return None

def test_note_title_and_source_type():
    """Test that titles and source_type are set correctly"""
    
    print("\n" + "="*70)
    print("INTEGRATION TEST: Note Title & Source Type")
    print("="*70)
    
    token = get_auth_token()
    if not token:
        print("✗ Failed to get authentication token")
        return False
    
    headers = {"Authorization": f"Bearer {token}"}
    
    test_cases = [
        {
            "name": "Uploaded Video (.mp4)",
            "file": ("sample_video.mp4", BytesIO(b"FAKE_MP4_DATA" * 100), "video/mp4"),
            "expected_source": "Uploaded video",
            "expected_title_contains": "Sample Video"
        },
        {
            "name": "Uploaded MOV Video",
            "file": ("my_lecture.mov", BytesIO(b"FAKE_MOV_DATA" * 100), "video/quicktime"),
            "expected_source": "Uploaded video",
            "expected_title_contains": "My Lecture"
        },
    ]
    
    passed = 0
    failed = 0
    
    db = SessionLocal()
    
    for test in test_cases:
        print(f"\n[Test] {test['name']}")
        
        # Upload file
        files = {"file": test["file"]}
        response = client.post(
            "/api/notes/generate",
            files=files,
            headers=headers
        )
        
        if response.status_code != 200:
            print(f"  ✗ Upload failed: {response.status_code}")
            print(f"    {response.text}")
            failed += 1
            continue
        
        note_id = response.json().get("note_id")
        print(f"  Note ID: {note_id}")
        
        # Fetch the note from database
        note = db.query(Note).filter(Note.id == note_id).first()
        
        if not note:
            print(f"  ✗ Note not found in database")
            failed += 1
            continue
        
        print(f"  Title: {note.title}")
        print(f"  Source Type: {note.source_type}")
        print(f"  Subject: {note.subject}")
        
        # Verify source_type
        if note.source_type == test["expected_source"]:
            print(f"  ✓ Source type matches: {test['expected_source']}")
        else:
            print(f"  ✗ Source type mismatch")
            print(f"    Expected: {test['expected_source']}")
            print(f"    Got: {note.source_type}")
            failed += 1
            continue
        
        # Verify title contains expected text
        if test["expected_title_contains"].lower() in note.title.lower():
            print(f"  ✓ Title contains '{test['expected_title_contains']}'")
            passed += 1
        else:
            print(f"  ✗ Title doesn't contain expected text")
            print(f"    Expected to contain: {test['expected_title_contains']}")
            print(f"    Got: {note.title}")
            failed += 1
    
    db.close()
    
    print(f"\n{'='*70}")
    print(f"Results: {passed} passed, {failed} failed")
    print(f"{'='*70}\n")
    
    return failed == 0

if __name__ == "__main__":
    try:
        success = test_note_title_and_source_type()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n✗ Test error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

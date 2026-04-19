"""
Integration test: Verify title and source_type are set correctly
"""
import os
import sys
from io import BytesIO

os.environ["TESTING"] = "true"
sys.path.insert(0, os.path.dirname(__file__))

from fastapi.testclient import TestClient
from main import app
from database.db import SessionLocal
from database.models import Note

client = TestClient(app)

def get_auth_token():
    """Get authentication token"""
    import time
    username = f"test_{int(time.time())}"
    
    response = client.post("/auth/signup", json={
        "username": username,
        "email": f"{username}@example.com",
        "password": "pass123"
    })
    
    if response.status_code in [200, 201]:
        return response.json().get("access_token")
    
    print("Auth error: Status", response.status_code)
    print(response.text)
    return None

def test_title_and_source():
    """Test title and source_type extraction"""
    
    print("\n" + "="*70)
    print("TEST: Title and Source Type Extraction")
    print("="*70)
    
    token = get_auth_token()
    if not token:
        print("ERROR: Failed to authenticate")
        return False
    
    headers = {"Authorization": f"Bearer {token}"}
    db = SessionLocal()
    
    # Test 1: Video file
    print("\n[Test 1] Video file upload")
    files = {"file": ("my_lecture.mp4", BytesIO(b"FAKE_VIDEO_DATA" * 50), "video/mp4")}
    response = client.post("/api/notes/generate", files=files, headers=headers)
    
    if response.status_code != 200:
        print(f"  FAIL: Status {response.status_code}")
        return False
    
    note_id = response.json()["note_id"]
    note = db.query(Note).filter(Note.id == note_id).first()
    
    print(f"  Title: {note.title}")
    print(f"  Source Type: {note.source_type}")
    print(f"  Subject: {note.subject}")
    
    if note.source_type != "Uploaded video":
        print(f"  FAIL: Expected 'Uploaded video', got '{note.source_type}'")
        return False
    
    if "Lecture" not in note.title:
        print(f"  FAIL: Expected 'Lecture' in title, got '{note.title}'")
        return False
    
    print("  PASS: Title and source_type are correct")
    
    db.close()
    return True

if __name__ == "__main__":
    try:
        success = test_title_and_source()
        print("\n" + "="*70)
        if success:
            print("All tests PASSED!")
            sys.exit(0)
        else:
            print("Some tests FAILED")
            sys.exit(1)
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

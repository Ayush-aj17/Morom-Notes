"""
Direct test of the fixed video upload endpoint
"""
import os
import sys
import tempfile
from io import BytesIO

# Set testing mode
os.environ["TESTING"] = "true"

# Add the backend to path
sys.path.insert(0, os.path.dirname(__file__))

from fastapi.testclient import TestClient
from main import app
from database.db import SessionLocal
from database.models import User, Note
from routes.dashboard import get_current_user
import datetime

# Create test client
client = TestClient(app)

def create_test_user():
    """Create a test user"""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == "testuser").first()
        if not user:
            user = User(
                username="testuser",
                email="test@example.com",
                hashed_password="fakehash"
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        return user
    finally:
        db.close()

def get_auth_token():
    """Get auth token for test user"""
    # First, try signup
    response = client.post("/auth/signup", json={
        "username": "testuser",
        "email": "test@example.com",
        "password": "testpass"
    })
    
    if response.status_code == 400:  # User already exists
        print("User already exists, logging in...")
        # Try login
        response = client.post("/auth/login", json={
            "username": "testuser",
            "password": "testpass"
        })
    
    if response.status_code in [200, 201]:
        data = response.json()
        return data.get("access_token")
    
    print(f"Auth error: {response.status_code}")
    print(response.text)
    return None

def test_video_file_upload():
    """Test uploading a video file"""
    print("\n" + "="*60)
    print("TEST: Video File Upload with Error Handling")
    print("="*60)
    
    # Get auth token
    token = get_auth_token()
    if not token:
        print("Failed to get auth token")
        return False
    
    print("✓ Got auth token")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Create a small test video file (just dummy data)
    video_data = b"RIFF\x00\x00\x00\x00WAVE" + b"\x00" * 100
    
    # Test 1: Upload with valid extension
    print("\n[Test 1] Upload with valid .mp4 extension...")
    files = {
        "file": ("test_video.mp4", BytesIO(video_data), "video/mp4")
    }
    
    response = client.post(
        "/api/notes/generate",
        files=files,
        headers=headers
    )
    
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    
    if response.status_code == 200:
        print("✓ Video upload accepted (200)")
        note_id = response.json().get("note_id")
        if note_id:
            print(f"✓ Note created with ID: {note_id}")
    else:
        print(f"✗ Unexpected status code: {response.status_code}")
        return False
    
    # Test 2: Upload with invalid extension (should be rejected)
    print("\n[Test 2] Upload with invalid .txt extension...")
    files = {
        "file": ("test_video.txt", BytesIO(video_data), "text/plain")
    }
    
    response = client.post(
        "/api/notes/generate",
        files=files,
        headers=headers
    )
    
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    
    if response.status_code == 400:
        error_detail = response.json().get("detail", "")
        if "Invalid file type" in error_detail:
            print("✓ Invalid file type properly rejected (400)")
        else:
            print(f"✗ Wrong error message: {error_detail}")
    else:
        print(f"✗ Expected 400, got: {response.status_code}")
        return False
    
    # Test 3: Upload without file (should be rejected)
    print("\n[Test 3] Submit without file or URL...")
    response = client.post(
        "/api/notes/generate",
        data={},
        headers=headers
    )
    
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    
    if response.status_code == 400:
        error_detail = response.json().get("detail", "")
        if "Must provide either" in error_detail:
            print("✓ Missing input properly rejected (400)")
        else:
            print(f"✗ Wrong error message: {error_detail}")
    else:
        print(f"✗ Expected 400, got: {response.status_code}")
        return False
    
    print("\n" + "="*60)
    print("✓ ALL TESTS PASSED")
    print("="*60)
    return True

if __name__ == "__main__":
    try:
        success = test_video_file_upload()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n✗ Test error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

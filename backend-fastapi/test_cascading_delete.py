"""
Test cascading delete - when user is deleted, all their notes should also be deleted
"""
import os
import sys

os.environ["TESTING"] = "true"
sys.path.insert(0, os.path.dirname(__file__))

from fastapi.testclient import TestClient
from main import app
from database.db import SessionLocal
from database.models import User, Note

client = TestClient(app)

def test_cascading_delete():
    """Test that notes are deleted when user is deleted"""
    print("\n" + "="*60)
    print("TEST: Cascading Delete (User → Notes)")
    print("="*60)
    
    # Create a test user
    print("\n[Step 1] Creating test user...")
    response = client.post("/auth/signup", json={
        "username": "cascade_test",
        "email": "cascade@test.com",
        "password": "testpass123"
    })
    
    if response.status_code != 200:
        print(f"✗ Failed to create user")
        return False
    
    token = response.json()["access_token"]
    user_id = response.json()["user_id"]
    print(f"✓ User created (ID: {user_id})")
    
    # Create some notes for this user
    print("\n[Step 2] Creating test notes for user...")
    db = SessionLocal()
    try:
        for i in range(3):
            note = Note(
                title=f"Test Note {i+1}",
                subject="Test Subject",
                content="Test content",
                status="generated",
                user_id=user_id
            )
            db.add(note)
        db.commit()
        
        note_count = db.query(Note).filter(Note.user_id == user_id).count()
        print(f"✓ Created {note_count} test notes")
    finally:
        db.close()
    
    # Delete the user account
    print("\n[Step 3] Deleting user account...")
    response = client.post(
        "/auth/delete-account",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "password": "testpass123",
            "confirmation": "DELETE"
        }
    )
    
    if response.status_code != 200:
        print(f"✗ Failed to delete account: {response.status_code}")
        return False
    
    print("✓ Account deleted")
    
    # Verify notes are also deleted (cascading delete)
    print("\n[Step 4] Verify notes are cascade-deleted...")
    db = SessionLocal()
    try:
        remaining_notes = db.query(Note).filter(Note.user_id == user_id).count()
        
        if remaining_notes == 0:
            print("✓ All notes were deleted with the user (cascading delete works!)")
        else:
            print(f"✗ Found {remaining_notes} notes still in database!")
            return False
    finally:
        db.close()
    
    print("\n" + "="*60)
    print("✓ CASCADING DELETE TEST PASSED")
    print("="*60)
    return True

if __name__ == "__main__":
    try:
        success = test_cascading_delete()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n✗ Test error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

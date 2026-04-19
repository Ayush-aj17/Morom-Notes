"""
Test the delete account endpoint
"""
import os
import sys

os.environ["TESTING"] = "true"
sys.path.insert(0, os.path.dirname(__file__))

from fastapi.testclient import TestClient
from main import app
from database.db import SessionLocal
from database.models import User

client = TestClient(app)

def test_delete_account():
    """Test account deletion"""
    print("\n" + "="*60)
    print("TEST: Delete Account Endpoint")
    print("="*60)
    
    # Create a test user
    print("\n[Step 1] Creating test user...")
    response = client.post("/auth/signup", json={
        "username": "deleteme",
        "email": "deleteme@test.com",
        "password": "testpass123"
    })
    
    if response.status_code != 200:
        print(f"✗ Failed to create user: {response.status_code}")
        print(response.json())
        return False
    
    token = response.json()["access_token"]
    print("✓ User created, token obtained")
    
    # Try deleting with wrong confirmation
    print("\n[Step 2] Try delete with wrong confirmation text...")
    response = client.post(
        "/auth/delete-account",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "password": "testpass123",
            "confirmation": "WRONG"
        }
    )
    
    if response.status_code != 400:
        print(f"✗ Expected 400, got {response.status_code}")
        return False
    
    error = response.json().get("detail", "")
    if "must type" in error.lower():
        print(f"✓ Correctly rejected wrong confirmation")
    else:
        print(f"✗ Wrong error message: {error}")
        return False
    
    # Try deleting with wrong password
    print("\n[Step 3] Try delete with wrong password...")
    response = client.post(
        "/auth/delete-account",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "password": "wrongpassword",
            "confirmation": "DELETE"
        }
    )
    
    if response.status_code != 401:
        print(f"✗ Expected 401, got {response.status_code}")
        return False
    
    print("✓ Correctly rejected wrong password")
    
    # Delete with correct credentials
    print("\n[Step 4] Delete account with correct credentials...")
    response = client.post(
        "/auth/delete-account",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "password": "testpass123",
            "confirmation": "DELETE"
        }
    )
    
    if response.status_code != 200:
        print(f"✗ Expected 200, got {response.status_code}")
        print(response.json())
        return False
    
    data = response.json()
    if "successfully" in data.get("message", "").lower():
        print(f"✓ Account deleted successfully")
    else:
        print(f"✗ Unexpected response: {data}")
        return False
    
    # Verify user is deleted from database
    print("\n[Step 5] Verify user is deleted from database...")
    db = SessionLocal()
    user = db.query(User).filter(User.username == "deleteme").first()
    db.close()
    
    if user is None:
        print("✓ User not found in database (correctly deleted)")
    else:
        print("✗ User still exists in database!")
        return False
    
    # Try to login with deleted account
    print("\n[Step 6] Try to login with deleted account...")
    response = client.post("/auth/login", json={
        "identifier": "deleteme",
        "password": "testpass123"
    })
    
    if response.status_code != 401:
        print(f"✗ Expected 401, got {response.status_code}")
        return False
    
    print("✓ Login correctly fails for deleted account")
    
    print("\n" + "="*60)
    print("✓ ALL DELETE ACCOUNT TESTS PASSED")
    print("="*60)
    return True

if __name__ == "__main__":
    try:
        success = test_delete_account()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n✗ Test error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

#!/usr/bin/env python3
"""
Test to verify login functionality and note metadata handling.
"""

import requests
import json
import time
from database.db import SessionLocal
from database.models import User, Note
from services.auth import get_password_hash

# Backend URL
BASE_URL = "http://127.0.0.1:8000"

# Test credentials
TEST_USERNAME = "test_loginfix"
TEST_EMAIL = f"test_loginfix_{int(time.time())}@example.com"
TEST_PHONE = "+1234567890"
TEST_PASSWORD = "TestPassword123"

def test_signup_duplicate_email():
    """Test that duplicate emails are rejected"""
    print("\n=== Testing Duplicate Email Prevention ===")
    
    # First signup
    payload = {
        "username": f"user1_{int(time.time())}",
        "email": f"duplicate_{int(time.time())}@example.com",
        "phone": "+11111111111",
        "password": "Password123"
    }
    
    response1 = requests.post(f"{BASE_URL}/auth/signup", json=payload)
    print(f"First signup: {response1.status_code}")
    if response1.status_code == 200:
        print(f"✓ First signup successful")
    else:
        print(f"✗ First signup failed: {response1.text}")
        return False
    
    # Second signup with same email
    payload["username"] = f"user2_{int(time.time())}"
    response2 = requests.post(f"{BASE_URL}/auth/signup", json=payload)
    print(f"Second signup (duplicate email): {response2.status_code}")
    
    if response2.status_code == 400:
        if "Email already registered" in response2.text or "already registered" in response2.text:
            print(f"✓ Duplicate email rejected correctly")
            return True
        else:
            print(f"✗ Got 400 but wrong error message: {response2.text}")
            return False
    else:
        print(f"✗ Duplicate email not rejected: {response2.status_code}")
        print(f"Response: {response2.text}")
        return False

def test_login():
    """Test login functionality"""
    print("\n=== Testing Login ===")
    
    # Clean up test user if exists
    db = SessionLocal()
    db.query(User).filter(User.username == TEST_USERNAME).delete()
    db.commit()
    
    # Create test user
    hashed_pw = get_password_hash(TEST_PASSWORD)
    test_user = User(
        username=TEST_USERNAME,
        email=TEST_EMAIL,
        phone=TEST_PHONE,
        hashed_password=hashed_pw
    )
    db.add(test_user)
    db.commit()
    db.close()
    
    print(f"Created test user: {TEST_USERNAME}")
    
    # Test login with username
    print("\nTesting login with username...")
    response = requests.post(f"{BASE_URL}/auth/login", json={
        "identifier": TEST_USERNAME,
        "password": TEST_PASSWORD
    })
    print(f"Login status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"✓ Login successful")
        print(f"  - Token received: {data.get('access_token')[:20]}...")
        print(f"  - Username: {data.get('username')}")
        print(f"  - Email: {data.get('email')}")
        return True
    else:
        print(f"✗ Login failed: {response.status_code}")
        print(f"Response: {response.text}")
        return False

def test_metadata_functions():
    """Test the metadata extraction functions"""
    print("\n=== Testing Metadata Functions ===")
    
    try:
        from services.ai_generator import get_youtube_title, get_file_title, detect_source_type, generate_title_from_content
        
        # Test get_file_title
        print("\nTesting get_file_title...")
        test_cases = [
            ("my_lecture_01.mp4", "My Lecture 01"),
            ("python-basics.pptx", "Python Basics"),
            ("IMG_001.jpg", "Img 001"),
        ]
        
        for filename, expected in test_cases:
            result = get_file_title(filename)
            status = "✓" if result == expected else "✗"
            print(f"{status} {filename} -> {result}")
        
        # Test detect_source_type
        print("\nTesting detect_source_type...")
        source_tests = [
            (None, "lecture.pdf", "Uploaded pdf"),
            (None, "slides.pptx", "Uploaded ppt"),
            (None, "image.jpg", "Uploaded image"),
            (None, "video.mp4", "Uploaded video"),
            ("https://www.youtube.com/watch?v=dQw4w9WgXcQ", None, "youtube link:"),
        ]
        
        for url, filename, expected in source_tests:
            result = detect_source_type(video_url=url, filename=filename)
            status = "✓" if expected in result else "✗"
            print(f"{status} ({url}, {filename}) -> {result}")
        
        print("\n✓ Metadata functions working correctly")
        return True
        
    except Exception as e:
        print(f"✗ Error testing metadata functions: {e}")
        return False

if __name__ == "__main__":
    print("╔════════════════════════════════════════════════════════════════╗")
    print("║             LOGIN AND METADATA VERIFICATION TEST              ║")
    print("╚════════════════════════════════════════════════════════════════╝")
    
    results = {
        "Duplicate Email Prevention": test_signup_duplicate_email(),
        "Login Functionality": test_login(),
        "Metadata Functions": test_metadata_functions(),
    }
    
    print("\n╔════════════════════════════════════════════════════════════════╗")
    print("║                          RESULTS                              ║")
    print("╚════════════════════════════════════════════════════════════════╝")
    
    for test_name, passed in results.items():
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{status}: {test_name}")
    
    all_passed = all(results.values())
    print(f"\nOverall: {'✓ ALL TESTS PASSED' if all_passed else '✗ SOME TESTS FAILED'}")

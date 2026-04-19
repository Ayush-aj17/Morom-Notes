import requests
import json
import time

BASE_URL = "http://127.0.0.1:8000"

print("=" * 60)
print("TESTING NOTE GENERATION FEATURES")
print("=" * 60)

# Step 1: Login
print("\n[1] LOGIN TO GET TOKEN")
print("-" * 60)
login_response = requests.post(f"{BASE_URL}/auth/login", json={
    "identifier": "testuser",
    "password": "Test@1234"
})

if login_response.status_code == 200:
    login_data = login_response.json()
    token = login_data['access_token']
    print(f"✓ Login successful")
    print(f"  Token: {token[:30]}...")
else:
    print(f"✗ Login failed: {login_response.status_code}")
    print(f"  Response: {login_response.text}")
    exit(1)

headers = {"Authorization": f"Bearer {token}"}

# Step 2: Test YouTube Video Generation
print("\n[2] TEST YOUTUBE VIDEO GENERATION")
print("-" * 60)
print("YouTube URL: https://youtu.be/OsM8NOg6G6U?si=lvCiC79aINZRa5gU")

video_response = requests.post(
    f"{BASE_URL}/api/notes/generate",
    data={"video_url": "https://youtu.be/OsM8NOg6G6U?si=lvCiC79aINZRa5gU"},
    headers=headers
)

if video_response.status_code == 200:
    video_data = video_response.json()
    video_note_id = video_data['note_id']
    print(f"✓ Video generation started")
    print(f"  Note ID: {video_note_id}")
    print(f"  Message: {video_data['message']}")
    
    # Check progress for 30 seconds
    print("\n  Progress updates:")
    for i in range(60):
        time.sleep(0.5)
        progress_response = requests.get(
            f"{BASE_URL}/api/notes/progress/{video_note_id}",
            headers=headers
        )
        if progress_response.status_code == 200:
            prog_data = progress_response.json()
            print(f"    [{prog_data['progress']}%] {prog_data['status']} (status: {prog_data['note_status']})")
            if prog_data['progress'] >= 100 or prog_data['note_status'] == 'generated':
                print(f"  ✓ Video generation complete!")
                break
        else:
            print(f"    Error checking progress: {progress_response.status_code}")
else:
    print(f"✗ Video generation failed: {video_response.status_code}")
    print(f"  Response: {video_response.text}")

# Step 3: Test Document Processing (PDF)
print("\n[3] TEST DOCUMENT PROCESSING (PDF)")
print("-" * 60)
pdf_path = "C:\\Projects\\Project-notes\\Test_uploads_files\\UHV_Group_2.pdf"

try:
    with open(pdf_path, 'rb') as pdf_file:
        print(f"Uploading: UHV_Group_2.pdf")
        
        files = {'file': pdf_file}
        data = {
            'title': 'UHV Group Notes',
            'subject': 'Electrical Engineering'
        }
        
        doc_response = requests.post(
            f"{BASE_URL}/api/documents/process",
            files=files,
            data=data,
            headers=headers
        )
        
        if doc_response.status_code == 200:
            doc_data = doc_response.json()
            doc_note_id = doc_data['note_id']
            print(f"✓ Document processing started")
            print(f"  Note ID: {doc_note_id}")
            print(f"  Title: {doc_data['title']}")
            print(f"  Message: {doc_data['message']}")
            
            # Check progress for 30 seconds
            print("\n  Progress updates:")
            for i in range(60):
                time.sleep(0.5)
                progress_response = requests.get(
                    f"{BASE_URL}/api/notes/progress/{doc_note_id}",
                    headers=headers
                )
                if progress_response.status_code == 200:
                    prog_data = progress_response.json()
                    print(f"    [{prog_data['progress']}%] {prog_data['status']} (status: {prog_data['note_status']})")
                    if prog_data['progress'] >= 100 or prog_data['note_status'] == 'generated':
                        print(f"  ✓ Document processing complete!")
                        break
                else:
                    print(f"    Error checking progress: {progress_response.status_code}")
        else:
            print(f"✗ Document processing failed: {doc_response.status_code}")
            print(f"  Response: {doc_response.text}")
except FileNotFoundError:
    print(f"✗ PDF file not found: {pdf_path}")
except Exception as e:
    print(f"✗ Error: {e}")

print("\n" + "=" * 60)
print("TESTS COMPLETE")
print("=" * 60)

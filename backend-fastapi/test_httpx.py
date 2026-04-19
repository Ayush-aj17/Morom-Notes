import httpx
import asyncio

async def test():
    # Login properly with Form data for OAuth2PasswordRequestForm
    auth_resp = httpx.post("http://127.0.0.1:8000/api/auth/login", data={"username": "testuser", "password": "password123"})
    if auth_resp.status_code == 401:
        httpx.post("http://127.0.0.1:8000/api/auth/signup", json={"username": "testuser", "password": "password123"})
        auth_resp = httpx.post("http://127.0.0.1:8000/api/auth/login", data={"username": "testuser", "password": "password123"})
    
    token = auth_resp.json()["access_token"]
    
    # We will construct a multipart form WITHOUT any files, simulating JS FormData
    # httpx handles this if we use `files` but assign None to the filename.
    files = {
        "video_url": (None, "https://youtu.be/EerdGm-ehJQ")  # None filename means it's a text field in multipart
    }
    
    resp = httpx.post(
        "http://127.0.0.1:8000/api/notes/generate",
        headers={"Authorization": f"Bearer {token}"},
        files=files
    )
    
    print(f"STATUS CODE: {resp.status_code}")
    print(f"RESPONSE JSON: {resp.text}")

asyncio.run(test())

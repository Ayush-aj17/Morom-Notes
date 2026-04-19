import subprocess
import time
import requests

# Start the server
proc = subprocess.Popen([".venv\\Scripts\\python.exe", "-m", "uvicorn", "main:app", "--port", "8001"])
time.sleep(3) # Wait for it to start

try:
    # We need a token to hit the endpoint
    resp_login = requests.post("http://127.0.0.1:8001/api/auth/login", data={"username": "testuser", "password": "pw"})
    if resp_login.status_code == 401:
        # Create user
        requests.post("http://127.0.0.1:8001/api/auth/signup", json={"username": "testuser", "password": "pw"})
        resp_login = requests.post("http://127.0.0.1:8001/api/auth/login", data={"username": "testuser", "password": "pw"})
    
    token = resp_login.json().get("access_token")
    
    headers = {"Authorization": f"Bearer {token}"}
    files = {"video_url": (None, "https://youtu.be/EerdGm-ehJQ?si=Vb3UyV9dT4xrzTwv")}
    # Send as FormData
    resp_gen = requests.post("http://127.0.0.1:8001/api/notes/generate", headers=headers, data={"video_url": "https://youtu.be/EerdGm-ehJQ?si=Vb3UyV9dT4xrzTwv"})
    
    print(f"STATUS CODE: {resp_gen.status_code}")
    print(f"RESPONSE: {resp_gen.text}")
finally:
    proc.terminate()

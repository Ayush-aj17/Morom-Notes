from fastapi.testclient import TestClient
from main import app
from database.db import SessionLocal
from database.models import User
from routes.dashboard import get_current_user

client = TestClient(app)

def override_get_current_user():
    db = SessionLocal()
    user = db.query(User).first()
    if not user:
        user = User(username="testuser", hashed_password="pw")
        db.add(user)
        db.commit()
        db.refresh(user)
    return user

app.dependency_overrides[get_current_user] = override_get_current_user

response = client.post(
    "/api/notes/generate",
    data={"video_url": "https://youtu.be/EerdGm-ehJQ?si=Vb3UyV9dT4xrzTwv"}
)

print(f"STATUS CODE: {response.status_code}")
print(f"RESPONSE JSON: {response.json()}")

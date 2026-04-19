import os
import tempfile
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# ensure necessary environment variables before importing the app
os.environ.setdefault("TESTING", "1")
os.environ.setdefault("SECRET_KEY", "testsecret")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "60")
from main import app
from database.models import Base, Note
from core.config import settings

# stub out any heavy external operations
from services import queue_service, video_service, ai_generator

# queue_service worker thread will not start when testing=True
# override add_task to be immediate no-op
queue_service.add_task = lambda lecture_id, file_location: None

# video_service.extract_audio should not try to process invalid files
video_service.extract_audio = lambda path: path

# ai_generator methods hit external APIs; return deterministic dummy data
ai_generator.generate_notes_from_video_file = lambda file_path, mime_type="video/mp4": "[FAKE NOTES FROM VIDEO]"
ai_generator.generate_notes_from_url = lambda url: "[FAKE NOTES FROM URL]"

# routes.generation imported those functions at module import time; replace them too
from routes import generation as generation_route
generation_route.generate_notes_from_video_file = ai_generator.generate_notes_from_video_file
generation_route.generate_notes_from_url = ai_generator.generate_notes_from_url

# use a temporary sqlite database for testing
# use StaticPool so that an in-memory SQLite database persists across
# multiple connections/sessions. otherwise each new session would see an
# empty database which causes "no such table" errors.
from sqlalchemy.pool import StaticPool
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# override get_db dependency
from database import db as db_module

# ensure any code that pulls SessionLocal from database.db (eg. the
# background worker logic in routes/generation) uses our testing engine as
# well rather than the real one.
db_module.SessionLocal = TestingSessionLocal

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[db_module.get_db] = override_get_db

# create tables
Base.metadata.create_all(bind=engine)

client = TestClient(app)


def test_signup_and_login():
    # sign up new user
    resp = client.post("/auth/signup", json={"username": "tester", "password": "secret", "email": "test@test.com"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data

    # login with same credentials
    resp2 = client.post("/auth/login", json={"username": "tester", "password": "secret", "email": "test@test.com"})
    assert resp2.status_code == 200
    assert resp2.json()["username"] == "tester"


def test_lecture_upload():
    # need to login first; sign up if necessary
    ensure_user("lecuser", "pwd")
    resp = client.post("/auth/login", json={"username": "lecuser", "password": "pwd", "email": "test@test.com"})
    token = resp.json()["access_token"]

    # upload a small fake file
    file_content = b"\x00\x00\x00"
    files = {"file": ("test.mp4", file_content, "video/mp4")}
    headers = {"Authorization": f"Bearer {token}"}
    resp2 = client.post("/upload", files=files, headers=headers)
    assert resp2.status_code == 200
    data = resp2.json()
    assert "lecture_id" in data


def test_invalid_upload_type():
    # login and try to upload a .txt file, expect 400
    resp = client.post("/auth/login", json={"username": "lecuser", "password": "pwd", "email": "test@test.com"})
    token = resp.json()["access_token"]
    files = {"file": ("notes.txt", b"hello", "text/plain")}
    headers = {"Authorization": f"Bearer {token}"}
    resp2 = client.post("/upload", files=files, headers=headers)
    assert resp2.status_code == 400


def test_upload_too_large():
    # temporarily lower the max upload size
    original = settings.max_upload_size_mb
    settings.max_upload_size_mb = 0
    try:
        resp = client.post("/auth/login", json={"username": "lecuser", "password": "pwd", "email": "test@test.com"})
        token = resp.json()["access_token"]
        files = {"file": ("big.mp4", b"0" * 1024, "video/mp4")}
        headers = {"Authorization": f"Bearer {token}"}
        resp2 = client.post("/upload", files=files, headers=headers)
        assert resp2.status_code == 413
    finally:
        settings.max_upload_size_mb = original


def test_lecture_access_control():
    # sign up two users and create a lecture with the first
    resp = client.post("/auth/signup", json={"username": "user1", "password": "pass1", "email": "test@test.com"})
    token1 = resp.json()["access_token"]
    resp = client.post("/auth/signup", json={"username": "user2", "password": "pass2", "email": "test@test.com"})
    token2 = resp.json()["access_token"]

    # user1 uploads
    files = {"file": ("t.mp4", b"abc", "video/mp4")}
    headers1 = {"Authorization": f"Bearer {token1}"}
    resp = client.post("/upload", files=files, headers=headers1)
    lecture_id = resp.json()["lecture_id"]

    # user2 should not be able to see user1's lecture
    headers2 = {"Authorization": f"Bearer {token2}"}
    resp = client.get(f"/lectures/{lecture_id}", headers=headers2)
    assert resp.status_code == 404

    # user1 can retrieve it
    resp = client.get(f"/lectures/{lecture_id}", headers=headers1)
    assert resp.status_code == 200


def test_unauthenticated_requests_fail():
    # trying to access protected endpoint without token
    resp = client.get("/lectures")
    assert resp.status_code == 401



def ensure_user(username="lecuser", password="pwd"):
    """Sign up a user if it doesn't already exist (ignoring 400 errors)."""
    resp = client.post("/auth/signup", json={"username": username, "password": password, "email": "test@test.com"})
    # ignore if already created
    return resp


def test_generate_endpoint_validation():
    # make sure account exists and login
    ensure_user("lecuser", "pwd")
    resp = client.post("/auth/login", json={"username": "lecuser", "password": "pwd", "email": "test@test.com"})
    assert resp.status_code == 200, f"login failed: {resp.text}"
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # no data
    resp = client.post("/api/notes/generate", data={}, headers=headers)
    assert resp.status_code == 400

    # invalid file type
    files = {"file": ("bad.txt", b"abc", "text/plain")}
    resp = client.post("/api/notes/generate", files=files, headers=headers)
    assert resp.status_code == 400

    # too large (force limit)
    original = settings.max_upload_size_mb
    settings.max_upload_size_mb = 0
    try:
        files = {"file": ("video.mp4", b"0" * 1024, "video/mp4")}
        resp = client.post("/api/notes/generate", files=files, headers=headers)
        assert resp.status_code == 413
    finally:
        settings.max_upload_size_mb = original


def test_note_generation_workflow():
    """Verify that generating notes creates a record and that background task fills it."""
    ensure_user("genuser", "pass")
    resp = client.post("/auth/login", json={"username": "genuser", "password": "pass", "email": "test@test.com"})
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # trigger generation via URL (stubbed to return dummy content)
    resp = client.post("/api/notes/generate", data={"video_url": "https://youtu.be/dummy"}, headers=headers)
    assert resp.status_code == 200
    note_id = resp.json()["note_id"]

    # since task is executed synchronously by FastAPI TestClient we can retrieve it now
    resp2 = client.get(f"/lectures/{note_id}", headers=headers)
    # the generation route does not expose note retrieval; we inspect DB directly
    from database import db as db_module
    with TestingSessionLocal() as session:
        n = session.get(Note, note_id)
        assert n is not None
        assert n.status == "generated"
        assert "FAKE NOTES" in n.content


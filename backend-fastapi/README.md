# Backend FastAPI Service

This folder contains the FastAPI backend for lecture note generation.

## Setup

1. Copy `.env.example` to `.env` and fill in values:
   - `DATABASE_URL` (use PostgreSQL or SQLite for development)
   - `SECRET_KEY` (generate a cryptographically strong random string)
   - `ACCESS_TOKEN_EXPIRE_MINUTES` (optional)
   - `UPLOAD_DIR` (location to store uploaded videos temporarily)
- `MAX_UPLOAD_SIZE_MB` (maximum video size accepted by the server)
   - `GEMINI_API_KEY` or other service keys

2. Create a virtual environment and install requirements:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # or Scripts\activate on Windows
   pip install -r requirements.txt
   ```

3. Install OCR runtime (required for image uploads and OCR on embedded images in PDF/PPTX):
   - Windows (recommended):
     ```bash
     winget install UB-Mannheim.TesseractOCR
     ```
   - Ensure the Tesseract install directory is in PATH (commonly `C:\Program Files\Tesseract-OCR`).
   - Open a new terminal and verify:
     ```bash
     tesseract --version
     ```

4. PowerPoint notes:
   - `.pptx` is best supported.
   - Legacy `.ppt` files should be opened and re-saved as `.pptx` before upload.

5. Run migrations or allow the app to create tables automatically (development only). For production, configure Alembic and a proper database.

6. Start the server:
   ```bash
   uvicorn main:app --reload
   ```

## Testing

Set the `TESTING` environment variable to `1` to enable the testing configuration and disable
background workers.

Run `pytest` to execute unit and integration tests. The test suite uses an in-memory SQLite database
and stubs out external services (video processing, queueing, AI) so tests are fast and deterministic.

## Production Notes

- Do not use SQLite in production; switch `DATABASE_URL` to a managed database.

## API Overview

The backend exposes the following key endpoints (all under `/api` prefix unless noted otherwise):

1. **Authentication** (`/auth/signup`, `/auth/login`) returns JWT tokens.
2. **Lecture management** (`/upload`, `/lectures`, `/lectures/{id}`, etc.) requires a valid token.
3. **Notes generation** (`POST /api/notes/generate`) accepts either a YouTube URL (`video_url`) or an uploaded video file. The request is authenticated and returns a `note_id`. Files are validated for type and size on the server.
4. **Additional helpers** such as `/api/notes/export-pdf` and `/api/notes/ai-edit` also require authentication.

Refer to the Python route definitions for full details and to the frontend code for example client usage.
- Set proper CORS origins via `CORS_ORIGINS` environment variable.
- Ensure `SECRET_KEY` is kept secret and rotated regularly.
- Background tasks are executed via FastAPI's `BackgroundTasks`. For heavy workloads, consider a dedicated worker (Celery/RQ).
- Store uploaded videos on persistent storage (Amazon S3, GCS) rather than local disk.
- Remove debugging endpoints and scripts such as `check_db.py` unless required.

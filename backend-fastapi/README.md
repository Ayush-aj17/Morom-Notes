# Backend FastAPI Service - Morom Notes

This folder contains the robust, production-ready FastAPI backend for Morom Notes, providing an AI-driven lecture note generation and management system.

## Core Features
- **AI Processing Pipeline**: Integrates with LLMs (Google Gemini) and Whisper transcription models to convert videos and documents into formatted markdown notes.
- **Robust Database**: SQLAlchemy ORM integrated (supports PostgreSQL + Supabase Session Poolers).
- **Authentication**: JWT-based stateless authentication flow.
- **Background Processing**: Handles lengthy tasks (like OCR, video uploads, transcriptions) resiliently.
- **File Parsing & OCR**: Natively processes `.pptx`, `.pdf`, `.docx`, images, and videos.

## Prerequisites

- **Python 3.10+** (3.11+ recommended)
- **Tesseract OCR** (Required for processing images and embedded presentations):
  - **Windows (Recommended)**: `winget install UB-Mannheim.TesseractOCR` (Verify with `tesseract --version`)
  - **Linux (Ubuntu/Debian)**: `sudo apt-get install tesseract-ocr`
  - **macOS**: `brew install tesseract`
- PostgreSQL Database (e.g., Supabase, Neon)

## Development Setup

1. Assemble your `.env` file (copy from `.env.example`):
   ```env
   # Database (Use Supabase Session Pooler with ?pgbouncer=true or pgbouncer=true on port 5432)
   DATABASE_URL=postgresql://user:password@aws-0-REGION.pooler.supabase.com:5432/postgres?pgbouncer=true
   SECRET_KEY=generate-a-secure-random-string
   ACCESS_TOKEN_EXPIRE_MINUTES=1440
   UPLOAD_DIR=uploads/
   MAX_UPLOAD_SIZE_MB=500
   GEMINI_API_KEY=your_gemini_api_key
   ```

2. Create a virtual environment and install dependencies:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   ```

3. Initialize the application locally:
   ```bash
   uvicorn main:app --reload --port 8000
   ```

## Production Deployment Guidelines

To deploy this backend in a production environment (like Railway, Render, AWS, or DigitalOcean), adhere to the following architecture principles:

### Server Initialization
Do **not** use the reload flag. Run the application via `uvicorn` bounded with `gunicorn` or native worker orchestration to handle concurrent workloads seamlessly:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Database & Pooling
- **Managed Database**: You must use a persistent PostgreSQL database. Do not use SQLite for production.
- **QueuePool Restrictions**: Because FastAPI/SQLAlchemy natively opens persistent connection pools (`QueuePool`), you **must** use a Session Pooler (like Supabase port 5432) rather than a Transaction Pooler (port 6543) if you use native SQLAlchemy pooling. Transaction poolers will drop prepared statements.
- **Migration Orchestration**: Instead of dynamically yielding tables (`Base.metadata.create_all(bind=engine)`), use **Alembic** migrations in production CI/CD.

### Object Storage
Currently, files are persisted natively via OS standard mapping using `UPLOAD_DIR`. For large-scale production, attach a storage provider (AWS S3, GCP Cloud Storage):
- Replace OS writes in `document_processor.py` and `video_service.py` to route to presigned S3 URLs or Boto3 bucket injection.

### CORS Security
- In `.env`, set a strict whitelist array for `CORS_ORIGINS` mapped strictly to your exact frontend domain (e.g., `https://morom-notes.vercel.app`). *Never* allow wildcard `*` origins in production.

## Testing

1. Set `TESTING=1` in your environment (disables background workers and routes to SQLite Memory mapping).
2. Execute the test suite (uses `pytest` with `httpx`):
   ```bash
   pytest
   ```

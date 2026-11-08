import logging
import secrets
from typing import List, Optional

from pydantic_settings import BaseSettings
from pydantic import Field, ValidationError


class Settings(BaseSettings):
    """Application configuration backed by environment variables.

    This class uses :class:`pydantic_settings.BaseSettings` (Pydantic v2) which
    automatically reads from os.environ, a `.env` file, or other sources. The
    model is intentionally permissive (``extra = "ignore"``) so that unknown
    environment variables such as third‑party API keys do not cause startup
    failures. During production, ``SECRET_KEY`` *should* be supplied; if it is
    missing we generate a secure random value so the app still boots safely.
    """

    # database settings
    database_url: str = Field("sqlite:///./app.db", env="DATABASE_URL")

    # security – secret_key is optional in the model so that we can supply a
    # sensible default programmatically. ``default_factory`` only runs when the
    # environment variable is *not* present.
    secret_key: str = Field(
        default_factory=lambda: secrets.token_urlsafe(32),
        env="SECRET_KEY",
    )

    access_token_expire_minutes: int = Field(60 * 24 * 7, env="ACCESS_TOKEN_EXPIRE_MINUTES")

    # cors and upload settings
    cors_origins: List[str] = Field(
        [
            "http://localhost:5173",
            "http://localhost:3000",
            "http://localhost:8080",
            "http://localhost:5174",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:8080",
            "http://127.0.0.1:5174",
            "*"
        ],
        env="CORS_ORIGINS"
    )
    upload_dir: str = Field("uploads", env="UPLOAD_DIR")
    max_upload_size_mb: int = Field(100, env="MAX_UPLOAD_SIZE_MB")

    # email settings for OTP delivery
    email_sender: Optional[str] = Field(None, env="EMAIL_SENDER")
    email_password: Optional[str] = Field(None, env="EMAIL_PASSWORD")
    smtp_server: str = Field("smtp.gmail.com", env="SMTP_SERVER")
    smtp_port: int = Field(587, env="SMTP_PORT")

    # testing flag pulled from environment, used by many modules to disable
    # background workers or external API calls.
    testing: bool = Field(False, env="TESTING")

    class Config:
        # load from a .env file if present (used for local development/tests)
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"  # do not error on unknown environment variables


# instantiate once so the rest of the application can import a shared
# ``settings`` object. Any validation errors during construction should be
# logged clearly so startup failures are obvious.
try:
    settings = Settings()
except ValidationError as exc:
    logging.error("configuration validation failed: %s", exc)
    # re‑raise so the application cannot start with invalid settings
    raise

if settings.testing and not settings.database_url.startswith("sqlite"):
    logging.warning(
        "TESTING is enabled; using local SQLite instead of the configured remote database."
    )
    settings.database_url = "sqlite:///./app.db"

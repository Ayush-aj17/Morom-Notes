from pydantic import BaseModel
from datetime import datetime


class LectureInfo(BaseModel):
    title: str
    subject: str
    user_id: int | None = None  # allow specifying owner if needed


class LectureResponse(BaseModel):
    id: int
    title: str
    subject: str
    notes: str | None = None
    status: str
    # The ORM model exposes a datetime; allow that type so pydantic
    # coercion works correctly in response validation.
    created_at: datetime | None = None
    user_id: int | None = None

    class Config:
        from_attributes = True
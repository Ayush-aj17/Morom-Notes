"""Quick utility for inspecting notes in the database.

This module is kept for demonstration; remove or adapt for production use.
"""
from database.models import Note
from database.db import SessionLocal


def inspect_note(note_id: int):
    db = SessionLocal()
    try:
        note = db.query(Note).filter(Note.id == note_id).first()
        if note:
            print(f"Note {note_id} length: {len(note.content) if note.content else 0}")
            if note.content:
                print(note.content[:100])
        else:
            print(f"Note {note_id} not found")
    finally:
        db.close()


if __name__ == "__main__":
    inspect_note(4)
    inspect_note(2)


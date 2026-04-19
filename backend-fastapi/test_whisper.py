import os
from dotenv import load_dotenv

load_dotenv()

from services.ai_generator import generate_notes_from_url
import logging
logging.basicConfig(level=logging.INFO)

try:
    print("Testing generate_notes_from_url...")
    notes, _ = generate_notes_from_url("https://www.youtube.com/watch?v=aqz-KE-bpKQ")
    print(f"Success! Output length: {len(notes)}")
except Exception as e:
    import traceback
    traceback.print_exc()

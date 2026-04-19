
import logging
path = "services/ai_generator.py"
content = open(path, "r", encoding="utf-8").read()

new_f = """
def generate_notes_from_transcript(transcript: str, retry_count=2) -> str:
    \"\"\"Generate notes from a raw transcript using Gemini.\"\"\"
    client = initialize_client()
    max_chars = 100000
    if len(transcript) > max_chars:
        transcript = transcript[:max_chars]
        
    prompt = f\"\"\"You are a senior instructor creating clean, professional study notes for students.

ABSOLUTE RULE - NO CODE BLOCKS, NO BACKTICKS, NO CODE-LIKE SYNTAX ANYWHERE

** NEVER EVER use triple backticks **
** NEVER EVER use single backticks **
Use ONLY: # for headings, ** for bold, - for bullets, 1. for numbers, regular text

Create detailed study notes based on this content:

{transcript}\"\"\"

    try:
        response = generate_content_with_fallback(client, [prompt], retries=retry_count)
        if response and hasattr(response, "text"):
            return response.text
    except Exception as e:
        logging.error(f"Failed to generate notes: {e}")
    
    return "Study Notes\\n\\nCould not generate notes properly due to AI service error. Try again."
"""

open(path, "a", encoding="utf-8").write(new_f)
print("Done")


import logging
import ollama

logger = logging.getLogger(__name__)

# Fallback notes if AI generation fails
FALLBACK_NOTES = """
# Summary of Lecture

## Key Points
- Unable to generate AI notes due to service error
- Please review the original transcript

## Recommendations
1. Check that Ollama is running properly
2. Try running: ollama pull llama3
3. Restart the backend service

Please contact support if the issue persists.
"""

def generate_notes_from_transcript(transcript: str):
    """Clean and convert a raw transcript into formatted study notes.

    A real production function would chunk the text and stream to the model
    rather than submitting huge blobs. We also guard against non-string
    inputs and excessively long transcripts to avoid abuse.
    """
    if not isinstance(transcript, str):
        raise ValueError("transcript must be a string")

    max_chars = 100_000
    if len(transcript) > max_chars:
        logger.warning("Transcript length %d exceeds limit, truncating", len(transcript))
        transcript = transcript[:max_chars]

    prompt = f"""
You are a senior instructor creating clean, professional study notes for students.

================================================================================
ABSOLUTE RULE - NO CODE BLOCKS, NO BACKTICKS, NO CODE-LIKE SYNTAX ANYWHERE
================================================================================

** NEVER EVER use triple backticks ``` **
** NEVER EVER use single backticks ` **
** NEVER use backticks around ANYTHING - not terms, not values, not function names **
** NEVER write code syntax like "for", "while", "if", "print(", "pow(" **
** NEVER write variable assignments like "x = 5" **
** NEVER use colons at end of lines **
** NEVER write "input:", "output:", "function():" in code-like format **

Use ONLY: # for headings, ** for bold, - for bullets, 1. for numbers, regular text

================================================================================
BACKTICK EXAMPLES - WHAT NOT TO DO:
================================================================================

WRONG: Input: `153` -> Output: `153 is an Armstrong Number`
RIGHT: When we input **153**, the output shows **153 is an Armstrong Number**

WRONG: Use the `pow()` function to calculate powers
RIGHT: Use the **pow()** function to calculate powers

WRONG: Store the value in `original_n` before processing
RIGHT: Store the value in **original_n** before processing

WRONG: The `<cmath>` header provides mathematical functions
RIGHT: The **cmath** header provides mathematical functions

WRONG: Extract digit using `n % 10` and `n / 10`
RIGHT: Extract the digit using **n % 10** and remove it using **n / 10**

WRONG: `if sum == original_n`
RIGHT: If **sum** equals **original_n**

================================================================================
ALL FORMATTING RULES:
================================================================================

1. NO BACKTICKS - Not even ONE backtick anywhere in the entire document
2. Use **bold** for: variable names, numbers, function names, operators, terms, values
3. Use # ## ### for headings only
4. Use - for bullet list items
5. Use 1. 2. 3. for numbered steps
6. Use regular text for explanations

================================================================================
FORMATTING EXAMPLES:
================================================================================

WRONG:
Test Cases:
* Input: `153` -> Output: `153 is an Armstrong Number.`
* Input: `370` -> Output: `370 is an Armstrong Number.` (`3^3 + 7^3 + 0^3 = 27 + 343 + 0 = 370`)

RIGHT:
## Test Cases

- When input is **153**, the output is **153 is an Armstrong Number**
- When input is **370**, the output is **370 is an Armstrong Number** because **3^3 + 7^3 + 0^3** equals **27 + 343 + 0**, which equals **370**
- When input is **425**, the output is **425 is NOT an Armstrong Number** because **4^3 + 2^3 + 5^3** equals **64 + 8 + 125**, which equals **197**, not **425**

================================================================================
CRITICAL EXAMPLES:
================================================================================

WRONG: **Definition:** An Armstrong number is equal to the sum of the cubes of its digits (for 3-digit numbers).

RIGHT: An Armstrong number is equal to the sum of the cubes of its digits when we're working with 3-digit numbers.

WRONG: **Preserve Original Number:** It's crucial to store the original number (`original_n`) before starting the digit extraction loop

RIGHT: We must store the original number in **original_n** before starting to extract digits, because the variable **n** will be modified during the extraction loop

WRONG: **pow() function:** Used to calculate powers (e.g., `pow(base, exponent)`).

RIGHT: The **pow()** function calculates powers and takes two parameters: the **base** and the **exponent**

WRONG: **Digit Extraction:** Uses `n % 10` for the last digit and `n / 10` to remove it

RIGHT: We extract the last digit using **n % 10** and remove it from the number using integer division **n / 10**

================================================================================
REMEMBER:
================================================================================
- If you see yourself wanting to write backticks, use **bold** instead
- Every ` you want to write should become **text** instead
- NO CODE BLOCKS, NO BACKTICKS, NO CODE-LIKE SYNTAX
- Everything is English sentences with bold highlighting
================================================================================

Transcript:
{transcript}
"""

    try:
        response = ollama.chat(
            model="llama3",
            messages=[{"role": "user", "content": prompt}],
        )
        result = response["message"]["content"]
        if result:
            logger.info("AI notes generated successfully")
            # DEBUG: Print raw response to console
            print("\n" + "="*80)
            print("RAW AI RESPONSE (First 1000 chars):")
            print("="*80)
            print(result[:1000])
            print("="*80 + "\n")
            logger.info("RAW AI RESPONSE: %s", result[:500])
            return result
        else:
            logger.error("AI returned empty response")
            return FALLBACK_NOTES
    except Exception as e:
        logger.error("Ollama error: %s", e)
        # Return fallback notes instead of crashing
        if "CUDA" in str(e) or "GPU" in str(e):
            logger.info("GPU/CUDA error detected, using fallback notes")
        elif "terminated" in str(e).lower():
            logger.info("Ollama service terminated, using fallback notes")
        else:
            logger.warning("Ollama service unavailable, using fallback notes")
        return FALLBACK_NOTES

"""
Test page splitting logic with the actual generated notes
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend-fastapi'))

from database.db import SessionLocal
from database.models import Note

def test_page_splitting():
    """Test if page splitting creates page 2"""
    db = SessionLocal()
    
    # Get the Test 01 PDF note - use SQL query to avoid source_type column issue
    from sqlalchemy import text
    result = db.execute(text("""
        SELECT id, title, subject, content FROM notes 
        WHERE title LIKE '%Test 01%' LIMIT 1
    """)).first()
    
    if not result:
        print("✗ No note found with 'Test 01' in title")
        print("Checking available notes:")
        all_notes = db.execute(text("SELECT id, title, content FROM notes")).fetchall()
        for row in all_notes:
            print(f"  - Note {row[0]}: {row[1]} ({len(row[2]) if row[2] else 0} chars)")
        return False
    
    # Create a mock note object
    class MockNote:
        def __init__(self, id, title, subject, content):
            self.id = id
            self.title = title
            self.subject = subject
            self.content = content
    
    note = MockNote(result[0], result[1], result[2], result[3])
    
    print(f"\n{'='*60}")
    print(f"Testing Page Splitting for: {note.title}")
    print(f"{'='*60}")
    print(f"\nContent length: {len(note.content)} chars")
    print(f"First 500 chars:\n{note.content[:500]}...\n")
    
    # Simulate the page splitting logic from EditorPage.jsx
    CHARS_PER_PAGE = 1200
    MIN_CHARS_BEFORE_SPLIT = 150
    pages = []
    current_page = ""
    
    # Split into paragraphs
    sections = note.content.split('\n\n')
    sections = [s for s in sections if s.strip()]
    
    print(f"Content split into {len(sections)} paragraphs/sections")
    
    for i, section in enumerate(sections):
        section_len = len(section)
        current_len = len(current_page)
        would_exceed = current_len + section_len > CHARS_PER_PAGE
        meets_min = current_len > MIN_CHARS_BEFORE_SPLIT
        
        print(f"\n[Section {i}] Length: {section_len} chars")
        print(f"  Current page: {current_len} chars")
        print(f"  Would exceed limit: {would_exceed} (> {CHARS_PER_PAGE})")
        print(f"  Meets minimum: {meets_min} (> {MIN_CHARS_BEFORE_SPLIT})")
        
        if would_exceed and meets_min:
            print(f"  → CREATING NEW PAGE")
            pages.append(current_page.strip())
            current_page = section + "\n\n"
        else:
            print(f"  → ADDING TO CURRENT PAGE")
            current_page += (current_page if current_page else "") + section + "\n\n"
    
    if current_page.strip():
        pages.append(current_page.strip())
    
    print(f"\n{'='*60}")
    print(f"Page Splitting Results:")
    print(f"{'='*60}")
    print(f"Total pages: {len(pages)} (excluding cover page)")
    print(f"Total pages in PDF: {len(pages) + 1} (including cover page)")
    
    for i, page in enumerate(pages):
        print(f"\n[Page {i+1}] Content Preview:")
        print(f"  Length: {len(page)} chars")
        print(f"  First 100 chars: {page[:100]}...")
        print(f"  Note: 'Page {i+2} of {len(pages)+1}' would be displayed")
    
    if len(pages) < 2:
        print(f"\n⚠ WARNING: Only {len(pages)} content page(s) generated!")
        print(f"  → Cover page will exist")
        print(f"  → Should see 'Page 2 of 2' on content page")
        print(f"  → If PDF only shows cover page, check html2pdf configuration")
    else:
        print(f"\n✓ Multiple pages created - Page 2 should be visible")
    
    return True

if __name__ == "__main__":
    try:
        test_page_splitting()
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

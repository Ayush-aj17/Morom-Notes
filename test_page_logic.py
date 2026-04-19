"""
Test page splitting with sample content
"""

def test_page_splitting_logic():
    """Test page splitting with different content lengths"""
    
    # Simulate the page splitting logic
    CHARS_PER_PAGE = 1200
    MIN_CHARS_BEFORE_SPLIT = 150
    
    test_cases = [
        {
            "name": "Short content (1401 chars - like Test 01)",
            "content": "Chapter 1: Introduction\n\n" + "This is a paragraph. " * 70
        },
        {
            "name": "Medium content (~2400 chars)", 
            "content": "Chapter 1: Introduction\n\n" + "This is a paragraph. " * 120
        },
        {
            "name": "Long content (~3600 chars)",
            "content": "Chapter 1: Introduction\n\n" + "This is a paragraph. " * 180
        }
    ]
    
    for test_case in test_cases:
        print(f"\n{'='*60}")
        print(f"Test: {test_case['name']}")
        print(f"{'='*60}")
        
        content = test_case['content']
        pages = []
        current_page = ""
        
        # Split into paragraphs
        sections = content.split('\n\n')
        sections = [s for s in sections if s.strip()]
        
        print(f"Total content: {len(content)} chars")
        print(f"Number of sections: {len(sections)}")
        
        for section in sections:
            section_len = len(section)
            current_len = len(current_page)
            would_exceed = current_len + section_len > CHARS_PER_PAGE
            meets_min = current_len > MIN_CHARS_BEFORE_SPLIT
            
            if would_exceed and meets_min:
                pages.append(current_page.strip())
                current_page = section + "\n\n"
            else:
                current_page += (current_page if current_page else "") + section + "\n\n"
        
        if current_page.strip():
            pages.append(current_page.strip())
        
        print(f"\nPages created: {len(pages)} (content pages)")
        print(f"Total pages with cover: {len(pages) + 1}")
        
        for i, page in enumerate(pages):
            print(f"  Page {i+2}: {len(page)} chars (displays 'Page {i+2} of {len(pages)+1}')")
        
        if len(pages) >= 2:
            print(f"✓ Page 2 will be visible in PDF")
        else:
            print(f"⚠ Only {len(pages)} page(s) - if PDF doesn't show page 2, check html2pdf config")

if __name__ == "__main__":
    test_page_splitting_logic()


if __name__ == "__main__":
    test_page_splitting_logic()

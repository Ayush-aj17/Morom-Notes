# Global Note Cache System

## Overview

The Project Notes app now includes a **Global Note Cache** system that stores generated YouTube notes globally and reuses them across all users. This dramatically saves time and API costs.

### Key Benefits
- ⚡ **Instant retrieval** - Second and subsequent users get notes in seconds (no API calls)
- 💰 **Cost savings** - Expensive Gemini API calls only happen once per video
- 🔄 **Automatic caching** - No configuration needed, works automatically
- 📊 **Usage tracking** - See which videos are most accessed

---

## How It Works

### First User Generates Notes
```
User 1 uploads: https://www.youtube.com/watch?v=ABC123
  ❌ Not in cache
  → Gemini API generates notes from transcript
  → Notes stored in CachedNote table
  → User 1 gets notes (takes 30-60 seconds)
```

### Second User Requests Same Video
```
User 2 uploads: https://www.youtube.com/watch?v=ABC123
  ✅ Found in cache!
  → Retrieve cached notes instantly
  → User 2 gets same notes in 2-3 seconds
  → 0 API calls used!
```

### Cache is Global
- Notes cached by User A are available to Users B, C, D, etc.
- Saves Gemini API quota for everyone
- Improves app performance system-wide

---

## Database Structure

### New Table: `cached_notes`

```sql
CREATE TABLE cached_notes (
  id INTEGER PRIMARY KEY,
  source_url VARCHAR UNIQUE,      -- YouTube URL (normalized)
  title VARCHAR,                  -- Cached title
  subject VARCHAR,                -- Category
  content TEXT,                   -- Full note content
  source_type VARCHAR,            -- 'youtube', 'pdf', etc.
  video_id VARCHAR,               -- YouTube video ID
  created_at DATETIME,            -- When cache was created
  last_accessed DATETIME,         -- Last time used
  access_count INTEGER            -- Usage counter
);
```

---

## API Endpoints for Cache Management

### 1. Get Cache Statistics
```bash
GET /api/notes/cache/stats
```

**Response:**
```json
{
  "total_cached_notes": 45,
  "total_cache_accesses": 312,
  "average_accesses_per_note": 6.93,
  "message": "Cache is enabled - YouTube notes are stored globally..."
}
```

### 2. List All Cached Notes
```bash
GET /api/notes/cache/list?skip=0&limit=50
```

**Response:**
```json
{
  "total": 45,
  "cached_notes": [
    {
      "id": 1,
      "source_url": "https://www.youtube.com/watch?v=ABC123",
      "title": "Introduction to Machine Learning",
      "source_type": "youtube",
      "access_count": 8,
      "created_at": "2026-03-20T10:30:00",
      "last_accessed": "2026-03-26T15:45:00",
      "content_length": 5234
    },
    ...
  ],
  "skip": 0,
  "limit": 50
}
```

### 3. Check if Video is Cached
```bash
GET /api/notes/cache/check?video_url=https://www.youtube.com/watch?v=ABC123
```

**Response (if cached):**
```json
{
  "cached": true,
  "title": "Introduction to Machine Learning",
  "source_url": "https://www.youtube.com/watch?v=ABC123",
  "access_count": 8,
  "created_at": "2026-03-20T10:30:00",
  "last_accessed": "2026-03-26T15:45:00",
  "content_preview": "# Introduction to Machine Learning\n\n## What is ML?\n..."
}
```

**Response (if NOT cached):**
```json
{
  "cached": false,
  "message": "No cached notes for this video. Will be generated on next request."
}
```

### 4. Clear Cache (Advanced)
```bash
POST /api/notes/cache/clear
```

**Response:**
```json
{
  "message": "Cache cleared successfully",
  "deleted_cached_notes": 45,
  "note": "Future YouTube video generations will need to regenerate notes"
}
```

⚠️ **Warning**: Clearing cache forces regeneration of all notes next time they're requested, using more API quota!

---

## Implementation Details

### Cache Key Normalization
YouTube URLs are normalized to prevent duplicate caching:
```python
# All these resolve to the same cached note:
https://www.youtube.com/watch?v=ABC123
https://youtu.be/ABC123
https://www.youtube.com/watch?v=ABC123&t=30s
→ Stored as: https://www.youtube.com/watch?v=ABC123
```

### Progress Messages
When a user generates notes from YouTube:

**Cache Miss (First time):**
```
Checking cache... → Not found
Downloading video metadata...
Generating notes from transcript...
Saving to cache...
```

**Cache Hit (Subsequent times):**
```
Checking cache... → Found!
Retrieved from cache (0 API calls)...
```

### Statistics Tracking
Each cached note tracks:
- `created_at` - When first generated
- `last_accessed` - Most recent access time
- `access_count` - How many times reused

**Example:** A video accessed 10 times saves 9 Gemini API calls!

---

## Files Modified/Created

### New Files
- ✅ `services/cache_service.py` - Cache management logic
- ✅ Database model: `CachedNote` in `models.py`

### Modified Files
- ✅ `routes/generation.py` - Integrated cache checks in note generation
- ✅ `database/models.py` - Added CachedNote model

---

## Cost Saving Example

### Without Cache
```
User 1: 100 API calls
User 2: 100 API calls
User 3: 100 API calls
User 4: 100 API calls
User 5: 100 API calls
─────────────────────
Total: 500 API calls
```

### With Cache
```
User 1: 100 API calls (generates & caches)
User 2: 0 API calls (uses cache)
User 3: 0 API calls (uses cache)
User 4: 0 API calls (uses cache)
User 5: 0 API calls (uses cache)
─────────────────────
Total: 100 API calls (80% savings!)
```

---

## Technical Design

### Cache Service (`cache_service.py`)

**Core Functions:**

```python
# Check if notes exist for a URL
cached = get_cached_note(db, "https://youtube.com/watch?v=ABC123")

# Save generated notes to cache
save_cached_note(
    db,
    source_url="https://youtube.com/watch?v=ABC123",
    title="Video Title",
    subject="Category",
    content="Generated notes...",
    source_type="youtube"
)

# Get cache statistics
stats = get_cache_stats(db)
# Returns: {total_cached_notes, total_cache_accesses, average_accesses}

# Clear all cached notes
clear_cache(db)

# Clean old unused cache (optional maintenance)
cleanup_old_cache(db, days=30)
```

### Generation Flow Integration

In `routes/generation.py`, the `_do_work` function now:

1. **Checks if it's a YouTube link**
2. **Queries cache** - `get_cached_note(db, video_url)`
3. **If cached:**
   - Returns cached content instantly
   - Updates `last_accessed` and `access_count`
   - Logs: "Cache HIT - skipped generation!"
4. **If not cached:**
   - Generates notes via Gemini API
   - Saves to cache via `save_cached_note()`
   - Logs: "Cache MISS - generated and saved"

---

## Maintenance

### Recommended: Clean Old Cache Monthly
```bash
# Run this script periodically to clean unused entries:
python cleanup_old_cache.py --days=30
```

### Monitor Cache Growth
```bash
curl http://localhost:8000/api/notes/cache/stats
```

### Manual Cache Rebuild (if needed)
```bash
# Clear all cache
curl -X POST http://localhost:8000/api/notes/cache/clear

# Notes will regenerate on next request as users access them
```

---

## FAQ

**Q: Do different users share the same cached notes?**
A: Yes! That's the whole point. YouTube videos cached by anyone are reused by everyone.

**Q: What if a teacher updates a video but keeps the same URL?**
A: You'd need to manually clear that video's cache or clear all cache to regenerate.

**Q: Does cache apply to uploaded files?**
A: No, only YouTube videos are cached globally. Uploaded files are user-specific.

**Q: Why normalize YouTube URLs?**
A: To prevent duplicates. Same video ID = same cache entry, different URL formats.

**Q: Can I disable caching?**
A: Yes - remove the cache check code from generation.py (not recommended).

**Q: How much storage does cache use?**
A: Depends on note content. Average note ≈ 5-15KB. Small database footprint.

**Q: API cost reduction example?**
A: Gemini costs ~$0.075 per 1M input tokens. Each YouTube transcription ≈ 500K tokens.
- First user: $0.04
- 5 cached users: $0 (saved $0.16)
- 100 cached users: $0 (saved $3.96)

---

## Future Enhancements

- [ ] ML-based duplicate detection (similar content, different URL)
- [ ] Cache expiration (auto-invalidate after 90 days)
- [ ] Cache invalidation with thumbnail update (video was edited)
- [ ] Admin dashboard showing cache hit rates
- [ ] Automatic cache compression for storage

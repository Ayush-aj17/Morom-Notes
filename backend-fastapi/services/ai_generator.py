import os
import tempfile
import time
import urllib.parse
import logging
import subprocess
import sys

def _ensure_package(package_name: str, import_name: str = None, progress_callback=None):
    """Dynamically installs missing pip packages at runtime."""
    if import_name is None:
        import_name = package_name
    try:
        __import__(import_name)
    except ImportError:
        logging.info(f"Missing dependency '{import_name}'. Auto-installing '{package_name}'...")
        if progress_callback:
            progress_callback(5, f"Installing required dependency: {package_name}...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", package_name])
        # Invalidate import caches to ensure the new package is immediately recognized
        import importlib
        importlib.invalidate_caches()

# ``google-genai`` is an optional dependency used only for Gemini/Google
# APIs. Import lazily so the application can start even if the package is
# not installed; route handlers will raise a clear error when invoked.
try:
    from google import genai
    from google.genai import types
    _has_google_genai = True
except ImportError:  # pragma: no cover - optional
    genai = None
    types = None
    _has_google_genai = False

# When contacting Gemini we require an API key from the environment.
# We intentionally look it up inside the helper so that tests or
# container restarts that modify os.environ will be respected.

def initialize_client():
    if not _has_google_genai:
        raise ImportError("google-genai package is required for AI features")
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        # production code should log instead of print; using built-in for now
        raise ValueError("GEMINI_API_KEY not found in environment variables.")
    return genai.Client(api_key=api_key)

def generate_content_with_fallback(client, contents, config=None, retries=2):
    import re
    import time
    
    fallback_models = [
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-flash-lite-latest',
        'gemini-2.0-flash-lite',
        'gemini-pro-latest'
    ]
    
    last_error = None

    # Errors that should try the next model immediately.
    model_unavailable_markers = (
        "404",
        "not found",
        "model not found",
    )

    # Temporary/transient provider issues that should trigger fallback + retry.
    retryable_markers = (
        "429",
        "500",
        "502",
        "503",
        "504",
        "exhausted",
        "quota",
        "resource_exhausted",
        "unavailable",
        "temporarily",
        "high demand",
        "try again later",
        "deadline exceeded",
        "timed out",
        "timeout",
        "connection reset",
        "service unavailable",
    )
    
    for attempt in range(retries + 1):
        for model_name in fallback_models:
            try:
                return client.models.generate_content(
                    model=model_name,
                    contents=contents,
                    config=config
                )
            except Exception as e:
                error_msg = str(e).lower()
                last_error = e

                # Try next model for transient provider errors or unavailable model errors.
                if any(marker in error_msg for marker in model_unavailable_markers + retryable_markers):
                    logging.warning(
                        "Model %s failed with retryable availability error. Trying next model...",
                        model_name,
                    )
                    continue
                else:
                    # Non-transient error (e.g. invalid key/input), raise immediately.
                    raise e
                    
        # If we exhausted all models in this attempt, wait and retry the cycle
        if attempt < retries:
            wait_time = 20.0 + (attempt * 15.0)
            if last_error:
                match = re.search(r"retry in ([\d\.]+)s", str(last_error).lower())
                if match:
                    wait_time = float(match.group(1)) + 2.0
            logging.warning(f"All models failed. Sleeping for {wait_time:.1f}s before full retry cycle...")
            time.sleep(wait_time)
            
    raise Exception(
        f"AI service temporarily unavailable across fallback models. "
        f"Please try again later. Last Error: {str(last_error)[:200]}"
    )

# Helper functions for title and source type detection
def get_youtube_title(url: str) -> str:
    """Extract YouTube video title using yt-dlp. Falls back to None if extraction fails."""
    try:
        import yt_dlp
        with yt_dlp.YoutubeDL({'quiet': True, 'no_warnings': True}) as ydl:
            info = ydl.extract_info(url, download=False)
            title = info.get('title', None)
            if title and title.strip():
                return title.strip()
    except Exception as e:
        logging.warning(f"Failed to extract YouTube title: {e}")
    
    # Return None to signal that fallback to Gemini is needed
    return None

def get_file_title(filename: str) -> str:
    """Generate a title from filename by removing extension and cleaning up."""
    if not filename:
        return "Untitled Notes"
    # Remove extension
    name = os.path.splitext(filename)[0]
    # Replace underscores and hyphens with spaces
    name = name.replace('_', ' ').replace('-', ' ')
    # Capitalize words
    name = ' '.join(word.capitalize() for word in name.split())
    return name if name else "Untitled Notes"

def generate_title_from_content(content: str) -> str:
    """Generate a concise title from note content using Gemini.
    
    This is used as fallback when YouTube title extraction fails or for uploaded files.
    """
    try:
        client = initialize_client()
        
        # Take first 1000 chars of content for analysis
        content_preview = content[:1000]
        
        prompt = """Based on the following notes content, generate a SHORT, CONCISE title (3-8 words max) that captures the main topic or subject. Return ONLY the title, nothing else.

Content preview:
{content_preview}""".format(content_preview=content_preview)
        
        response = generate_content_with_fallback(
            client=client,
            contents=prompt,
            config=types.GenerateContentConfig(temperature=0.3)
        )
        
        title = response.text.strip()
        if title and len(title) < 100:  # Sanity check
            return title
        else:
            return "Study Notes"  # Fallback
    except Exception as e:
        logging.warning(f"Failed to generate title from content: {e}")
        return "Study Notes"  # Fallback

def detect_source_type(video_url: str = None, filename: str = None) -> str:
    """Detect the source type based on URL or filename.
    
    Returns:
    - "youtube link: {url}" for YouTube videos
    - "Uploaded pdf" for PDF files
    - "Uploaded ppt" for PowerPoint files
    - "Uploaded image" for image files
    - "Uploaded video" for video files
    - "unknown" otherwise
    """
    if video_url:
        video_url_lower = video_url.lower()
        # Check if it's YouTube
        if 'youtube.com' in video_url_lower or 'youtu.be' in video_url_lower:
            return f"youtube link: {video_url}"
        
    if filename:
        filename_lower = filename.lower()
        ext = os.path.splitext(filename_lower)[1]
        
        if ext == '.pdf':
            return "Uploaded pdf"
        elif ext in {'.ppt', '.pptx'}:
            return "Uploaded ppt"
        elif ext in {'.jpg', '.png', '.jpeg', '.gif', '.bmp'}:
            return "Uploaded image"
        elif ext in {'.mp4', '.mov', '.mkv', '.avi', '.wav', '.webm'}:
            return "Uploaded video"
    
    # Default if neither exists or can't be determined
    return "unknown"

# The user explicitly asked to "not hallucinate or add outside information"
# and "strictly limited to what was taught" and focus on "teacher's distinct problem-solving methodology".
SYSTEM_INSTRUCTION = """
You are a top-tier student taking comprehensive, well-organized class notes during a lecture. 
Your goal is to capture the exact methods and concepts the professor is teaching in a detailed, structured format.

PAGE SIZE CONSTRAINTS:
- Format notes for A4 paper (210mm × 297mm)
- Writable area: approximately 180mm × 257mm with standard margins
- Keep lines reasonably short (around 80-100 characters) for readability
- Fit content to avoid excessive page breaks

MARKDOWN FORMATTING REQUIREMENTS:
- Use proper Markdown syntax throughout
- For code blocks: ALWAYS use triple backticks with language specification: ```python, ```javascript, ```java, etc.
- Code blocks must be properly formatted and readable when wrapped
- Keep code examples concise and relevant to the concepts being taught
- Use inline code backticks for single commands or variables: `variable_name`
- NEVER write sub-points (e.g. `a.`, `b.`, `c.`) inline. Always enforce strict line breaks (`\n`) for every list or sub-list item.

CRITICAL RULES:
1. Write from the perspective of a student taking notes for their own study. DO NOT say "The instructor said" or "The video talks about". Just write down the concepts and facts directly.
2. Ignore all meta-commentary. If the teacher says "subscribe to my channel", "welcome back to another video", or talks about their personal life, DO NOT write it down.
3. Pay specific attention to the teacher's distinct problem-solving methodology and reproduce the problem-solving steps EXACTLY how the teacher taught it.
4. The video might be in Hindi or another language. Understand the native spoken language and transcribe/translate the final output notes entirely into English.
5. Pay strictly close attention to the VISUAL FRAMES of the video. If the teacher writes complex formulas or code on the board, rely on the visual frames rather than relying solely on the spoken transcript.
6. The notes must be detailed but STRICTLY LIMITED to the academic or technical concepts taught. Do not hallucinate outside information.
7. Format the output in clean Markdown with detailed, well-structured content:
   - Use clear heading hierarchies (# for main topics, ## for subtopics)
   - Write comprehensive paragraphs that explain concepts thoroughly
   - Define key terms and concepts in full sentences and detailed explanations
   - Include problem-solving steps and examples in narrative form
   - Use bold text for important key terms and concepts within paragraphs
   - Include subheadings for different aspects of topics
   - When defining concepts, explain what they are, why they matter, and how they work
8. Highlight important lines intelligently throughout paragraphs:
   - Use **bold** for critical definitions and key statements
   - Use **_bold italics_** or **emphasis** for particularly important conclusions, findings, or pivotal points
   - Highlight important steps in procedures or methods
   - Mark important formulas, equations, or numerical values boldly
   - Highlight key relationships and connections between concepts
   - Make sure important takeaways stand out when reading through paragraphs
9. After each main section with detailed content, if the detailed paragraphs span more than half a page, add a "Key Points" or "Summary" subsection with bullet points:
   - Use bullet points to quickly summarize the main ideas from the detailed paragraphs above
   - Keep each bullet point concise and to the point
   - Bullets should capture the essential takeaways that a reader can quickly scan
   - Use nested bullets for related points if needed
   - Format: "- " for bullets, "  - " for nested bullets
10. Make the tone professional but accessible—like reading from a well-written textbook or study guide that provides complete understanding of concepts. Include quick-reference bullet summaries where content is substantial. Ensure important information stands out visually through smart highlighting.
"""

def _extract_text_and_audio_from_video(video_path: str, progress_callback=None, pipeline: str = "audio-video") -> tuple[str, str]:
    if progress_callback:
        progress_callback(5, "Verifying local AI processing requirements...")
        
    is_audio_file = video_path.lower().endswith(('.mp3', '.wav', '.aac', '.flac', '.ogg', '.m4a'))
    if is_audio_file:
        pipeline = "audio-only"
        
    try:
        _ensure_package("openai-whisper", "whisper", progress_callback)
        if pipeline == "audio-video":
            _ensure_package("opencv-python", "cv2", progress_callback)
            _ensure_package("pytesseract", "pytesseract", progress_callback)
            _ensure_package("Pillow", "PIL", progress_callback)
        
        import whisper
        if pipeline == "audio-video":
            import cv2
            import pytesseract
            from PIL import Image
    except Exception as e:
        raise RuntimeError(f"Failed to auto-install dependencies: {e}") from e
    
    if progress_callback:
        progress_callback(55, "Transcribing audio locally (this may take a moment)...")

    # Transcribe Audio
    import torch
    device = "cuda" if torch.cuda.is_available() else "cpu"
    logging.info(f"Running local Whisper model on downloaded media... (Device: {device.upper()})")
    model = whisper.load_model("base", device=device)
    # fp16=False prevents the confusing UserWarning on CPUs
    result = model.transcribe(video_path, fp16=False)
    transcript_text = result["text"]
    
    # If audio-only pipeline, skip OCR extraction
    is_audio_file = video_path.lower().endswith(('.mp3', '.wav', '.aac', '.flac', '.ogg', '.m4a'))
    
    if pipeline == "audio-only" or is_audio_file:
        reason = "Audio-only pipeline selected" if pipeline == "audio-only" else "Audio file detected"
        logging.info(f"{reason}. Skipping OCR visual text extraction.")
        if progress_callback:
            progress_callback(85, "Audio processing complete!")
        return transcript_text, ""
    
    # Audio-video pipeline: Extract Frames OCR
    if progress_callback:
        progress_callback(70, "Extracting text from video frames (OCR)...")

    logging.info("Extracting frames for OCR...")
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    
    ocr_texts = []
    last_text = ""
    frame_interval = int(fps * 5) # Process 1 frame every 5 seconds
    frame_idx = 0
    
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        if frame_idx % frame_interval == 0:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            # Basic thresholding to help OCR
            _, thresh = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY)
            pil_img = Image.fromarray(thresh)
            drawn_text = pytesseract.image_to_string(pil_img).strip()
            
            # To avoid spamming exactly the same text from static slides
            if len(drawn_text) > 15 and drawn_text != last_text:
                time_sec = int(frame_idx / fps)
                mins, secs = divmod(time_sec, 60)
                ocr_texts.append(f"[Time {mins}:{secs:02d}] {drawn_text}")
                last_text = drawn_text
                
        frame_idx += 1
        # Quick check to occasionally update UI based on percentage parsed if long video
        if frame_idx % (frame_interval * 6) == 0 and progress_callback:
            perc = int((cap.get(cv2.CAP_PROP_POS_FRAMES) / max(cap.get(cv2.CAP_PROP_FRAME_COUNT), 1)) * 100)
            progress_callback(70 + int(perc * 0.15), f"Extracting visual text... {perc}% completed")
            
    cap.release()
    
    return transcript_text, "\n---\n".join(ocr_texts)


def generate_notes_from_video_file(file_path: str, mime_type: str = "video/mp4", progress_callback=None, pipeline: str = "audio-video") -> str:
    """Uses local Whisper and OCR to extract text, then sends it to Gemini."""
    client = initialize_client()
    
    is_audio = file_path.lower().endswith(('.mp3', '.wav', '.aac', '.flac', '.ogg', '.m4a'))
    if is_audio:
        pipeline = "audio-only"
    
    transcript, ocr_data = _extract_text_and_audio_from_video(file_path, progress_callback, pipeline=pipeline)
    
    if progress_callback:
        if pipeline == "audio-only":
            progress_callback(85, "Audio processing complete! Generating notes from the transcript...")
        else:
            progress_callback(85, "Visuals and Audio processed! Generating structured notes from the extracted content...")
        
    # Send combined text instead of heavy video file
    if pipeline == "audio-only":
        comb_text = f"AUDIO TRANSCRIPT:\n{transcript}"
        prompt = "Please provide exhaustive notes on this video lecture following your system instructions. Use the audio transcript to create comprehensive notes."
    else:
        comb_text = f"AUDIO TRANSCRIPT:\n{transcript}\n\nTEXT EXTRACTED ON SCREEN (OCR):\n{ocr_data}"
        prompt = "Please provide exhaustive notes on this video lecture following your system instructions. Pay close attention to BOTH the spoken audio and the visual/OCR content logically mapped by time. Combine the voice commentary and on-screen text to make proper, comprehensive notes."
    
    try:
        response = generate_content_with_fallback(
            client=client,
            contents=[prompt, comb_text],
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                temperature=0.1
            )
        )
        return response.text
    except Exception as e:
        logging.error(f"Failed to generate text from combined OCR: {e}")
        raise

def extract_video_id(url: str):
    parsed = urllib.parse.urlparse(url)
    if 'youtube.com' in parsed.netloc:
        return urllib.parse.parse_qs(parsed.query).get('v', [None])[0]
    elif 'youtu.be' in parsed.netloc:
        return parsed.path[1:]
    return None

def _youtube_extractor_args() -> dict:
    """Return YouTube player clients used for public and mobile extraction."""
    return {
        'youtube': {
            'player_client': ['android', 'web_safari', 'mweb'],
        },
    }

def _youtube_cookie_options() -> dict:
    """Return yt-dlp cookie options when an authenticated cookie file is configured."""
    cookies_file = os.environ.get("YOUTUBE_COOKIES_FILE")
    if cookies_file and os.path.isfile(cookies_file):
        return {'cookiefile': cookies_file}
    return {}

def generate_notes_from_url(url: str, progress_callback=None, existing_video_path: str = None, pipeline: str = "transcript-only") -> tuple[str, str]:
    """Generate notes from YouTube captions, with media download as fallback."""

    if pipeline == "transcript-only":
        logging.info("Transcript-only pipeline: fetching YouTube transcript directly.")
        if progress_callback:
            progress_callback(10, "Fetching YouTube transcript...")
        try:
            _ensure_package("youtube-transcript-api", "youtube_transcript_api", progress_callback)
            from youtube_transcript_api import YouTubeTranscriptApi
            from urllib.parse import urlparse, parse_qs
            
            # Extract video_id
            parsed_url = urlparse(url)
            video_id = None
            if parsed_url.hostname in ('youtu.be', 'www.youtu.be'):
                video_id = parsed_url.path[1:]
            elif parsed_url.hostname in ('youtube.com', 'www.youtube.com'):
                qs = parse_qs(parsed_url.query)
                if 'v' in qs:
                    video_id = qs['v'][0]
            
            if not video_id:
                raise ValueError("Could not extract video ID from YouTube URL.")
                
            import requests
            session = requests.Session()
            session.verify = False  # Ignore SSL errors which block direct requests from Python
            
            api = YouTubeTranscriptApi(http_client=session)
            
            # Prefer English, but use the video's first available caption track when
            # English is unavailable. The note-generation prompt translates captions
            # into English, so requiring English here needlessly triggers a blocked
            # yt-dlp media-download fallback for videos such as Hindi lectures.
            available_transcripts = api.list(video_id)
            try:
                transcript = available_transcripts.find_transcript(['en'])
            except Exception:
                transcript = next(iter(available_transcripts), None)

            if transcript is None:
                raise ValueError("This YouTube video has no available transcript.")

            logging.info(
                "Using YouTube transcript language %s%s",
                transcript.language_code,
                " (auto-generated)" if transcript.is_generated else "",
            )
            transcript_list = transcript.fetch()
            transcript_text = " ".join([t.text if hasattr(t, 'text') else t.get('text', '') for t in transcript_list])
            
            if progress_callback:
                progress_callback(50, "Generating notes from transcript with Gemini...")
            
            notes = generate_notes_from_transcript(transcript_text)
            return notes, None
        except Exception as e:
            logging.warning(
                "YouTube captions unavailable; falling back to media extraction: %s",
                e,
            )

    if pipeline == "audio-only":
        # For audio-only, skip video download and use direct transcription
        logging.info("Audio-only pipeline: extracting audio/transcription directly from YouTube.")
        try:
            _ensure_package("yt-dlp", "yt_dlp", progress_callback)
            import yt_dlp
        except Exception as e:
            raise RuntimeError(f"Failed to auto-install 'yt_dlp': {e}") from e

        # Use yt-dlp to extract audio URL or download audio only
        ydl_opts = {
            'format': 'bestaudio/best',
            'quiet': True,
            'no_warnings': True,
            'nocheckcertificate': True,
            'extractor_args': _youtube_extractor_args(),
            **_youtube_cookie_options(),
            'outtmpl': '%(id)s.%(ext)s',
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            # Try to get direct audio URL
            audio_url = None
            if 'url' in info:
                audio_url = info['url']
            elif 'formats' in info:
                for f in info['formats']:
                    if f.get('acodec') != 'none' and f.get('vcodec') == 'none':
                        audio_url = f.get('url')
                        break
            if not audio_url:
                raise RuntimeError("Could not extract audio stream from YouTube video.")

        # Now transcribe the audio_url using Whisper
        if progress_callback:
            progress_callback(55, "Transcribing audio stream with Whisper...")
        try:
            _ensure_package("openai-whisper", "whisper", progress_callback)
            import whisper
            import torch
        except Exception as e:
            raise RuntimeError(f"Failed to auto-install 'openai-whisper': {e}") from e

        # Download the audio to a temp file for Whisper
        import tempfile
        import requests
        with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as tmp_audio:
            audio_data = requests.get(audio_url, stream=True)
            for chunk in audio_data.iter_content(chunk_size=8192):
                tmp_audio.write(chunk)
            tmp_audio_path = tmp_audio.name

        device = "cuda" if torch.cuda.is_available() else "cpu"
        model = whisper.load_model("base", device=device)
        result = model.transcribe(tmp_audio_path, fp16=False)
        transcript = result["text"]

        # Clean up temp file
        try:
            os.remove(tmp_audio_path)
        except Exception:
            pass

        # Send transcript to Gemini for note generation
        if progress_callback:
            progress_callback(70, "Generating notes from transcript with Gemini...")
        notes = generate_notes_from_transcript(transcript)
        return notes, None

    # Default: audio-video pipeline (download video as before)
    client = initialize_client()
    video_id = extract_video_id(url)
    if not video_id:
        raise ValueError("Invalid YouTube URL provided.")
    try:
        _ensure_package("yt-dlp", "yt_dlp", progress_callback)
        import yt_dlp
    except Exception as e:
        raise RuntimeError(f"Failed to auto-install 'yt_dlp': {e}") from e
    cache_dir = os.path.join(os.getcwd(), "uploads", "videos")
    os.makedirs(cache_dir, exist_ok=True)
    video_path = existing_video_path or os.path.join(cache_dir, f"{video_id}.mp4")
    if existing_video_path and os.path.exists(existing_video_path):
        logging.info(f"Using cached video from {existing_video_path}")
        if progress_callback:
            progress_callback(50, "Using cached video. Processing with AI...")
    else:
        def ydl_hook(d):
            if d['status'] == 'downloading' and progress_callback:
                percent = d.get('_percent_str', '').strip()
                eta = d.get('_eta_str', '').strip()
                speed = d.get('_speed_str', '').strip()
                try:
                    percent_val = float(percent.replace('%', '').strip())
                    mapped_progress = 10 + int(percent_val * 0.4)
                except:
                    mapped_progress = 25
                progress_text = f"Downloading video: {percent}"
                if eta: progress_text += f" (ETA: {eta})"
                if speed: progress_text += f" at {speed}"
                progress_callback(mapped_progress, progress_text)
            elif d['status'] == 'finished' and progress_callback:
                progress_callback(50, "Download complete. Processing video with AI...")
        ydl_opts = {
            'format': 'best[height<=720]/best',
            'outtmpl': video_path,
            'retries': 5,
            'quiet': True,
            'no_warnings': True,
            'nocheckcertificate': True,
            'extractor_args': _youtube_extractor_args(),
            **_youtube_cookie_options(),
            'progress_hooks': [ydl_hook]
        }
        logging.info(f"Downloading media via yt-dlp to {video_path}")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
    if progress_callback:
        progress_callback(55, "Uploading video to AI for multimodal processing...")
    return generate_notes_from_video_file(video_path, mime_type="video/mp4", progress_callback=progress_callback, pipeline=pipeline), video_path


def refine_notes(existing_markdown: str, user_instruction: str) -> str:
    """Takes existing notes and a user command like 'add the proof step' and returns the updated notes."""
    client = initialize_client()
    
    prompt = f"Here are the existing notes:\n\n{existing_markdown}\n\nUSER INSTRUCTION:\n{user_instruction}\n\nPlease revise the notes according to the instruction while maintaining the beautiful markdown format."
    
    response = generate_content_with_fallback(
        client=client,
        contents=[prompt],
        config=types.GenerateContentConfig(
            temperature=0.2
        )
    )
    
    result = response.text.strip()
    if result.startswith("```markdown"):
        result = result[len("```markdown"):].strip()
    elif result.startswith("```"):
        result = result[len("```"):].strip()
    if result.endswith("```"):
        result = result[:-3].strip()
        
    return result

# Store conversation context in memory (in production, use database)
_study_buddy_conversations = {}

def study_buddy_chat_response(original_content: str, user_message: str, conversation_id: str) -> str:
    """
    Chat response for study buddy - asks clarifying questions about requested changes.
    Returns AI response asking where/how to apply the changes.
    """
    client = initialize_client()
    
    # Initialize conversation if new
    if conversation_id not in _study_buddy_conversations:
        _study_buddy_conversations[conversation_id] = []
    
    # Add user message to conversation history
    _study_buddy_conversations[conversation_id].append({
        "role": "user",
        "message": user_message
    })
    
    # Build conversation context
    conversation_history = "\n".join([
        f"User: {msg['message']}" if msg['role'] == 'user' else f"AI: {msg['message']}"
        for msg in _study_buddy_conversations[conversation_id]
    ])
    
    prompt = f"""You are a helpful study buddy. The student is asking for changes to their notes.

ORIGINAL NOTES:
{original_content}

STUDENT REQUEST:
{conversation_history}

Respond briefly and directly:
- Acknowledge what they're asking for
- Summarize the change(s) you'll make
- If you need one specific clarification, ask it briefly and directly. Do not ask for multiple clarifications at once. Wait for the student's response before making any changes.

Keep it conversational but concise. Focus on understanding their intent."""
    
    response = generate_content_with_fallback(
        client=client,
        contents=[prompt],
        config=types.GenerateContentConfig(temperature=0.7)
    )
    
    ai_response = response.text
    
    # Store AI response in conversation
    _study_buddy_conversations[conversation_id].append({
        "role": "assistant",
        "message": ai_response
    })
    
    return ai_response

def apply_buddy_changes(original_content: str, conversation_id: str) -> str:
    """
    Apply changes discussed in the study buddy chat to the original notes.
    """
    client = initialize_client()
    
    # Get conversation history
    if conversation_id not in _study_buddy_conversations:
        raise ValueError("Conversation not found")
    
    conversation_history = "\n".join([
        f"User: {msg['message']}" if msg['role'] == 'user' else f"AI: {msg['message']}"
        for msg in _study_buddy_conversations[conversation_id]
    ])
    
    prompt = f"""You are an expert note editor. Based on the conversation below, apply the requested changes to the student's notes.

ORIGINAL NOTES:
{original_content}

STUDENT-AI CONVERSATION:
{conversation_history}

Based on all the requests and clarifications in the conversation, create the updated notes that incorporate all requested changes. 
Maintain the original format and structure while making the requested modifications.
Return ONLY the updated notes, nothing else."""
    
    response = generate_content_with_fallback(
        client=client,
        contents=[prompt],
        config=types.GenerateContentConfig(temperature=0.2)
    )
    
    updated_notes = response.text.strip()
    if updated_notes.startswith("```markdown"):
        updated_notes = updated_notes[len("```markdown"):].strip()
    elif updated_notes.startswith("```"):
        updated_notes = updated_notes[len("```"):].strip()
    if updated_notes.endswith("```"):
        updated_notes = updated_notes[:-3].strip()
    
    # Clean up conversation from memory after applying
    if conversation_id in _study_buddy_conversations:
        del _study_buddy_conversations[conversation_id]
    
    return updated_notes

def generate_notes_from_transcript(transcript: str, retry_count=2) -> str:
    """Generate notes from a raw transcript using Gemini."""
    client = initialize_client()
    max_chars = 100000
    if len(transcript) > max_chars:
        transcript = transcript[:max_chars]
        
    prompt = f"""You are a senior instructor creating clean, professional study notes for students.

ABSOLUTE RULE - NO CODE BLOCKS, NO BACKTICKS, NO CODE-LIKE SYNTAX ANYWHERE

** NEVER EVER use triple backticks **
** NEVER EVER use single backticks **
Use ONLY: # for headings, ** for bold, - for bullets, 1. for numbers, regular text

Create detailed study notes based on this content:

{transcript}"""

    try:
        response = generate_content_with_fallback(client, [prompt], retries=retry_count)
        if response and hasattr(response, "text"):
            return response.text
    except Exception as e:
        logging.error(f"Failed to generate notes: {e}")
    
    return "Study Notes\n\nCould not generate notes properly due to AI service error. Try again."

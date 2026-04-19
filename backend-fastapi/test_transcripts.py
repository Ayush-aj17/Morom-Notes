from youtube_transcript_api import YouTubeTranscriptApi
import json

video_id = "EerdGm-ehJQ"
try:
    transcript_list = YouTubeTranscriptApi.get_transcripts([video_id], languages=['en', 'hi', 'en-IN', 'hi-IN'])
    print(f"Worked with get_transcripts: {transcript_list}")
except Exception as e:
    print(f"Error fetching transcripts normally: {e}")
    try:
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
        transcript = transcript_list.find_transcript(['en', 'hi', 'en-IN'])
        print(f"Found transcript via list: {transcript.language}")
    except Exception as e2:
        print(f"Error 2: {e2}")

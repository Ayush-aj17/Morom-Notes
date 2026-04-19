from youtube_transcript_api import YouTubeTranscriptApi
try:
    transcript_list = YouTubeTranscriptApi().list("EerdGm-ehJQ")
    print(transcript_list)
except Exception as e:
    print(f"ERROR: {type(e).__name__} - {e}")

try:
    transcript_list = YouTubeTranscriptApi.list_transcripts("EerdGm-ehJQ")
    print("list_transcripts worked!")
except Exception as e:
    print(f"list_transcripts ERROR: {type(e).__name__} - {e}")

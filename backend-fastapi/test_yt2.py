from youtube_transcript_api import YouTubeTranscriptApi
import traceback

try:
    t = YouTubeTranscriptApi().list('aqz-KE-bpKQ')
    print([tr.language_code for tr in t])
    tr = t.find_generated_transcript(['en'])
    print(tr.language_code)
except Exception as e:
    traceback.print_exc()

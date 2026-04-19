from youtube_transcript_api import YouTubeTranscriptApi
import traceback

def test_fetch():
    video_id = 'aqz-KE-bpKQ' # The user's specific failing video
    
    try:
        t_list = YouTubeTranscriptApi.list_transcripts(video_id)
        print("Available Transcripts:")
        for t in t_list:
            print(f"- Language: {t.language_code}, Generated: {t.is_generated}")
            
        print("Attempting to get English directly...")
        try:
            en_t = t_list.find_transcript(['en'])
            print(f"Found strict: {en_t}")
        except Exception:
            en_t = t_list.find_generated_transcript(['en'])
            print(f"Found generated: {en_t}")
            
        data = en_t.fetch()
        print(f"Success! Fetched {len(data)} segments.")
    except Exception as e:
        traceback.print_exc()

if __name__ == "__main__":
    test_fetch()

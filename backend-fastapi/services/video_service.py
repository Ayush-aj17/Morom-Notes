import os
from moviepy import VideoFileClip


def extract_audio(video_path: str) -> str:
    """Extract audio from a video file and return path to audio.

    Raises `FileNotFoundError` if the input file is missing.
    """
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"video not found: {video_path}")

    base, _ = os.path.splitext(video_path)
    audio_path = f"{base}.mp3"

    video = VideoFileClip(video_path)
    try:
        video.audio.write_audiofile(audio_path)
    finally:
        video.close()

    return audio_path
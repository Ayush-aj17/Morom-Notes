# whisper is heavy; defer load until we actually transcribe
_model = None

def _get_model():
    global _model
    if _model is None:
        import whisper
        _model = whisper.load_model("base", device="cuda" if whisper.is_cuda_available() else "cpu")
    return _model


def transcribe_audio(audio_path: str):
    model = _get_model()
    result = model.transcribe(audio_path)
    return result.get("text", "")
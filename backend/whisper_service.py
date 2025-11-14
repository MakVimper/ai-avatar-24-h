# whisper_service.py
from faster_whisper import WhisperModel

model = WhisperModel("base", device="cpu")

def transcribe_audio(file_path: str):
    segments, _ = model.transcribe(file_path)
    return " ".join([segment.text for segment in segments])


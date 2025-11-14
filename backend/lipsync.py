import numpy as np
import io
import wave
from pydub import AudioSegment

def mp3_to_wav_bytes(mp3_bytes: bytes) -> bytes:
    print(f"[mp3_to_wav_bytes] Получено MP3: {len(mp3_bytes)} байт")
    audio = AudioSegment.from_file(io.BytesIO(mp3_bytes), format="mp3")
    audio = audio.set_channels(1).set_sample_width(2).set_frame_rate(44100)
    buf = io.BytesIO()
    audio.export(buf, format="wav")
    wav_bytes = buf.getvalue()
    print(f"[mp3_to_wav_bytes] Конвертировано в WAV: {len(wav_bytes)} байт")
    return wav_bytes

def generate_lipsync_from_audio_chunk(audio_chunk: bytes) -> dict:
    try:
        print(f"[lipsync] Получено WAV: {len(audio_chunk)} байт")
        with wave.open(io.BytesIO(audio_chunk), 'rb') as wf:
            n_frames = wf.getnframes()
            framerate = wf.getframerate()
            frames = wf.readframes(n_frames)
            samples = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0

        print(f"[lipsync] Количество сэмплов: {len(samples)}, Framerate: {framerate}")
        if len(samples) == 0:
            print("[lipsync] Пустой аудио-файл")
            return {"open": 0.0, "form": 0.0}

        rms = np.sqrt(np.mean(samples ** 2))
        print(f"[lipsync] RMS: {rms}")

        open_value = float(np.power(rms, 0.4) * 2.5)
        open_value = np.clip(open_value, 0.0, 1.0)
        form_value = open_value * 0.7

        if open_value < 0.05:
            open_value = 0.0
            form_value = 0.0

        print(f"[lipsync] Open: {open_value}, Form: {form_value}")
        return {
            "open": round(open_value, 3),
            "form": round(form_value, 3)
        }

    except Exception as e:
        print(f"[lipsync] Ошибка: {e}")
        return {"open": 0.0, "form": 0.0}

if __name__ == "__main__":
    with open("example.wav", "rb") as f:
        wav_bytes = f.read()
    print(generate_lipsync_from_audio_chunk(wav_bytes))
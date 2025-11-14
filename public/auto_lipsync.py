import sys
import json
import os
import whisper
from typing import List, Dict, Any

PHONEME_MAP = {
    "А": "A", "О": "O", "У": "O", "Ы": "I", "Э": "E", "И": "E", "Е": "E", "Ё": "O", "Ю": "U", "Я": "A",
    "Б": "BMP", "П": "BMP", "М": "BMP",
    "Ф": "FV", "В": "FV",
    "С": "S", "З": "S", "Ш": "SH", "Ж": "SH", "Щ": "SH", "Ч": "CH",
    "Т": "D", "Д": "D", "Н": "N", "Л": "L", "Р": "R",
    "Г": "G", "К": "K", "Х": "X",
    "Й": "E", "Ь": "E", "Ъ": "X"
}

VOWELS = {'А', 'О', 'У', 'Ы', 'Э', 'И', 'Е', 'Ё', 'Ю', 'Я'}

def load_whisper_model(model_name: str = "medium"):
    print(f"🔄 Загружаю модель Whisper ({model_name})...")
    return whisper.load_model(model_name)

def clean_word(word: str) -> str:
    return ''.join(c for c in word.upper() if c.isalpha() or c in "Ё")

def word_to_phonemes(word: str) -> List[str]:
    word = clean_word(word)
    if not word:
        return ["X"]
    
    phonemes = []
    i = 0
    while i < len(word):
        ch = word[i]
        if ch in PHONEME_MAP:
            phonemes.append(PHONEME_MAP[ch])
        else:
            phonemes.append("X")
        i += 1
    return phonemes if phonemes else ["X"]

def distribute_durations(word_start: float, word_end: float, phonemes: List[str]) -> List[Dict[str, Any]]:
    duration = word_end - word_start
    if duration <= 0 or not phonemes:
        return []

    phoneme_durations = []
    vowel_count = sum(1 for p in phonemes if p in {"A", "E", "O", "I", "U"})
    consonant_count = len(phonemes) - vowel_count

    total_parts = vowel_count * 2 + consonant_count
    if total_parts == 0:
        total_parts = 1

    part_duration = duration / total_parts

    cues = []
    t = word_start
    for ph in phonemes:
        dur = part_duration * 2 if ph in {"A", "E", "O", "I", "U"} else part_duration
        cues.append({
            "start": round(t, 3),
            "end": round(t + dur, 3),
            "value": ph
        })
        t += dur
    return cues

if len(sys.argv) < 2:
    print("Использование: python auto_lipsync.py <audio_file.wav>")
    sys.exit(1)

audio_path = sys.argv[1]
if not os.path.exists(audio_path):
    print(f"Файл не найден: {audio_path}")
    sys.exit(1)

output_path = os.path.splitext(audio_path)[0] + "_sync.json"

print("🎤 Распознаю речь через Whisper medium (с word-level timestamps)...")
model = load_whisper_model("medium")

result = model.transcribe(
    audio_path,
    language='ru',
    word_timestamps=True,
    temperature=0.0,
    beam_size=5,
    best_of=5,
    fp16=False
)

mouth_cues = []

print("Обрабатываю слова и фонемы...")
for segment in result["segments"]:
    if "words" not in segment:
        continue

    for word_info in segment["words"]:
        word = word_info["word"].strip()
        if not word or len(word) < 1:
            continue

        start = word_info["start"]
        end = word_info["end"]
        phonemes = word_to_phonemes(word)

        cues = distribute_durations(start, end, phonemes)
        mouth_cues.extend(cues)

total_duration = result["segments"][-1]["end"] if result["segments"] else 0.0

output = {
    "metadata": {
        "soundFile": os.path.basename(audio_path),
        "duration": round(total_duration, 3),
        "model": "whisper-medium",
        "language": "ru",
        "wordCount": len([w for s in result['segments'] for w in s.get('words', []) if w['word'].strip()]),
        "phonemeCount": len(mouth_cues)
    },
    "mouthCues": mouth_cues
}

os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else '.', exist_ok=True)

with open(output_path, "w", encoding="utf-8") as f:
    json.dump(output, f, indent=2, ensure_ascii=False)

print(f"JSON создан: {output_path}")
print(f"   • Слов: {output['metadata']['wordCount']}")
print(f"   • Фонем: {output['metadata']['phonemeCount']}")
print(f"   • Длительность: {total_duration:.2f} сек")
print(f"   • Модель: whisper-medium")
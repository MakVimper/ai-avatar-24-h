from fastapi import FastAPI, Request, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
import edge_tts
from lipsync import generate_lipsync_from_audio_chunk
from whisper_service import transcribe_audio
from db import save_message, get_chats_from_db, get_chat_messages_from_db
import ollama
import io
import base64
from pydub import AudioSegment
import os
import asyncio
import logging
import traceback

app = FastAPI(title="AI Avatar Backend")
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

AUDIO_STORE = {}

@app.post("/chat")
async def chat(request: Request):
    """
    Универсальный эндпоинт для чата:
    - return_text: вернуть текст AI
    - return_audio: вернуть аудио (StreamingResponse)
    """
    try:
        logger.info("=== CHAT REQUEST STARTED ===")
        
        data = await request.json()
        user_message = data.get("message", "")
        chat_id = data.get("chat_id", "")
        return_text = data.get("return_text", True)
        return_audio = data.get("return_audio", False)

        logger.info(f"User message: {user_message}")
        logger.info(f"Chat ID: {chat_id}")
        logger.info(f"Return text: {return_text}, Return audio: {return_audio}")

        if not user_message or not chat_id:
            logger.error("Missing message or chat_id")
            return JSONResponse({"error": "Нет текста или chat_id"}, status_code=400)

        # Генерация ответа AI
        logger.info("Calling Ollama API...")
        try:
            response = ollama.chat(
                model="mistral",
                messages=[{"role": "user", "content": user_message}]
            )
            logger.info(f"Ollama response: {response}")
            bot_reply = response["message"]["content"]
            logger.info(f"Bot reply: {bot_reply}")
        except Exception as e:
            logger.error(f"Ollama error: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            return JSONResponse({"error": f"Ошибка Ollama: {str(e)}"}, status_code=500)

        # Сохраняем сообщение в базу
        logger.info("Saving to database...")
        try:
            msg_id = save_message(chat_id, user_message, bot_reply)
            logger.info(f"Message saved with ID: {msg_id}")
        except Exception as e:
            logger.error(f"Database error: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            return JSONResponse({"error": f"Ошибка БД: {str(e)}"}, status_code=500)

        # Если нужно только текст
        if return_text and not return_audio:
            logger.info("Returning text only")
            return {"bot_reply": bot_reply, "msg_id": msg_id}

        if return_audio:
            logger.info("Generating audio...")
            try:
                mp3_buffer = io.BytesIO()
                communicate = edge_tts.Communicate(bot_reply, "ru-RU-DariyaNeural")
                async for chunk in communicate.stream():
                    if chunk["type"] == "audio":
                        mp3_buffer.write(chunk["data"])
                mp3_buffer.seek(0)

                audio_base64 = base64.b64encode(mp3_buffer.read()).decode("ascii")
                logger.info("Audio generated successfully")
                return {"bot_reply": bot_reply, "audio_base64": audio_base64, "msg_id": msg_id}
            except Exception as e:
                logger.error(f"Audio generation error: {str(e)}")
                logger.error(f"Traceback: {traceback.format_exc()}")
                return JSONResponse({"error": f"Ошибка генерации аудио: {str(e)}"}, status_code=500)
    
    except Exception as e:
        logger.error(f"UNEXPECTED ERROR: {str(e)}")
        logger.error(f"Full traceback: {traceback.format_exc()}")
        return JSONResponse({"error": f"Неожиданная ошибка: {str(e)}"}, status_code=500)

@app.get("/audio/{msg_id}")
def get_audio(msg_id: str):
    audio_file = AUDIO_STORE.get(msg_id)
    if not audio_file or not os.path.exists(audio_file):
        return JSONResponse({"error": "Audio not found"}, status_code=404)
    return FileResponse(audio_file, media_type="audio/mpeg")

@app.get("/lipsync/{msg_id}")
def lipsync(msg_id: str):
    audio_file = AUDIO_STORE.get(msg_id)
    if not audio_file or not os.path.exists(audio_file):
        return JSONResponse({"error": "Audio not found"}, status_code=404)

    with open(audio_file, "rb") as f:
        wav_bytes = f.read()

    data = generate_lipsync_from_audio_chunk(wav_bytes)
    try:
        os.remove(audio_file)
        del AUDIO_STORE[msg_id]
    except:
        pass
    return data

@app.get("/chats")
def chats():
    try:
        chats_list = get_chats_from_db()
        return {"Chats": chats_list}
    except Exception as e:
        return {"error": str(e)}

@app.get("/messages/{chat_id}")
def messages(chat_id: str):
    try:
        messages_list = get_chat_messages_from_db(chat_id)
        return {"Chat_messages": messages_list}
    except Exception as e:
        return {"error": str(e)}

# ИСПРАВЛЕННЫЙ WebSocket с поэтапной отправкой
@app.websocket("/ws/lipsync")
async def lipsync_ws(websocket: WebSocket):
    await websocket.accept()
    print("[WS] Client connected")
    try:
        while True:
            data = await websocket.receive_json()
            text = data.get("text", "")
            if not text:
                await websocket.send_json({"error": "No text provided"})
                continue

            print(f"[WS] Received text: {text}")

            # Генерируем весь MP3
            communicate = edge_tts.Communicate(text, "ru-RU-DariyaNeural")
            mp3_buffer = io.BytesIO()
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    mp3_buffer.write(chunk["data"])
            mp3_buffer.seek(0)

            # Конвертируем весь MP3 в WAV
            audio = AudioSegment.from_file(mp3_buffer, format="mp3")
            audio = audio.set_channels(1).set_frame_rate(44100)
            
            # Делим на чанки по 100ms (можно настроить)
            chunk_length_ms = 100
            total_duration_ms = len(audio)
            
            print(f"[WS] Total audio duration: {total_duration_ms}ms")
            
            # Отправляем lip-sync данные поэтапно
            for i in range(0, total_duration_ms, chunk_length_ms):
                chunk = audio[i:i + chunk_length_ms]
                
                # Экспортируем чанк в WAV
                wav_buffer = io.BytesIO()
                chunk.export(wav_buffer, format="wav")
                wav_bytes = wav_buffer.getvalue()
                
                # Генерируем lip-sync параметры для этого чанка
                mouth_params = generate_lipsync_from_audio_chunk(wav_bytes)
                
                # Отправляем с временной меткой
                await websocket.send_json({
                    "type": "lipsync",
                    "data": {
                        "open": float(mouth_params.get("open", 0)),
                        "form": float(mouth_params.get("form", 0)),
                        "timestamp": i  # миллисекунды от начала
                    }
                })
                
                # Ждем перед следующим чанком (имитация реального времени)
                await asyncio.sleep(chunk_length_ms / 1000.0)
            
            # Отправляем финальный сигнал
            await websocket.send_json({
                "type": "lipsync",
                "data": {"open": 0.0, "form": 0.0},
                "done": True
            })
            print("[WS] Finished sending lipsync data")

    except WebSocketDisconnect:
        print("[WS] Client disconnected")
    except Exception as e:
        print(f"[WS] Error: {e}")
        try:
            await websocket.send_json({"error": str(e)})
        except:
            pass

@app.post("/stt")
async def stt(file: UploadFile = File(...)):
    file_path = f"temp_{file.filename}"
    with open(file_path, "wb") as f:
        f.write(await file.read())

    try:
        text = transcribe_audio(file_path)
        return {"text": text}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)
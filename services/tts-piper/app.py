import base64
import io
import os
from pathlib import Path
from typing import Literal
import wave

from fastapi import FastAPI, HTTPException
from piper.voice import PiperVoice
from pydantic import BaseModel, Field


MAX_TEXT_LENGTH = 4000
MODEL_DIR = Path(os.getenv("PIPER_MODEL_DIR", "/models"))
SPANISH_VOICE_DEFAULT = "es_MX-claude-high"
SPANISH_FALLBACK_VOICE_DEFAULT = "es_ES-sharvard-medium"
ENGLISH_VOICE_DEFAULT = "en_US-lessac-medium"
VOICE_CACHE: dict[str, PiperVoice] = {}

app = FastAPI(title="HomePilot Piper TTS", version="1.0.0")


class TextToSpeechRequest(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_TEXT_LENGTH)
    language: Literal["es", "en"] = "es"


class TextToSpeechResponse(BaseModel):
    provider: Literal["piper"] = "piper"
    audioContentType: Literal["audio/wav"] = "audio/wav"
    audioBase64: str


def voice_candidates(language: str) -> tuple[str, ...]:
    if language == "en":
        return (os.getenv("PIPER_VOICE_EN", ENGLISH_VOICE_DEFAULT),)

    preferred = os.getenv("PIPER_VOICE_ES", SPANISH_VOICE_DEFAULT)
    fallback = os.getenv("PIPER_FALLBACK_VOICE_ES", SPANISH_FALLBACK_VOICE_DEFAULT)
    return (preferred,) if preferred == fallback else (preferred, fallback)


def resolve_model(language: str) -> Path:
    for model_name in voice_candidates(language):
        model_path = MODEL_DIR / f"{model_name}.onnx"
        if model_path.exists():
            return model_path

    raise HTTPException(status_code=503, detail="piper model unavailable for the selected language")


def resolve_voice(language: str) -> PiperVoice:
    model_path = resolve_model(language)
    cache_key = str(model_path)
    cached_voice = VOICE_CACHE.get(cache_key)
    if cached_voice is not None:
        return cached_voice

    voice = PiperVoice.load(model_path)
    VOICE_CACHE[cache_key] = voice
    return voice


def synthesize_wav_bytes(voice: PiperVoice, text: str) -> bytes:
    audio_buffer = io.BytesIO()
    chunks = list(voice.synthesize(text))
    if not chunks:
        return b""

    first_chunk = chunks[0]
    with wave.open(audio_buffer, "wb") as wav_file:
        wav_file.setnchannels(first_chunk.sample_channels)
        wav_file.setsampwidth(first_chunk.sample_width)
        wav_file.setframerate(first_chunk.sample_rate)
        for chunk in chunks:
            wav_file.writeframes(chunk.audio_int16_bytes)

    return audio_buffer.getvalue()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.on_event("startup")
async def preload_default_voices() -> None:
    resolve_voice("es")
    resolve_voice("en")


@app.post("/api/tts", response_model=TextToSpeechResponse)
async def synthesize(request: TextToSpeechRequest) -> TextToSpeechResponse:
    text = request.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")

    try:
        audio = synthesize_wav_bytes(resolve_voice(request.language), text)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail="piper synthesis failed") from exc

    if not audio:
        raise HTTPException(status_code=502, detail="piper synthesis returned empty audio")

    return TextToSpeechResponse(audioBase64=base64.b64encode(audio).decode("ascii"))

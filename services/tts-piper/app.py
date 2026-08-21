import base64
import io
import logging
import os
from pathlib import Path
from typing import Literal
import wave

import numpy as np
import soundfile as sf
from fastapi import FastAPI, HTTPException
from kokoro import KPipeline
from piper.voice import PiperVoice
from pydantic import BaseModel, Field


MAX_TEXT_LENGTH = 4000
MODEL_DIR = Path(os.getenv("PIPER_MODEL_DIR", "/models"))
TTS_ENGINE_KOKORO = "kokoro"
TTS_ENGINE_PIPER = "piper"
SPANISH_VOICE_DEFAULT = "es_MX-claude-high"
SPANISH_FALLBACK_VOICE_DEFAULT = "es_ES-sharvard-medium"
ENGLISH_VOICE_DEFAULT = "en_US-lessac-medium"
KOKORO_SPANISH_VOICE_DEFAULT = "em_alex"
KOKORO_ENGLISH_VOICE_DEFAULT = "af_heart"
VOICE_CACHE: dict[str, PiperVoice] = {}
KOKORO_PIPELINE_CACHE: dict[str, KPipeline] = {}
logger = logging.getLogger("homepilot.tts")

app = FastAPI(title="HomePilot Local TTS", version="3.0.0")


class TextToSpeechRequest(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_TEXT_LENGTH)
    language: Literal["es", "en"] = "es"


class TextToSpeechResponse(BaseModel):
    provider: Literal["kokoro", "piper"]
    audioContentType: Literal["audio/wav"] = "audio/wav"
    audioBase64: str


def tts_engine() -> Literal["kokoro", "piper"]:
    selected = os.getenv("TTS_ENGINE", TTS_ENGINE_KOKORO).strip().lower()
    if selected in (TTS_ENGINE_KOKORO, TTS_ENGINE_PIPER):
        return selected
    logger.warning("Unsupported TTS_ENGINE configured; using Piper fallback")
    return TTS_ENGINE_PIPER


def voice_candidates(language: str) -> tuple[str, ...]:
    if language == "en":
        return (os.getenv("PIPER_VOICE_EN", ENGLISH_VOICE_DEFAULT),)

    preferred = os.getenv("PIPER_VOICE_ES", SPANISH_VOICE_DEFAULT)
    fallback = os.getenv("PIPER_FALLBACK_VOICE_ES", SPANISH_FALLBACK_VOICE_DEFAULT)
    return (preferred,) if preferred == fallback else (preferred, fallback)


def kokoro_voice(language: str) -> str:
    if language == "en":
        return os.getenv("KOKORO_VOICE_EN", KOKORO_ENGLISH_VOICE_DEFAULT)
    return os.getenv("KOKORO_VOICE_ES", KOKORO_SPANISH_VOICE_DEFAULT)


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


def resolve_kokoro_pipeline(language: str) -> KPipeline:
    cached_pipeline = KOKORO_PIPELINE_CACHE.get(language)
    if cached_pipeline is not None:
        return cached_pipeline

    language_code = "e" if language == "es" else "a"
    pipeline = KPipeline(lang_code=language_code)
    KOKORO_PIPELINE_CACHE[language] = pipeline
    return pipeline


def synthesize_piper_wav_bytes(voice: PiperVoice, text: str) -> bytes:
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


def synthesize_kokoro_wav_bytes(language: str, text: str) -> bytes:
    pipeline = resolve_kokoro_pipeline(language)
    audio_segments = [np.asarray(audio) for _, _, audio in pipeline(text, voice=kokoro_voice(language))]
    if not audio_segments:
        return b""

    audio_buffer = io.BytesIO()
    sf.write(audio_buffer, np.concatenate(audio_segments), 24000, format="WAV", subtype="PCM_16")
    return audio_buffer.getvalue()


def synthesize_with_piper(language: str, text: str) -> bytes:
    return synthesize_piper_wav_bytes(resolve_voice(language), text)


def synthesize_with_local_fallback(language: str, text: str) -> tuple[Literal["kokoro", "piper"], bytes]:
    try:
        return TTS_ENGINE_KOKORO, synthesize_kokoro_wav_bytes(language, text)
    except Exception:
        logger.exception("Kokoro synthesis failed; serving the local Piper fallback")
        return TTS_ENGINE_PIPER, synthesize_with_piper(language, text)


@app.get("/health")
async def health() -> dict[str, str]:
    return {
        "status": "ok",
        "engine": tts_engine(),
        "fallback": TTS_ENGINE_PIPER,
    }


@app.on_event("startup")
async def preload_default_voices() -> None:
    resolve_voice("es")
    resolve_voice("en")

    if tts_engine() == TTS_ENGINE_KOKORO:
        for language in ("es", "en"):
            try:
                resolve_kokoro_pipeline(language)
            except Exception:
                logger.exception("Kokoro preload failed; Piper fallback remains available")


@app.post("/api/tts", response_model=TextToSpeechResponse)
async def synthesize(request: TextToSpeechRequest) -> TextToSpeechResponse:
    text = request.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")

    provider: Literal["kokoro", "piper"]
    try:
        if tts_engine() == TTS_ENGINE_KOKORO:
            provider, audio = synthesize_with_local_fallback(request.language, text)
        else:
            provider = TTS_ENGINE_PIPER
            audio = synthesize_with_piper(request.language, text)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail="local speech synthesis failed") from exc

    if not audio:
        raise HTTPException(status_code=502, detail="local speech synthesis returned empty audio")

    return TextToSpeechResponse(
        provider=provider,
        audioBase64=base64.b64encode(audio).decode("ascii"),
    )

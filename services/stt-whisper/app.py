import base64
import os
import tempfile
from functools import lru_cache

from fastapi import FastAPI, HTTPException
from faster_whisper import WhisperModel
from pydantic import BaseModel, Field


MODEL_NAME = os.getenv("WHISPER_MODEL", "tiny")
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
MAX_AUDIO_BYTES = int(os.getenv("WHISPER_MAX_AUDIO_BYTES", "9000000"))

app = FastAPI(title="HomePilot STT Whisper", version="1.0.0")


class SpeechToTextRequest(BaseModel):
    audioBase64: str = Field(min_length=1)
    audioContentType: str = Field(min_length=1)
    language: str = "es"


class SpeechToTextResponse(BaseModel):
    provider: str = "whisper-local"
    transcript: str


@lru_cache(maxsize=1)
def get_model() -> WhisperModel:
    return WhisperModel(MODEL_NAME, device="cpu", compute_type=COMPUTE_TYPE)


def suffix_for_content_type(content_type: str) -> str:
    if "mp4" in content_type:
        return ".mp4"
    if "ogg" in content_type:
        return ".ogg"
    if "wav" in content_type:
        return ".wav"
    return ".webm"


@app.on_event("startup")
async def preload_model() -> None:
    get_model()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "provider": "whisper-local", "model": MODEL_NAME}


@app.post("/api/stt", response_model=SpeechToTextResponse)
async def transcribe(request: SpeechToTextRequest) -> SpeechToTextResponse:
    if not request.audioContentType.startswith("audio/"):
        raise HTTPException(status_code=400, detail="audioContentType must be audio/*")

    try:
        audio = base64.b64decode(request.audioBase64, validate=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="audioBase64 is invalid") from exc

    if not audio:
        raise HTTPException(status_code=400, detail="audio is empty")

    if len(audio) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="audio is too large")

    language = "en" if request.language == "en" else "es"
    suffix = suffix_for_content_type(request.audioContentType)

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=True) as audio_file:
        audio_file.write(audio)
        audio_file.flush()
        segments, _info = get_model().transcribe(
            audio_file.name,
            language=language,
            beam_size=1,
            vad_filter=True
        )
        transcript = " ".join(segment.text.strip() for segment in segments).strip()

    return SpeechToTextResponse(transcript=transcript)

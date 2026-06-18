import base64
import hashlib
import os
import tempfile
from functools import lru_cache

from fastapi import FastAPI, HTTPException
from faster_whisper import WhisperModel
from pydantic import BaseModel, Field


MODEL_NAME = os.getenv("WHISPER_MODEL", "small")
MODEL_PATH = os.getenv("WHISPER_MODEL_PATH", "").strip()
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
MAX_AUDIO_BYTES = int(os.getenv("WHISPER_MAX_AUDIO_BYTES", "9000000"))
BEAM_SIZE = int(os.getenv("WHISPER_BEAM_SIZE", "3"))
VAD_MIN_SILENCE_MS = int(os.getenv("WHISPER_VAD_MIN_SILENCE_MS", "650"))
VAD_SPEECH_PAD_MS = int(os.getenv("WHISPER_VAD_SPEECH_PAD_MS", "400"))

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
    model_source = MODEL_PATH or MODEL_NAME
    if MODEL_PATH:
        verify_model_integrity(MODEL_PATH)
    return WhisperModel(
        model_source,
        device="cpu",
        compute_type=COMPUTE_TYPE,
        local_files_only=bool(MODEL_PATH)
    )


def verify_model_integrity(model_path: str) -> None:
    model_file = os.path.join(model_path, "model.bin")
    manifest_file = os.path.join(model_path, "model.sha256")
    if not os.path.isfile(model_file) or not os.path.isfile(manifest_file):
        raise RuntimeError("Whisper model integrity files are missing")

    with open(manifest_file, "r", encoding="ascii") as file:
        expected_digest = file.read().strip()

    digest = hashlib.sha256()
    with open(model_file, "rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)

    actual_digest = digest.hexdigest()
    if actual_digest != expected_digest:
        raise RuntimeError(
            f"Whisper model integrity check failed: expected {expected_digest}, got {actual_digest}"
        )


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
    get_model()
    return {"status": "ok", "provider": "whisper-local", "model": MODEL_NAME, "ready": "true"}


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
            beam_size=BEAM_SIZE,
            vad_filter=True,
            vad_parameters={
                "min_silence_duration_ms": VAD_MIN_SILENCE_MS,
                "speech_pad_ms": VAD_SPEECH_PAD_MS
            },
            condition_on_previous_text=False
        )
        transcript = " ".join(segment.text.strip() for segment in segments).strip()

    return SpeechToTextResponse(transcript=transcript)

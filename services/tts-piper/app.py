import base64
import os
import subprocess
import tempfile
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


MAX_TEXT_LENGTH = 1200
MODEL_DIR = Path(os.getenv("PIPER_MODEL_DIR", "/models"))

app = FastAPI(title="HomePilot Piper TTS", version="1.0.0")


class TextToSpeechRequest(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_TEXT_LENGTH)
    language: Literal["es", "en"] = "es"


class TextToSpeechResponse(BaseModel):
    provider: Literal["piper"] = "piper"
    audioContentType: Literal["audio/wav"] = "audio/wav"
    audioBase64: str


def resolve_model(language: str) -> Path:
    model_name = (
        os.getenv("PIPER_VOICE_EN", "en_US-lessac-medium")
        if language == "en"
        else os.getenv("PIPER_VOICE_ES", "es_ES-davefx-medium")
    )
    model_path = MODEL_DIR / f"{model_name}.onnx"
    if not model_path.exists():
        raise HTTPException(status_code=503, detail=f"piper model not found: {model_name}")
    return model_path


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/tts", response_model=TextToSpeechResponse)
async def synthesize(request: TextToSpeechRequest) -> TextToSpeechResponse:
    text = request.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")

    model_path = resolve_model(request.language)

    with tempfile.NamedTemporaryFile(suffix=".wav") as audio_file:
        try:
            completed = subprocess.run(
                ["piper", "--model", str(model_path), "--output_file", audio_file.name],
                input=text,
                text=True,
                capture_output=True,
                timeout=float(os.getenv("PIPER_SYNTHESIS_TIMEOUT_SECONDS", "20")),
                check=False,
            )
        except subprocess.TimeoutExpired as exc:
            raise HTTPException(status_code=504, detail="piper synthesis timed out") from exc

        if completed.returncode != 0:
            raise HTTPException(status_code=502, detail="piper synthesis failed")

        audio = Path(audio_file.name).read_bytes()

    if not audio:
        raise HTTPException(status_code=502, detail="piper synthesis returned empty audio")

    return TextToSpeechResponse(audioBase64=base64.b64encode(audio).decode("ascii"))

import base64
import os
from typing import Literal

import edge_tts
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


MAX_TEXT_LENGTH = 1200

app = FastAPI(title="HomePilot Edge TTS", version="1.0.0")


class TextToSpeechRequest(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_TEXT_LENGTH)
    language: Literal["es", "en"] = "es"


class TextToSpeechResponse(BaseModel):
    provider: Literal["edge"] = "edge"
    audioContentType: Literal["audio/mpeg"] = "audio/mpeg"
    audioBase64: str


def resolve_voice(language: str) -> str:
    if language == "en":
        return os.getenv("EDGE_TTS_VOICE_EN", "en-US-AriaNeural")
    return os.getenv("EDGE_TTS_VOICE_ES", "es-MX-DaliaNeural")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/tts", response_model=TextToSpeechResponse)
async def synthesize(request: TextToSpeechRequest) -> TextToSpeechResponse:
    text = request.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")

    communicate = edge_tts.Communicate(
        text,
        resolve_voice(request.language),
        rate=os.getenv("EDGE_TTS_RATE", "-4%"),
        volume=os.getenv("EDGE_TTS_VOLUME", "+0%"),
        pitch=os.getenv("EDGE_TTS_PITCH", "+0Hz"),
    )

    audio = bytearray()
    try:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio.extend(chunk["data"])
    except Exception as exc:
        raise HTTPException(status_code=502, detail="tts synthesis failed") from exc

    if not audio:
        raise HTTPException(status_code=502, detail="tts synthesis returned empty audio")

    return TextToSpeechResponse(audioBase64=base64.b64encode(audio).decode("ascii"))

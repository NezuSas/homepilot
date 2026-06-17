FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ARG WHISPER_MODEL=small
ARG WHISPER_COMPUTE_TYPE=int8
ENV WHISPER_MODEL=${WHISPER_MODEL}
ENV WHISPER_COMPUTE_TYPE=${WHISPER_COMPUTE_TYPE}

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY services/stt-whisper/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

RUN python - <<'PY'
import os
from faster_whisper import WhisperModel
WhisperModel(os.getenv("WHISPER_MODEL", "small"), device="cpu", compute_type=os.getenv("WHISPER_COMPUTE_TYPE", "int8"))
PY

COPY services/stt-whisper/app.py ./app.py

EXPOSE 8090

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8090"]

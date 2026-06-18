FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ARG WHISPER_MODEL=small
ARG WHISPER_COMPUTE_TYPE=int8
ENV WHISPER_MODEL=${WHISPER_MODEL}
ENV WHISPER_COMPUTE_TYPE=${WHISPER_COMPUTE_TYPE}
ENV WHISPER_MODEL_PATH=/models/whisper

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY services/stt-whisper/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

RUN python - <<'PY'
import hashlib
import os

from faster_whisper import WhisperModel
from huggingface_hub import snapshot_download

model_name = os.environ["WHISPER_MODEL"]
model_path = os.environ["WHISPER_MODEL_PATH"]
snapshot_download(
    repo_id=f"Systran/faster-whisper-{model_name}",
    local_dir=model_path,
    force_download=True,
)

model_file = os.path.join(model_path, "model.bin")
digest = hashlib.sha256()
with open(model_file, "rb") as file:
    for chunk in iter(lambda: file.read(1024 * 1024), b""):
        digest.update(chunk)

with open(os.path.join(model_path, "model.sha256"), "w", encoding="ascii") as file:
    file.write(f"{digest.hexdigest()}\n")

WhisperModel(
    model_path,
    device="cpu",
    compute_type=os.environ["WHISPER_COMPUTE_TYPE"],
    local_files_only=True,
)
PY

COPY services/stt-whisper/app.py ./app.py

EXPOSE 8090

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8090"]

FROM python:3.12-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY services/tts-piper/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

RUN mkdir -p /models \
    && python - <<'PY'
from pathlib import Path
from urllib.request import urlretrieve

BASE_URL = "https://huggingface.co/rhasspy/piper-voices/resolve/main"
MODELS = [
    ("es/es_ES/davefx/medium/es_ES-davefx-medium.onnx", "es_ES-davefx-medium.onnx"),
    ("es/es_ES/davefx/medium/es_ES-davefx-medium.onnx.json", "es_ES-davefx-medium.onnx.json"),
    ("en/en_US/lessac/medium/en_US-lessac-medium.onnx", "en_US-lessac-medium.onnx"),
    ("en/en_US/lessac/medium/en_US-lessac-medium.onnx.json", "en_US-lessac-medium.onnx.json"),
]

target = Path("/models")
for remote_path, filename in MODELS:
    urlretrieve(f"{BASE_URL}/{remote_path}", target / filename)
PY

COPY services/tts-piper/app.py ./app.py

EXPOSE 8088

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8088"]

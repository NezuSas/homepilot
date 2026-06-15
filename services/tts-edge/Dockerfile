FROM python:3.12-slim

WORKDIR /app

COPY services/tts-edge/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY services/tts-edge/app.py ./app.py

EXPOSE 8088

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8088"]

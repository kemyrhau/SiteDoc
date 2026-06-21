# syntax=docker/dockerfile:1
# NY-SERVER — Python ML-tjenester (embedding 3302 + oversettelse 3303) (i prod fra 2026-06-10).
# Scriptene bruker stdlib http.server + torch/transformers. Samme image kjorer begge (command settes i compose).
# Modellvekter (NorBERT, multilingual-e5, OPUS-MT) lastes fra HuggingFace ved foerste kjoring -> caches i /models-volum.

FROM python:3.12-slim
WORKDIR /app
# torch CPU-wheel (mindre enn CUDA-varianten)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
 && pip install --no-cache-dir transformers sentencepiece numpy
COPY apps/api/src/services/norbert-server.py apps/api/src/services/oversettelse-server.py ./
ENV HF_HOME=/models
# Default = embedding-server; oversettelse-tjenesten overstyrer command i compose.
CMD ["python", "norbert-server.py"]

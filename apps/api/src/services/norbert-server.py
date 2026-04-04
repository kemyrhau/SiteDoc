#!/usr/bin/env python3
"""
Multi-modell embedding-server for SiteDoc.

Modeller:
  - NorBERT (ltgoslo/norbert2) — 768 dim, norsk (lastes ved oppstart)
  - multilingual-e5-base (intfloat/multilingual-e5-base) — 768 dim, 100+ språk (lazy)

Endepunkter:
  POST /embed       — NorBERT (bakoverkompatibel)
  POST /embed/model — Velg modell: { "model": "multilingual-e5-base", "texts": [...] }
  GET  /health      — Status + lastede modeller

Start: ~/norbert-env/bin/python3 norbert-server.py
Lytter på port 3302
"""
import json
import os
import time
from http.server import HTTPServer, BaseHTTPRequestHandler

import torch
from transformers import AutoTokenizer, AutoModel

PORT = int(os.environ.get("NORBERT_PORT", "3302"))

# ---- NorBERT (lastes ved oppstart) ----
print("Laster NorBERT (ltgoslo/norbert2)...", flush=True)
norbert_tokenizer = AutoTokenizer.from_pretrained("ltgoslo/norbert2")
norbert_model = AutoModel.from_pretrained("ltgoslo/norbert2")
norbert_model.eval()
print(f"NorBERT lastet — lytter på port {PORT}", flush=True)

# ---- Multilingual E5 (lazy loading) ----
e5_tokenizer = None
e5_model = None


def _last_e5():
    global e5_tokenizer, e5_model
    if e5_model is not None:
        return
    print("Laster multilingual-e5-base (intfloat/multilingual-e5-base)...", flush=True)
    start = time.time()
    e5_tokenizer = AutoTokenizer.from_pretrained("intfloat/multilingual-e5-base")
    e5_model = AutoModel.from_pretrained("intfloat/multilingual-e5-base")
    e5_model.eval()
    dt = time.time() - start
    print(f"multilingual-e5-base lastet på {dt:.1f}s", flush=True)


def _mean_pool(outputs, mask):
    """Mean pooling med attention mask."""
    expanded = mask.unsqueeze(-1).expand(outputs.last_hidden_state.size()).float()
    pooled = (outputs.last_hidden_state * expanded).sum(1) / expanded.sum(1).clamp(min=1e-9)
    return torch.nn.functional.normalize(pooled, p=2, dim=1)


def encode_norbert(texts: list[str]) -> list[list[float]]:
    """Encode med NorBERT (norsk)."""
    embeddings = []
    for i in range(0, len(texts), 16):
        batch = texts[i:i + 16]
        inputs = norbert_tokenizer(batch, padding=True, truncation=True, max_length=512, return_tensors="pt")
        with torch.no_grad():
            outputs = norbert_model(**inputs)
            norms = _mean_pool(outputs, inputs["attention_mask"])
            for vec in norms.numpy().astype("float32"):
                embeddings.append(vec.tolist())
    return embeddings


def encode_e5(texts: list[str]) -> list[list[float]]:
    """Encode med multilingual-e5-base (flerspråklig)."""
    _last_e5()
    # E5 krever "passage: " eller "query: " prefix
    prefixed = [f"passage: {t}" for t in texts]
    embeddings = []
    for i in range(0, len(prefixed), 16):
        batch = prefixed[i:i + 16]
        inputs = e5_tokenizer(batch, padding=True, truncation=True, max_length=512, return_tensors="pt")
        with torch.no_grad():
            outputs = e5_model(**inputs)
            norms = _mean_pool(outputs, inputs["attention_mask"])
            for vec in norms.numpy().astype("float32"):
                embeddings.append(vec.tolist())
    return embeddings


def encode_e5_query(texts: list[str]) -> list[list[float]]:
    """Encode søkequery med multilingual-e5-base."""
    _last_e5()
    prefixed = [f"query: {t}" for t in texts]
    embeddings = []
    for i in range(0, len(prefixed), 16):
        batch = prefixed[i:i + 16]
        inputs = e5_tokenizer(batch, padding=True, truncation=True, max_length=512, return_tensors="pt")
        with torch.no_grad():
            outputs = e5_model(**inputs)
            norms = _mean_pool(outputs, inputs["attention_mask"])
            for vec in norms.numpy().astype("float32"):
                embeddings.append(vec.tolist())
    return embeddings


ENCODERS = {
    "norbert2": encode_norbert,
    "multilingual-e5-base": encode_e5,
    "multilingual-e5-query": encode_e5_query,
}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            modeller = ["norbert2"]
            if e5_model is not None:
                modeller.append("multilingual-e5-base")
            self._svar(200, {"status": "ok", "modeller": modeller})
        else:
            self._svar(404, {"error": "Ikke funnet"})

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)

        try:
            if self.path == "/embed":
                # Bakoverkompatibel: NorBERT
                texts = json.loads(body)
                if not isinstance(texts, list):
                    raise ValueError("Forventet JSON-array")
                result = encode_norbert(texts)
                self._svar(200, result)

            elif self.path == "/embed/model":
                # Velg modell
                data = json.loads(body)
                modell = data.get("model", "norbert2")
                texts = data.get("texts", [])
                if not texts:
                    self._svar(400, {"error": "Mangler texts"})
                    return
                encoder = ENCODERS.get(modell)
                if not encoder:
                    self._svar(400, {"error": f"Ukjent modell: {modell}. Tilgjengelige: {list(ENCODERS.keys())}"})
                    return
                result = encoder(texts)
                self._svar(200, {"embeddings": result, "model": modell, "dim": len(result[0]) if result else 0})

            else:
                self._svar(404, {"error": "Ikke funnet"})

        except Exception as e:
            self._svar(500, {"error": str(e)})

    def _svar(self, kode, data):
        self.send_response(kode)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode())

    def log_message(self, format, *args):
        pass


if __name__ == "__main__":
    server = HTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Embedding-server klar på http://127.0.0.1:{PORT} (NorBERT + E5 lazy)", flush=True)
    server.serve_forever()

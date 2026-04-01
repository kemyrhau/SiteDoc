#!/usr/bin/env python3
"""
NorBERT embedding-server. Kjører som en persistent HTTP-tjeneste.
Node.js sender POST /embed med JSON-body ["tekst1", "tekst2", ...]
Returnerer JSON-array med embeddings.

Start: ~/norbert-env/bin/python3 norbert-server.py
Lytter på port 3302 (konfigurerbart via NORBERT_PORT)
"""
import json
import os
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("NORBERT_PORT", "3302"))

# Last modell ved oppstart
print(f"Laster NorBERT (ltgoslo/norbert2)...", flush=True)
from transformers import AutoTokenizer, AutoModel
import torch

tokenizer = AutoTokenizer.from_pretrained("ltgoslo/norbert2")
model = AutoModel.from_pretrained("ltgoslo/norbert2")
model.eval()
print(f"NorBERT lastet — lytter på port {PORT}", flush=True)


def encode(texts: list[str]) -> list[list[float]]:
    embeddings = []
    batch_size = 16
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        inputs = tokenizer(
            batch, padding=True, truncation=True,
            max_length=512, return_tensors="pt",
        )
        with torch.no_grad():
            outputs = model(**inputs)
            mask = inputs["attention_mask"].unsqueeze(-1).expand(
                outputs.last_hidden_state.size()
            ).float()
            pooled = (outputs.last_hidden_state * mask).sum(1) / mask.sum(1).clamp(min=1e-9)
            norms = torch.nn.functional.normalize(pooled, p=2, dim=1)
            for vec in norms.numpy().astype("float32"):
                embeddings.append(vec.tolist())
    return embeddings


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        try:
            texts = json.loads(body)
            if not isinstance(texts, list):
                raise ValueError("Forventet JSON-array")
            result = encode(texts)
            response = json.dumps(result)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(response.encode())
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def log_message(self, format, *args):
        # Stille logging
        pass


if __name__ == "__main__":
    server = HTTPServer(("127.0.0.1", PORT), Handler)
    print(f"NorBERT embedding-server klar på http://127.0.0.1:{PORT}", flush=True)
    server.serve_forever()

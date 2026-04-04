#!/usr/bin/env python3
"""
NorBERT embedding-script. Kalles fra Node.js via child_process.
Leser JSON-array med tekster fra stdin, skriver JSON-array med embeddings til stdout.

Bruk:
  echo '["tekst1", "tekst2"]' | python3 norbert-embed.py
  → [[0.01, -0.42, ...], [0.03, 0.11, ...]]
"""
import sys
import json

def main():
    from transformers import AutoTokenizer, AutoModel
    import torch

    # Les tekster fra stdin
    raw = sys.stdin.read()
    texts = json.loads(raw)
    if not texts:
        print("[]")
        return

    # Last modell (cached av OS etter første kjøring)
    tokenizer = AutoTokenizer.from_pretrained("ltgoslo/norbert2")
    model = AutoModel.from_pretrained("ltgoslo/norbert2")
    model.eval()

    embeddings = []
    batch_size = 8
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
            # Normaliser
            norms = torch.nn.functional.normalize(pooled, p=2, dim=1)
            for vec in norms.numpy().astype("float32"):
                embeddings.append(vec.tolist())

    json.dump(embeddings, sys.stdout)

if __name__ == "__main__":
    main()

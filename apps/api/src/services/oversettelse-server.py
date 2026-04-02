"""
Oversettelsesserver for SiteDoc — Helsinki-NLP/OPUS-MT

Lytter på port 3303.
POST /translate { "texts": [...], "source": "nb", "target": "en" }
GET  /health
GET  /models  — liste over lastede modeller

Modellhåndtering:
- Direkte par: nb→en, nb→de, nb→sv, nb→fi, nb→ru, nb→pl (via "no" i OPUS)
- Pivot via engelsk for: cs, ro, lt, et, lv, uk (nb→en→target)
- LRU-cache: maks 3 modeller lastet (~300MB per modell)
"""

import json
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from collections import OrderedDict

# Lazy imports
tokenizers = {}
models = {}

MAKS_MODELLER = 3
PORT = 3303

# Språkpar-mapping: OPUS-MT bruker ISO 639-1/639-2 koder
# Noen par finnes direkte, andre trenger pivot via engelsk
DIREKTE_PAR = {
    "en": "Helsinki-NLP/opus-mt-tc-big-gmn-en",  # Germansk→Engelsk (dekker norsk)
    "de": "Helsinki-NLP/opus-mt-gmn-de",          # Germansk→Tysk
    "sv": "Helsinki-NLP/opus-mt-sv-no",           # Bruker reversert: no→sv via sv→no
    "fi": "Helsinki-NLP/opus-mt-tc-big-en-fi",    # Via pivot
    "ru": "Helsinki-NLP/opus-mt-en-ru",           # Via pivot
    "pl": "Helsinki-NLP/opus-mt-en-pl",           # Via pivot
}

# Språk som trenger pivot via engelsk (nb→en→target)
PIVOT_SPRAAK = {"fi", "ru", "pl", "cs", "ro", "lt", "et", "lv", "uk"}

# OPUS-MT modeller for en→target
EN_TIL_TARGET = {
    "fi": "Helsinki-NLP/opus-mt-en-fi",
    "ru": "Helsinki-NLP/opus-mt-en-ru",
    "pl": "Helsinki-NLP/opus-mt-en-sla",    # Slavisk gruppe
    "cs": "Helsinki-NLP/opus-mt-en-cs",
    "ro": "Helsinki-NLP/opus-mt-en-roa",    # Romansk gruppe
    "lt": "Helsinki-NLP/opus-mt-en-lt",
    "et": "Helsinki-NLP/opus-mt-en-et",
    "lv": "Helsinki-NLP/opus-mt-en-lv",
    "uk": "Helsinki-NLP/opus-mt-en-uk",
    "sv": "Helsinki-NLP/opus-mt-en-sv",
    "de": "Helsinki-NLP/opus-mt-en-de",
}

# nb→en modell
NB_TIL_EN = "Helsinki-NLP/opus-mt-gmn-en"

class ModellCache:
    """LRU-cache for oversettelsesmodeller."""

    def __init__(self, maks: int = MAKS_MODELLER):
        self.maks = maks
        self.cache: OrderedDict[str, tuple] = OrderedDict()  # modellnavn → (tokenizer, model)

    def hent(self, modellnavn: str):
        """Hent eller last modell. Returnerer (tokenizer, model)."""
        if modellnavn in self.cache:
            self.cache.move_to_end(modellnavn)
            return self.cache[modellnavn]

        print(f"Laster modell: {modellnavn}...", flush=True)
        start = time.time()

        from transformers import MarianMTModel, MarianTokenizer
        tokenizer = MarianTokenizer.from_pretrained(modellnavn)
        model = MarianMTModel.from_pretrained(modellnavn)

        dt = time.time() - start
        print(f"Modell {modellnavn} lastet på {dt:.1f}s", flush=True)

        # Fjern eldste hvis cache er full
        while len(self.cache) >= self.maks:
            fjernet_navn, _ = self.cache.popitem(last=False)
            print(f"Fjernet modell fra cache: {fjernet_navn}", flush=True)

        self.cache[modellnavn] = (tokenizer, model)
        return (tokenizer, model)

    def liste(self):
        return list(self.cache.keys())


cache = ModellCache()


def oversett_tekster(tekster: list[str], kilde: str, maal: str) -> list[str]:
    """Oversett en liste med tekster fra kilde til mål-språk."""
    if not tekster:
        return []

    if kilde == maal:
        return tekster

    # Strategi 1: nb→en (direkte via gmn-en)
    if kilde in ("nb", "no") and maal == "en":
        return _oversett_batch(tekster, NB_TIL_EN)

    # Strategi 2: nb→sv/de (direkte par hvis tilgjengelig)
    if kilde in ("nb", "no") and maal in ("sv", "de") and maal not in PIVOT_SPRAAK:
        modell = EN_TIL_TARGET.get(maal)
        if modell:
            # Pivot: nb→en→target
            en_tekster = _oversett_batch(tekster, NB_TIL_EN)
            return _oversett_batch(en_tekster, modell)

    # Strategi 3: Pivot via engelsk (nb→en→target)
    if kilde in ("nb", "no") and maal in EN_TIL_TARGET:
        en_tekster = _oversett_batch(tekster, NB_TIL_EN)
        return _oversett_batch(en_tekster, EN_TIL_TARGET[maal])

    # Fallback: prøv en→target
    if kilde == "en" and maal in EN_TIL_TARGET:
        return _oversett_batch(tekster, EN_TIL_TARGET[maal])

    raise ValueError(f"Ingen oversettelsespar for {kilde}→{maal}")


def _oversett_batch(tekster: list[str], modellnavn: str) -> list[str]:
    """Oversett batch med en spesifikk modell."""
    import torch

    tokenizer, model = cache.hent(modellnavn)

    resultater = []
    # Batch à 16 for å unngå OOM
    for i in range(0, len(tekster), 16):
        batch = tekster[i:i+16]
        inputs = tokenizer(batch, return_tensors="pt", padding=True, truncation=True, max_length=512)
        with torch.no_grad():
            outputs = model.generate(**inputs, max_length=512)
        oversatt = tokenizer.batch_decode(outputs, skip_special_tokens=True)
        resultater.extend(oversatt)

    return resultater


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self._svar(200, {"status": "ok", "modeller": cache.liste()})
        elif self.path == "/models":
            self._svar(200, {"modeller": cache.liste()})
        else:
            self._svar(404, {"error": "Ikke funnet"})

    def do_POST(self):
        if self.path != "/translate":
            self._svar(404, {"error": "Ikke funnet"})
            return

        try:
            lengde = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(lengde))

            tekster = body.get("texts", [])
            kilde = body.get("source", "nb")
            maal = body.get("target", "en")

            if not tekster:
                self._svar(400, {"error": "Mangler texts-felt"})
                return

            start = time.time()
            oversatt = oversett_tekster(tekster, kilde, maal)
            dt = time.time() - start

            print(f"Oversatt {len(tekster)} tekster {kilde}→{maal} på {dt:.1f}s", flush=True)
            self._svar(200, {"translations": oversatt, "time": round(dt, 2)})

        except ValueError as e:
            self._svar(400, {"error": str(e)})
        except Exception as e:
            print(f"Feil: {e}", flush=True)
            self._svar(500, {"error": str(e)})

    def _svar(self, kode: int, data: dict):
        self.send_response(kode)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode())

    def log_message(self, _format, *_args):
        # Dempet logging
        pass


if __name__ == "__main__":
    print(f"Oversettelsesserver starter på port {PORT}...", flush=True)
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Avslutter.", flush=True)
        server.server_close()

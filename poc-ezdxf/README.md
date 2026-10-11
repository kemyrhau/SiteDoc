# PoC: ezdxf som DXF→SVG-motor bak SiteDocs eksisterende lag

**Ikke produksjonskode.** Målbar prøve (jf. `relay/inbox-dokgen-ezdxf-poc.md`).
Rapport med tall ligger nederst i `relay/inbox-orkestrator.md`. Bilder i
`relay/ezdxf-poc/` (gitignorert). Kundefila er ALDRI i git.

## Idé
`konverterDwg` (`apps/api/src/services/dwgKonvertering.ts:2038`) beholder hele
laget rundt renderen (extents, robust-trim, auto-rotasjon, startutsnitt,
koordinatsystem, georef, `mmPrPiksel`, fullstendighetsrapport). Bare SELVE
tegnedelen (`dxfTilSvg`) byttes mot `render.py` når `DWG_MOTOR=ezdxf`. georef og
`mmPrPiksel` beregnes i `konverterDwg` fra `vbW`/`width`/`beregnExtents` →
motor-uavhengig (derav krav 6-pariteten).

- **Geometri:** ezdxf Frontend → native `SVGBackend` (= en `Recorder`). Vi leser
  `player.recordings()` → primitiver i VERDENSKOORDINATER med farge/lineweight/
  lag/handle. **Ingen SVGBackend-subklasse.**
- **Tekst:** `TextPolicy.IGNORE` (ezdxf tegner ikke tekst) + vår egen `<text>`
  (`fontStr=h/0.716`, `mtekstForankring`, motrotering).
- **viewBox:** DXF-enheter, y-flip, 2 % margin — IKKE ezdxf sin 1e6-normalisering.
- **Strek:** viewBox-enheter, INGEN `vector-effect` (hotfix 2-lærdom).
- **data-layer/data-type:** `--metadata på` henter lag fra player + type via
  `handle→dxftype()` → gjenoppretter klikk-identifiser + rapport UTEN subklasse.

## Kjøre
```sh
python3 -m venv venv && ./venv/bin/pip install --require-hashes -r requirements.txt
dwg2dxf -o tegning.dxf "kundefil.dwg"       # libredwg 0.14, finnes alt i imaget
./venv/bin/python render.py tegning.dxf ut.svg \
    --tekst egen --gruppering ingen --metadata på [--rotasjon av --robust av]
```
- Georef-tegninger (koordinatsystem funnet): `--rotasjon av --robust av` (= `ingenAutoRotasjon`).
- `--gruppering ingen` kreves for jevn panorerings-perf (se rapport, krav 5).

`egen-maal.ts` kjører den EKSISTERENDE motoren for «egen»-tallene (krav 6-sammenligning):
```sh
apps/api/node_modules/.bin/tsx poc-ezdxf/egen-maal.ts tegning.dxf "filnavn.dxf" ut-dir
```

## Docker (måling, ikke prod)
`Dockerfile.maaling` måler størrelses-økningen ezdxf-laget legger på api-runtime.
Målt: base (node:20-bookworm-slim + fontconfig) 336 MB → +ezdxf 590 MB = **+254 MB**.
`fontconfig` finnes alt; ingen font-pakke trengs (vi tegner tekst selv).

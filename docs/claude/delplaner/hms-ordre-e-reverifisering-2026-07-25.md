---
name: hms-ordre-e-reverifisering
status: 🟢 RE-VERIFISERINGSVEILEDER for Opus-i-Chrome — to feilrettinger fra Ordre E. 2026-07-25
eier: cowork (veileder) · Kenneth (kjører i Chrome-Opus)
---

# HMS RUH-liste — re-verifisering (Ordre E)

## Mål
Verifiser **to** feilrettinger på test.sitedoc.no etter Ordre E (deployet 2026-07-25). Dette er en fokusert re-test av to spesifikke bugs — ikke hele HMS-flyten.

## Miljø
- **URL:** test.sitedoc.no (innlogget)
- **Prosjekt:** Sitedoc Boligfelt B12
- **Naviger:** venstre nav → **HMS** → **RUH**-fanen
- Det ligger allerede flere RUH-dokumenter i lista (RUH-003, -005, -006, -007) fra tidligere testing — bruk dem.

## Test 1 — «[object Object]» er borte
1. Åpne **HMS → RUH**-fanen og se på tabellen.
2. **Forventet:** kolonnene **«Type observasjon»** og **«Innmelder»** viser **lesbar tekst** (f.eks. «Farlig forhold» / «Nestenulykke», og et personnavn) — **IKKE** `[object Object]`.
3. **FAIL** hvis noen rad viser `[object Object]` i en av disse kolonnene.

*(ta skjermbilde av RUH-lista)*

## Test 2 — Radklikk åpner oppgaven (ikke sjekkliste-404)
1. I RUH-fanen: klikk på en RUH-rad (f.eks. **RUH-007**).
2. **Forventet:** dokumentet åpnes på URL **`/dashbord/{prosjektId}/oppgaver/{id}`**, og RUH-detaljsiden vises (tittel «RUH» + status øverst).
3. **FAIL** hvis URL-en blir `/sjekklister/{id}` og siden viser **«Sjekklisten ble ikke funnet»**.

*(ta skjermbilde av det åpnede RUH-dokumentet + URL-linja)*

## Rapportering
Per test: **PASS / FAIL** + skjermbilde. Er begge PASS, er Ordre E verifisert og hele HMS-sporet (flyt A–D + polish E) er ferdig ende-til-ende.

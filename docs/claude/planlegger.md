# Fremdriftsplanlegger — Fase 4

## Formål
Ressursplanlegging på dagsnivå: match ansatte med riktig kompetanse til riktige prosjekter, med maskin- og utstyrsbehov. Vises som daglig plan i mobil-app ned på individnivå.

## Tre moduler

### 1. Kompetanseregister (ansatt)
Hentes fra HR-system via ansattnummer, lagres lokalt.

Egenskaper per ansatt:
- Førerkort: B (bil), BE (henger), C (lastebil), CE (vogntog)
- Maskinførerbevis: hjullaster, gravemaskin, teleskoptruck
- Fagkompetanse: steinlegger, grøntarbeider, snekker, hjelpearbeider, gartner, betongarbeider
- Sertifikater: HMS, varmt arbeid, fallsikring
- Antall seter i privatbil (for samkjøring)

Modell: `AnsattKompetanse { userId, type, verdi, utløper? }`

### 2. Bemanningsplan per prosjekt per dag
Admin setter opp behov:

```
Prosjekt: 998 Innstifjordbotn — Torsdag 17. april
Behov:
  1 × hjullasterfører
  2 × steinlegger
  1 × grøntarbeider
  Transport: 3 mann må kjøre bil (prosjekt 45 km unna)
```

Modell: `BemanningsBehov { prosjektId, dato, rolle, antall }`

### 3. Forslag-motor
Regler for automatisk forslag:

1. **Kontinuitet** — ansatt på samme prosjekt i går → prioriter
2. **Kompetanse-match** — ansatt har riktig rolle/sertifikat
3. **Tilgjengelighet** — ikke allerede planlagt på annet prosjekt
4. **Transport** — grupper ansatte som bor nærme hverandre
5. **Maskin** — noter hvilken maskin som skal til hvilket prosjekt

Output: daglig plan per ansatt

```
Ola Hansen     → 998 Innstifjordbotn (steinlegger) — kjører med Per
Per Johansen   → 998 Innstifjordbotn (steinlegger) — kjører Ola
Trude Berg     → E6 Kvænangsfjellet (grøntarbeider) — egen bil
Hjullaster #3  → 998 Innstifjordbotn
```

## Mobil-visning (per ansatt)
Ansatt åpner appen → ser:
- Hvilket prosjekt de skal på i dag
- Hvem de kjører med / hvem som kjører dem
- Hvilken maskin de skal bruke
- Oppmøtetid

## Avhengigheter
- Ansattregister (timer-modul)
- Maskinregister (maskin-modul)
- HR-integrasjon for kompetansehenting

## Status
Planlagt — Fase 4. Starter etter timer og maskin er ferdig.

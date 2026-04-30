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

## AI-drevet ukeplan (fremtidig utvidelse)

Naturlig neste steg etter regelbasert forslagsmotor: la AI generere ukeplan basert på kompetansematrise, prosjektbehov og historikk.

### Input til AI-motor

1. **Kompetansematrise** — hvilke ansatte har hvilke sertifiseringer (kobles til mannskap/kompetanseregister, jf. SmartDoks 77 kompetansetyper som referanse)
2. **Prosjektbehov per uke** — admin huker av:
   - Hvilke prosjekter som er aktive
   - Hvor mange mann per prosjekt
   - Kjernekompetanser som kreves (f.eks. "M2 Gravemaskin", "ADK1", "HMS-kurs 40t", "DO CAT 325")
3. **Tilstedeværelses-historikk** — hvem var på hvilket prosjekt forrige uke (kontinuitet)
4. **Timer-historikk** — hvem har ført timer mot hvilke underprosjekter
5. **Maskin-tilknytning** — hvilke maskiner trengs (kobles til maskinens lokasjon = prosjekt)
6. **Geografi** — bopel for samkjøring
7. **Fravær** — ferie, sykdom, kurs

### Output

AI/SiteDoc foreslår:
- Komplett ukeplan per ansatt × dag × prosjekt
- Forslag til samkjøring
- Maskin-allokering
- Markering av kompetansemangel (rødt: «ingen tilgjengelig med ADK1 på prosjekt X tirsdag»)
- Konfliktvarsler (samme person foreslått på to prosjekter, sertifikat utløpt midt i uken, etc.)

### Brukerflyt

1. Admin åpner planlegger mandag morgen
2. Huker av aktive prosjekter for uken + bemannings-/kompetansekrav
3. Klikker «Generer ukeplan» — AI bruker historikk + kompetanse + tilgjengelighet
4. Får forslag visualisert som matrise (ansatte × dager × prosjekter)
5. Justerer manuelt der nødvendig
6. Publiserer → ansatte ser sin uke i mobilen
7. AI lærer av justeringene til neste uke

### Avhengigheter

- Mannskap-modul med kompetanseregister (jf. [mannskap.md](mannskap.md))
- Maskin-modul med GPS/lokasjons-data (jf. [maskin.md](maskin.md))
- Timer-modul med dagsseddel-historikk (jf. [timer.md](timer.md))
- AI-integrasjon (jf. [ai-integrasjon.md](ai-integrasjon.md)) — sannsynligvis Claude API med strukturert tool-use

### Status

Idé under arbeid. Krever at modulene mannskap + maskin + timer er ferdig først, samt at kompetansematrisen er bygget ut.

## Status
Planlagt — Fase 4. Starter etter timer og maskin er ferdig.

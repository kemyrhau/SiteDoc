# Hooks — Skjema-motoren (offline-first)

## useSjekklisteSkjema / useOppgaveSkjema

To parallelle hooks (~500 linjer hver) som implementerer Dalux-stil utfylling med offline-first sync. Identisk interface, ulik datakilde.

### Dual lagringslag

```
Bruker endrer felt
  → SQLite (instant, <10ms) → lagreStatus: "lagret"
  → Server (async, 2s debounce) → synkStatus: "synkronisert"
```

- `feltVerdierRef` (useRef) forhindrer stale closure i `lagreIntern`
- Auto-lagring med 2s debounce for ALLE endringer
- `lagreStatus`: idle → lagret → idle (2s)
- `synkStatus`: synkronisert | lokalt_lagret | synkroniserer

### Initialisering

1. Les SQLite først (<10ms)
2. Hvis usynkronisert lokal data → **bruk den** (prioritert over server)
3. Hvis synkronisert → hent fra server, oppdater lokal kopi
4. Auto-fill for nye dokumenter (date→i dag, person→bruker, company→faggruppe)

### Rekursiv synlighet

`erSynlig(objekt)` — sjekker hele foreldrekjeden:
1. Finn forelder via `parentId` (DB-kolonne, fallback: `config.conditionParentId`)
2. Sjekk om forelderfeltets verdi matcher `conditionValues`
3. Gå opp til rot rekursivt — ALLE foreldere må være synlige

### Vedlegg-håndtering

- `leggTilVedlegg(objektId, vedlegg)` → oppdater feltdata + legg i opplastingskø
- `fjernVedlegg(objektId, vedleggId)` → fjern fra feltdata
- Bakgrunnskø-callback oppdaterer lokal URL → server URL i sanntid
- `dokumentType`-filter sikrer at sjekkliste-hook kun reagerer på sjekkliste-opplastinger

### Validering

- `valider()` sjekker `required`-felter i malen
- Kun synlige felter valideres (betinget skjulte hopper over)
- Returnerer `{ gyldig: boolean, feil: string[] }`

## Fallgruver

- Endringer i useSjekklisteSkjema bør ALLTID speiles i useOppgaveSkjema
- `feltVerdierRef` MÅ brukes i debounced save — ellers stale closure
- Auto-fill kun for nye dokumenter uten eksisterende data
- Callback-filter (`dokumentType`) er kritisk — uten den kan sjekkliste-hook reagere på oppgave-opplastinger

# Hooks — Skjema-motoren (offline-first)

## useSjekklisteSkjema / useOppgaveSkjema

To parallelle hooks (~500 linjer hver) som implementerer Dalux-stil utfylling med offline-first sync. Nær-identisk interface, ulik datakilde — men de er IKKE garantert like: append-only felt-låsing manglet i tre av fire hooks til 2026-07-16 fordi speiling sviktet. Deler logikk skal ligge i `@sitedoc/shared`, ikke kopieres per hook.

### Append-only felt-låsing (delt kilde)

Felt med server-bekreftet verdi er låst for verdi-endring; nye felt, kommentar og vedlegg forblir redigerbare. Lås-settet beregnes av `beregnLaasteFelter(serverData)` i `@sitedoc/shared` (`utils/feltLaasing.ts`) — samme kilde i alle fire hooks + web-versjonene. `erFeltLåst(objektId)` eksponeres av hooken; detaljsiden bruker `verdiLeseModus = leseModus || erFeltLåst(id)` på verdi-rendereren.

**Mobil-regel:** lås-settet beregnes ALLTID fra server-data (`Task.data`/`Checklist.data`), ALDRI fra lokal usynkronisert SQLite. Ellers låses et felt brukeren nettopp fylte offline. `settVerdi` har en guard som blokkerer låste felt (forsvar-i-dybde bak UI-en).

Merk: dette er klient-lås. Server `oppdaterData` shallow-merger og håndhever IKKE append-only.

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

- Speiling mellom hookene er bevist utilstrekkelig (append-only manglet i 3/4 til 2026-07-16). Deler logikk skal LØFTES til `@sitedoc/shared`, ikke kopieres. Endringer i én hook må aktivt verifiseres mot de tre andre + web-versjonene.
- `feltVerdierRef` MÅ brukes i debounced save — ellers stale closure
- Auto-fill kun for nye dokumenter uten eksisterende data
- Callback-filter (`dokumentType`) er kritisk — uten den kan sjekkliste-hook reagere på oppgave-opplastinger

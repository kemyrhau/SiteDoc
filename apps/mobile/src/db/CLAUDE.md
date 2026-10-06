# Offline-sync — SQLite lokal database

## Oversikt

SQLite-laget (expo-sqlite + Drizzle ORM) er kjernen i offline-first-strategien. All data skrives lokalt først (<10ms), deretter synkroniseres til server.

## Tabeller

| Tabell | Nøkkelkolonner | Formål |
|--------|---------------|--------|
| `sjekkliste_feltdata` | sjekklisteId, feltVerdier (JSON), erSynkronisert, sistEndretLokalt | Lokal sjekkliste-utfylling |
| `oppgave_feltdata` | oppgaveId, feltVerdier (JSON), erSynkronisert, sistEndretLokalt | Lokal oppgave-utfylling |
| `opplastings_ko` | sjekklisteId?, oppgaveId?, objektId, vedleggId, lokalSti, status, forsok, serverUrl | Bakgrunnskø for filopplasting |
| `sjekkliste_local` | id (server), projectId, byggeplassId?, + navn-kolonner lista viser | **Offline-katalog for sjekklistelista** (read-only mirror, fase 1 2026-09-11). Full-overskrives per prosjekt via `sjekklisteKatalog.refreshSjekklisteKatalog`. Bærer KUN det lista viser/filtrerer på (målt mot `app/sjekkliste/index.tsx`). Synkes aldri opp — utfylling bor i `sjekkliste_feltdata` |
| `oppgave_local` | id (server), projectId, **userId** (synlighetsvakt), byggeplassId? (UTLEDET fra `drawing.byggeplass.id`), priority, templateSubdomain, + navn-kolonner lista viser | **Offline-katalog for oppgavelista** (read-only mirror, 2026-10-03). Full-overskrives per prosjekt via `oppgaveKatalog.refreshOppgaveKatalog` (`oppgave.hentForProsjekt`, HMS ekskludert). Lesing filtrerer på `userId` → en ny bruker på samme telefon ser aldri forrige brukers liste. `byggeplassId` er den utledede effektive byggeplassen (tre-ledds tegningsfilter → to-ledds «valgt ELLER løs»). Synkes aldri opp — utfylling bor i `oppgave_feltdata` |
| `hms_local` | id (server), projectId, **userId** (synlighetsvakt), kategori (avvik/sja/ruh), byggeplassId? (UTLEDET), + navn-kolonner lista viser | **Offline-katalog for HMS-lista** (read-only mirror, 2026-10-03). ÉN tabell for alle tre kategorier (serveren leverer dem i ett `hms.hentDokumenter`-kall). Full-overskrives per prosjekt via `hmsKatalog.refreshHmsKatalog`; lesing filtrerer på `userId`. 🔴 Bærer ALDRI `data`/signerte vedleggs-URL-er — kun visningsfelt. Synkes aldri opp |

## Kritisk logikk

### Synkroniseringsstrategi
- `erSynkronisert`-flagg sporer om lokal data matcher server
- Ved initialisering: SQLite leses først — **usynkronisert lokal data prioriteres over server**
- Konflikthåndtering: last-write-wins med `sistEndretLokalt`
- Nettverksovergang: auto-synk når nett kommer tilbake

### Migreringer (`migreringer.ts`)
- Idempotent `CREATE TABLE IF NOT EXISTS` — trygt å kjøre flere ganger
- Kjøres av `DatabaseProvider` ved app-oppstart, **blokkerer rendering**

### Opprydding (`opprydding.ts`)
- Fullførte køoppføringer slettes ved oppstart
- Foreldreløse lokale bilder (uten køoppføring) slettes i bakgrunn
- `ryddOppForProsjekt(sjekklisteIder, oppgaveIder)` — rydder feltdata + kø for avsluttede prosjekter

## Fallgruver

- `expo-file-system/legacy` MÅ brukes (IKKE `expo-file-system`) for `documentDirectory`
- Feltdata lagres som JSON-strenger — komplekse verdier (vedlegg, repeater-rader) krever forsiktig serialisering
- Køens `status = "laster_opp"` resettes til `"venter"` ved oppstart (krasj-recovery)
- Dual document types (sjekkliste/oppgave) deler mønster men har separate tabeller — endringer må gjøres i begge

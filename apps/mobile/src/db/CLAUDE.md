# Offline-sync — SQLite lokal database

## Oversikt

SQLite-laget (expo-sqlite + Drizzle ORM) er kjernen i offline-first-strategien. All data skrives lokalt først (<10ms), deretter synkroniseres til server.

## Tabeller

| Tabell | Nøkkelkolonner | Formål |
|--------|---------------|--------|
| `sjekkliste_feltdata` | sjekklisteId, feltVerdier (JSON), erSynkronisert, sistEndretLokalt | Lokal sjekkliste-utfylling |
| `oppgave_feltdata` | oppgaveId, feltVerdier (JSON), erSynkronisert, sistEndretLokalt | Lokal oppgave-utfylling |
| `opplastings_ko` | sjekklisteId?, oppgaveId?, objektId, vedleggId, lokalSti, status, forsok, serverUrl | Bakgrunnskø for filopplasting |

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

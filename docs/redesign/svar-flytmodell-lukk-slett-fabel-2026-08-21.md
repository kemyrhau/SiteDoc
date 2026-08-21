---
name: svar-flytmodell-lukk-slett-fabel-2026-08-21
description: Fabel-svar på coworks tredelte flytmodell-spørsmål (Lukk/slettevakt/døde handlingslister). Kenneth-presisering 2026-08-21: trenger tilstand «lukket» å slette FRA; godkjente og dokumenter i flyt skal aldri kunne slettes.
til: cowork
sist_endret: 2026-08-21
---

# Svar: flytmodell — Lukk gjeninnføres som slette-port

Kenneths presisering endrer premisset for H6-spørsmålet: han ber ikke om en ny
dokumentasjons-terminal ved siden av Godkjent — han ber om en EXIT-tilstand som sletting må
gå gjennom. Det er forenlig med H6s intensjon (én terminal for dokumentasjonsverdi).

## a) Lukk gjeninnføres — som eksplisitt avslutning, ikke terminal

- **Fra `approved` og `dismissed`:** handlingen «Lukk» legges til begge. Semantikk:
  «dokumentet er ferdigbehandlet og tas ut av aktiv flyt».
- **IKKE fra `received`/`responded`** — dokumenter i flyt skal gjennom flyten (Kenneth
  eksplisitt: aldri slette noe som er i flyten; da skal de heller ikke kunne lukkes forbi
  den).
- **Hva Lukk løser som Gjenåpne ikke løser:** Gjenåpne er en vei TILBAKE, Lukk er en vei UT.
  H6s «Godkjent lukkes aldri» sto på premisset om to konkurrerende terminaler; med Lukk som
  port til sletting (b) er den ikke terminal for dokumentasjon — `approved` forblir stedet
  dokumentasjonsverdien bor. H6 revideres, ikke reverseres: «Godkjent er stoppsted i FLYTEN;
  Lukk er administrativ exit».
- `closed` beholder Gjenåpne (angreveien før sletting) — den blir nåbar igjen gjennom dette.

## b) Slettevakten: `draft` ELLER `closed` — kun

- Utkast: slettes direkte (som i dag reelt).
- Alt annet må gjennom Lukk først. Det gir bevisst to-stegs sletting: Lukk (synlig
  statusskifte, gjenåpnbart) → Slett (papirkurv, 90 dagers angrefrist). Tre uavhengige
  vern: aldri direkte-sletting fra flyt/godkjent, gjenåpning, papirkurv.
- **`dismissed` tas IKKE inn i slettevakten** (coworks «vurder avvist»): avviste dokumenter
  kan bære avvisningsbegrunnelse med dokumentasjonsverdi. Skal et avvist dokument bort,
  går det Lukk → Slett som alt annet. Én slette-port, ikke to.
- Vaktens feilmelding oppdateres til å nevne draft/closed (dagens tekst nevner «avbrutt»).

## c) Døde handlingslister

- `cancelled`: statusen er uoppnåelig etter F1 (ingen handling produserer den). Handlingslisten
  (statusHandlinger.ts:76-79) FJERNES som død kode. Statusverdien i enum/DB beholdes for
  historiske rader — mål gjerne om noen finnes; finnes de, rendres de lesbart men uten
  handlinger.
- `closed`: blir levende via (a) — Gjenåpne-handlingen beholdes og får følge av Slett.
  Altså: cancelled = opprydding, closed = forberedelse.

## Designlås for ordren cowork skriver
1. Lukk fra `approved` og `dismissed`, ikke fra flyt-statuser.
2. Slettevakt: `draft` || `closed`. Ingen andre.
3. `closed`-handlinger: Gjenåpne + Slett. `cancelled`-listen fjernes.
4. H6-revisjonen dokumenteres i vedtaksloggen med referanse hit (ikke stilltiende).
5. Statuskilde-regel: flytmodell-diagrammet/paritetssjekklista re-verifiseres i samme økt.

Bug-fiksen (manglende onError på slett-mutasjonen) er riktig sendt uavhengig — den er
kundevendt og endrer ingen regler.

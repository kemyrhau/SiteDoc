# Flytmodell — implementeringsplan (cowork, faseinndelt)

**Grunnlag:** `flytmodell-veileder-cowork.md` (fabel, Kenneth-godkjent 31.07). **Fasit for oppførsel:** `Flytmodell Prototype.dc.html`. **Bygger på:** merget M1–M3 (UI-skallet står — kun tekstinnhold endres).

**Kjerne:** rutingen skal telle **ledd-posisjon**, aldri rollenavn/historikk. Status **avledes** fra fakta (posisjon/retning/terminal/sendt), skrives aldri direkte. Én delt utledning i `@sitedoc/shared` for server+web+mobil. Kvalitet fremfor tempo — rotårsaksfiks, ingen plaster.

## Faser (hver: nå-sjekk → gate → implementer → gate)

**Fase 0 — nå-sjekk (måling, ingen kode).** Kartlegg mot develop: (a) `dokumentflytMedlem`-schema — finnes `steg`/posisjon, type, er den populert? (b) de tre hardkodede rutingveiene eksakt (fil:linje + logikk): Besvar=`senderId` (`sjekkliste.ts~1117`/`oppgave.ts~1261`), Send/flytbytte hardkodet `erHovedansvarlig`+`utforer` (`~1006`/oppretting `~380`), Godkjenn/retur/lukk=`bestillerUserId` (`1241/1295/1349`, `oppgave 1387/1441/1495`). (c) hvor status skrives i dag (alle endepunkter). (d) `isValidStatusTransition`-bruk. (e) web `flyt-ledd.ts` + mobil `dokumentflyt-ledd.ts` gjeldende utledning. (f) `perspektivEtikett`-bruk. → Foreslå datamodell-form (posisjon + ansvarsmerke + rutings-klassifisering) + migreringsstrategi. **Gate: cowork + fabel (åpent pkt 3: ansvar→kontroll/Orienteres-klassifisering + ← / ↔-rettigheter).**

**Fase 1 — datamodell + migrering.** Populer reell rekkefølge (`posisjon`) + `ansvarsmerke` + rutings-klassifisering per `dokumentflytMedlem`. To-stegs migrasjonspolicy (nullable → backfill → NOT NULL senere). Backfill: kanonisk rollerekkefølge → posisjon; rolle → default merke/klassifisering (engangs). **ALDRI DROP — bevar data.** → gate (schema + migrering, Kenneth-OK kreves).

**Fase 2 — delt utledning + `avledStatus` i shared.** `nesteLedd()` / `forrigeKontrollLedd()` (hopper Orienteres) / `avledStatus(posisjon, retning, terminal, sendt)` i `@sitedoc/shared`. Terminal = åpent felt (ikke tilstandsmaskin). Delte enhetstester på retningsreglene (Orienteres-hopp, siste-ledd=Godkjenn-og-fullfør, gjenåpne-reglene 2.4). → gate.

**Fase 3 — server-omskriving.** Endepunkter skriver fakta (posisjon/retning/terminal), aldri status. Alle tre hardkodede rutingveier erstattes av den delte utledningen. `isValidStatusTransition` → retningsregler (hvem kan → ← ↔ fra hvert ledd, styrt av leddets ansvar). Status-enum beholdes som avledet cache (kun `avledStatus` skriver den). API-bakoverkompat (mobil kan ikke oppdatere umiddelbart). → gate.

**Fase 4 — web + mobil paritet.** `flyt-ledd.ts` + `dokumentflyt-ledd.ts` konsolideres mot shared-utledningen (fil-headeren forutsetter alt byttet). UI-tekst (bygger på M1–M3, ikke om igjen): flytlinje nummer+hvem, primær «Send til N · X →» / «Godkjenn og fullfør ✓», statuschip = avledet status. Mobil-paritet i SAMME runde (lærdom 30.07). → gate + Kenneth enhetstest.

**Fase 5 — tester + prototype-verifisering.** E2e for Kenneths 31.07-sekvens med **distinkte personer** per ledd. Verifiser de tre prototype-forhåndsvalgene (4 ledd / med Orienteres / bestiller sist) gir identisk logg. → sluttgate → merge-serie → prod.

## Åpne punkter (fra veileder § 5) — spores, løses i rett fase
- Ansvarsmerke-ordliste + oppsett-UI: modnes; klassifiseringen (kontroll/Orienteres) pinnes i Fase 0-gate (fabel).
- Orienteres-varslingsregler: Fase 3+ (varslingslag), ikke blokkerende.
- Rettighetsmatrise (hvilke ansvar gir ← / ↔): Fase 0-gate.
- F6-snarvei-forhold: vurderes Fase 3 (trolig overflødig i posisjonsmodellen).

## Sekvens mot andre spor (Kenneth 31.07)
Flytmodellen startes NÅ (Fase 0). Prod-deploy (develop→main: M1–M3 + effektivitet) gjøres ETTER at flytmodellen er startet. Videre mobil-enhetstest venter til flytmodellen er ferdig (test alt samlet).

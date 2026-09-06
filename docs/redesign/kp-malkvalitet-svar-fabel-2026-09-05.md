# Fabel-svar — fire funn fra malgjennomgangen (2026-09-05)

Svar på `docs/redesign/til-fabel/BESTILLING-malkvalitet-2026-09-05.md`. Alle fire besvart.
**Rev. 3 (samme dag) — erstatter 1430- og 1710-leveransene i sin helhet.**

## Kenneth-vedtak 05.09 (nytt, binder alle malordrer)

**Maler skal bruke objektene som finnes i MalBygger — ingen snarveier eller hardkoding for å
løse et problem. Forbedring av eksisterende malobjekters FUNKSJON er OK.** Konsekvenser ført
inn i C (Vei B = funksjonsforbedring av desimal-objektet, MalBygger-UI er del av leveransen)
og B (konvertering bruker eksisterende list_single).

## Tilbehør-verifisering (Kenneth-spørsmål: bilder / last opp fra galleri / +Oppgave)

Kodeverifisert (rev. 3 — rettet etter Kenneth-avvik; rev. 2 sa feilaktig «uavhengig av
felttype»): tilbehøret (kommentar + vedlegg + oppgave) rendres av `FeltWrapper.tsx` /
`FeltDokumentasjon.tsx`, men er **typestyrt** via `tilbehorVisning()`
(`RapportObjektRenderer.tsx:59-77`):
- `date`/`date_time`/`drawing_position`/`location`: INTET tilbehør i utfylling
  (`TILBEHOR_REN_FJERNING`, funn 6).
- `repeater`: tilbehør kun read-only når data finnes.
- `text_field`: kommentar skjult (verdien ER tekst).
- Øvrige typer — inkl. `traffic_light` og `list_single`: fullt tilbehør.
- Web-vedlegg er **«Last opp fra PC»** (bilder/pdf/doc — `FeltDokumentasjon.tsx:355`);
  kamera/galleri er mobilflaten. Riktig Kenneth-observasjon.
- Styringen er per felttype i kode — IKKE en per-objekt-egenskap i MalBygger. *Ikke målt:* om
  sidene gater «+ Oppgave» per felttype — cowork verifiserer før B-ordren låses.

Konsekvenser:
- **B:** trafikklys og list_single har identisk tilbehør — konverteringen mister ingenting.
- **A:** feltene rendres uendret (med sitt typestyrte tilbehør) inne i seksjonene; kollaps er
  print-trygg. Telleren gjelder KUN feltverdi — kommentar/vedlegg/oppgave påvirker ikke X av Y
  (et felt med bare foto teller som tomt; verdien er kontrollpunktet).
Kodeverifisert av fabel i dag mot lokal kopi: `useSjekklisteSkjema.ts`, `UtfyllingSeksjoner.tsx`,
`OverskriftObjekt.tsx`, `TrafikklysObjekt.tsx`, `DesimaltallObjekt.tsx`, `grenseSjekk.ts`,
`seed-bibliotek.ts`, bruksflater i web + mobil. Cowork-tall (34/29/20-fordelingen) er ikke
retalt — merket cowork-målt.

---

## Fakta-korreksjon til funn A — kollaps FINNES allerede

Bestillingen sier «kollaps krever at rendringen grupperer felt mellom heading-grenser» som om
det er ubygget. Det er bygget, i M-3a del 2 pkt 2:

- `apps/web/src/components/rapportobjekter/UtfyllingSeksjoner.tsx` — grupperer flat objektliste
  på rot-headings via `grupperMedOverskrift` (`@sitedoc/shared`), kollapsbar per seksjon,
  print-trygg (`hidden print:flex` — kollapset innhold mistes aldri i utskrift).
- I bruk på alle fire utfyllingsflater: web `sjekklister/[sjekklisteId]/page.tsx:931` og
  `oppgaver/[oppgaveId]/page.tsx:927`; mobil-speil `app/sjekkliste/[id].tsx:910` og
  `app/oppgave/[id].tsx:834`.

Kenneths ønske («overskrift minimerer underliggende felter») er altså levert. Det som mangler
er KUN det Kenneth gatet 05.09: **status på headeren**. Funn A krymper fra «bygg kollaps» til
«legg status på eksisterende header».

*Enkeltmålt:* fabel har lest koden i lokal kopi i dag; cowork bekrefter mot git at M-3a del 2
er merget/i prod før ordre bygger videre på den.

---

## A — vedtak: egen sak, IKKE delt komponent med velgerne

Svar på cowork-spørsmålet: dette hører ikke under «velger ved skala». Lån-dialogen (AM 4b) og
byggeplassvelgeren (BL) er **velgere** — skjult innhold er søkbart og harmløst. Utfylling er et
**skjema med ansvar for komplett dokument** — statusmodellen (telling, synlighet, ⚠) har ingen
mening i en velger. Regelen om delt kollaps-komponent gjelder fortsatt velgerne seg imellom;
`UtfyllingSeksjoner` er allerede sin egen delte komponent (web + mobil-speil) og forblir det.

### Design seksjonsstatus (Kenneth-gatet 05.09 — «status på headeren → ja»)

Header får høyrestilt status foran chevronen: `X av Y utfylt` + ikon.

- **Y** = synlige felt i seksjonen: `erSynlig()`-filtrert, display-typer ekskludert (samme
  `DISPLAY_TYPER`-sett som `valider()` bruker). Betinget skjulte felt teller ikke — en seksjon
  kan derfor endre Y mens man fyller ut; det er riktig, ikke en bug.
- **X** = felt med verdi, samme tomhetsdefinisjon som `valider()` (null/undefined/""/tom liste).
- **Ikon:** ✓ grønn når X = Y (og Y > 0) · kun tallet ved delvis · ⚠ amber når X = 0 (og Y > 0)
  — som Kenneths skisse. ⚠ reserveres for «helt urørt»; brukes den også på delvise, mister den
  kraft, og delvise seksjoner bærer allerede signalet i tallet.
- Status vises også i leseModus og print — den er dokumentinformasjon, ikke redigeringshjelp.
- Live-oppdatering (verdier og synlighet er allerede i minne på begge flater).
- **Ingen auto-kollaps** i denne leveransen (verken av ferdige eller ved åpning) — vurderes
  som egen sak etter bruk.

### Koderetning (cowork verifiserer)

Telle-logikken legges som delt hjelper i `@sitedoc/shared` ved siden av `grupperMedOverskrift`,
slik at web og mobil teller identisk. `UtfyllingSeksjoner` (begge apper) får en
`feltStatus(objekt)`-prop fra siden — sidene har allerede `erSynlig` + `hentFeltVerdi`.
Berørte flater: 2 web-sider + 2 mobil-sider + de to komponentene + shared-hjelper m/test.

Mockup ligger i designprosjektet (`Seksjonsstatus Mockup.dc.html`) — Kenneth ser den før ordre
skrives. Ordren blir liten; klikk-budsjett: 0 nye interaksjoner (status er passiv).

---

## B — vedtak: innholdet er primærfeilen, ikke komponentstørrelsen

Svar på det åpne spørsmålet: **trafikklys er feil verktøy for flertallet av de 34.** Regelen i
`kontrollplan.md` sier allerede list_single med informative valg — og coworks KB2-eksempler
viser gevinsten («Komprimeringsskade observert» dokumenterer; «rødt lys» gjør ikke).

- **Kriterium for malrevisjonen:** trafikklys beholdes kun der vurderingen er en ren
  tilstandsgradering uten navngivbare utfall. Kan utfallene navngis, skal feltet være
  `list_single`. Cowork/Opus går gjennom de 34 mot kriteriet; fabel gater lista før seed-endring.
- **UI-slanking tas likevel** (Kenneth 05.09, etter mockup: «lurer på om trafikklys enda er
  litt stor»): lysene krympes h-7 w-7 (28px) → 22px. Mockupen i designprosjektet viser 22px —
  Kenneth bekrefter størrelsen der før ordren låses. Liten endring, tas i samme ordre som
  malrevisjonen.

---

## C — vedtak: Vei B; Vei A avvises som mønster. Gated på kostnadsmåling

Enig i coworks anbefaling: betinget konfigurasjon løser en klasse (fall per arealtype, planhet
per belegningstype, komprimering per masse). **Vei A avvises også som midlertidig KB2-fiks** —
åtte håndvedlikeholdte varianter skaper mal-data som senere må migreres bort.

### Designpremisser som låses før ordre (designlås-blokk når ordren skrives)

1. **Konfig-form:** barnets config får grense-varianter nøklet på forelderens verdi; hver
   variant har samme struktur som `normaliserGrense` leser i dag (min/maks/toleranse/enhet/
   desimaler). Ingen match → feltets egne grenser som fallback.
2. **Én delt resolver** i `@sitedoc/shared` ved siden av `normaliserGrense`: gitt (objekt,
   forelder-verdi) → gjeldende `Grense`. Brukes av web, mobil OG `packages/pdf` — Kenneth-krav
   21.08: PDF-motoren er delt.
3. **PDF viser kravet som gjaldt:** rekonstrueres fra lagret forelder-verdi + malens varianter
   via samme resolver — ingen ny lagring per svar. *Forbehold (enkeltmålt):* malendring etter
   utfylling kan endre rekonstruksjonen; cowork vurderer om grensen skal snapshotes ved
   innsending/lås.
4. **Semantikk beholdes:** grenser er veiledende (amber-varsel), ikke blokkerende. Målt i dag:
   `valider()` sjekker kun required/tomhet; `grenseStatus` styrer bare visning. Vei B endrer
   ikke dette.
5. **MalBygger-UI for varianter er DEL av Vei B-leveransen** (Kenneth-vedtak 05.09: maler
   bruker MalBygger-objektene, ingen seed-only hardkoding). Kan fases internt i ordren, men
   ordren lukkes ikke før variantene kan redigeres i MalBygger. UI-designet er egen
   fabel-designsak før byggeordre.

### Bestilling til cowork

Kostnadsmåling/nå-rapport FØR ordre: skjema-hooks (web + mobil), `grenseSjekk`-kjeden,
PDF-stiene som viser grensetekst, MalBygger-flatene som redigerer grenser. C går ikke inn i
køen før målingen foreligger.

---

## D — vedtak: «AI-utkast» ut av kundetekst; `verifisert` tas i bruk

Svar på relay-forbeholdet («ikke ta kolonnen i bruk uten fabel»): **ja, nå tas den i bruk.**

1. «(AI-utkast)» fjernes fra alle 12 `beskrivelse`-tekster — status hører aldri i kundesynlig
   fritekst.
2. Seed setter `verifisert: false` eksplisitt; api eksponerer; web leser.
3. **Uverifisert mal KAN lånes** — biblioteket er ellers tomt, og fagkontrollen virker (Kenneths
   KB2-gjennomgang). Visning: amber badge **«Utkast — ikke fagverifisert»** på malkortet i
   lån-dialogen og i mallisten. Badge, ikke sperre.
4. **Prod-gate:** uverifiserte maler seedes ikke i prod (i dag 0 der — det holdes slik til
   verifisering er registrert).
5. Verifiserings-handling: admin-handling «Merk verifisert mot NS 3420». *Foreslått, finnes
   ikke:* kolonnen er bool; hvem/når bør spores — cowork vurderer `verifisertAv`/`verifisertDato`
   i samme migrering.
6. **Dok-sync (kan gå straks, egen linje):** `kontrollplan.md` oppdateres med NS 3420-F;
   F-malene seedes i test-DB. Tas i samme runde som seed-fila uansett røres (pkt 1+2).

---

## Kø-plassering

Rekkefølgen LP → EX → AG → BL står. Inn i mellomrommene:

1. **A (seksjonsstatus)** — liten, Kenneth-gatet; ordre etter Kenneths blikk på mockupen.
2. **B + D som ÉN malrevisjonsordre** — samme fil (`seed-bibliotek.ts`) røres: trafikklys→
   list_single-konvertering, «(AI-utkast)» ut, `verifisert: false` inn, F-seed + kontrollplan.md-
   sync. Badge-UI (D3) er egen liten web-sak i samme ordre.
3. **C** — køes når coworks kostnadsmåling foreligger.

Alle ordrer relayes via Kenneth som vanlig; cowork eier merge-timing.

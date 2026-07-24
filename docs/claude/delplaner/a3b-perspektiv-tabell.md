---
name: a3b-perspektiv-tabell
status: 🟢 § 8 + § 9 IMPLEMENTERT 2026-07-24 (fabel-gate [a3b-gate-2026-07-24.md](a3b-gate-2026-07-24.md)) — `feat/a3b-perspektiv` rebaset på develop, Del 1a-revisjon (`perspektivEtikett.ts`: erAdmin→D, registrator→deltaker, rejected perspektiv-farge) + Del 1c/1d/2 kodet, `next build` grønn. Venter fabel-gate + Kenneths klikktest. Fase A-tabellen låst 2026-07-20
eier: cowork (nå-rapport + gate) · fabel (design) · a3b-opus (ledd 3, kode)
sist_verifisert_mot_kode: 2026-07-24
---

# A-3b Fase A — perspektiv-tabellen (status × perspektiv → etikett + farge)

Leveranse for [A3b-ordre.md](A3b-ordre.md) § 2 Del 1a. **Ikke kode** — designgate-artefakt. Fase B (koding) starter ikke før fabel har godkjent tabellen **og** spor 2 er merget (begge rører `packages/shared`).

## Kode-premisser (målt mot hovedtreet)

- `packages/ui/src/status-badge.tsx:19` — Badge har nøyaktig de fem variantene tabellen bruker: `default | primary | success | warning | danger`.
- `packages/shared/src/utils/flytRolle.ts:123` `beregnHarBallen` — draft→bestiller, ellers `recipientUserId` / `recipientGroupId`. Gir «har ballen»-signalet.
- `packages/shared/src/utils/statusHandlinger.ts:125` `ROLLE_HANDLINGER` — kilden til hvem som «venter» vs. «handler» per status.
- `packages/db/.../sjekkliste.ts:923` — `sent→received` konverteres ubetinget. **Røres ikke.**
- 9 lagrede statuser + fire dokumenttyper: `dokumentflyt.md` § 6 / § 2.

## To ting løftet UT av denne tabellen (cowork-funn 2026-07-20)

1. **«Lest» er fjernet.** Cowork målte den som død kode i begge retninger: status persisteres aldri som `sent` (auto-mottak konverterer), så `lestAvMottakerVed` er alltid NULL og badge-grenen (`status === "sent" && lestAvMottakerVed != null`) har aldri fyrt. Å vekke den er **lesekvittering** — en ny funksjon med personvern-side (~50 ansatte; arbeidsgiver ser når den enkelte åpnet et dokument) + skrive-side + badge-vilkårsbytte. **Egen sak, krever Kenneth-vedtak.** Ikke del av A-3b. `received`/avsender er derfor bare «Til behandling · primary» — ingen `→ Lest`-overgang.
2. ~~**`rejected`-fargeskiftet er ikke perspektiv-avhengig.**~~ **FORELDET (§ 9-konsolidering 2026-07-24).** Da A-laget ga avsender (registrator/bestiller) «Send på nytt» på `rejected`, ble fargen perspektiv-avhengig som enhver annen aktiv status: warning til ballinnehaveren, primary til den som venter (se § 3 rejected-rad + fotnote ¹). Det finnes derfor **ingen egen ikke-perspektiv-avhengig baseline-endring** — ordrens **§ 2b er konsumert av § 9**. (Testplanen skal fortsatt verifisere at en faggruppe-bundet bruker uten seer-kontekst ser en fornuftig `rejected`-farge — hun faller til D/nøytral = «Til revisjon · primary».)

---

## 1. Fargegrammatikk (5 Badge-varianter, uendret palett)

Fargen betyr det samme uansett status — etiketten bærer meningen:

| Variant | Betydning | Når |
|---|---|---|
| `warning` (amber) | **Din tur** — ballen ligger hos deg, krever handling | `harBallen = true`, aktiv status |
| `primary` (blå) | **Underveis** — ballen hos andre, du venter | avsenderskap/venter, ballen ikke hos meg |
| `success` (grønn) | **Fullført positivt** | approved, closed (godkjent-vei), HMS-retur |
| `danger` (rød) | **Avbrutt / negativ terminal** | cancelled, deleted |
| `default` (grå) | **Hvilende / nøytral** | kladd (egen, usendt), lukket |

Kjernegrepet mot i dag: `received` og `in_progress` er `primary`/`warning` **globalt** nå — de blir perspektiv-avhengige (amber til den med ballen, blå til den som venter).

## 2. Perspektiver (seer-kontekst → felt)

| # | Perspektiv | seer-kontekst |
|---|---|---|
| A | **Avsender / venter** — jeg sendte forrige ledd, eller er bestiller som venter | `harBallen=false` + avsenderskap/tidligere ledd |
| B | **Mottaker / Utfører** — dokumentet er på mitt bord | `harBallen=true`, rolle=utforer |
| C | **Godkjenner** — venter på min godkjenning | `harBallen=true`, rolle=godkjenner (kun `responded`) |
| D | **Admin / nøytral** — global sannhet | `erAdmin` (ubetinget) |

**§ 8-revisjon (fabel-gate 2026-07-24):** D nås nå **kun av `erAdmin`** (globalt tilsyn), ikke av registrator-rollen. En **registrator er en ordinær avsender-part** — hun flyter A (uten ball, avsender/venter), B/C (ballinnehav/rolle), fordi en matchet registrator per Kenneths definisjon er den som opprettet + sendte. En som ikke er part i dokumentet får `rolle=null` fra `utledMinRolle` (ikke «registrator») og følger samme ball-baserte utledning. Koden: `utledPerspektiv` = `erAdmin → noeytral; ellers harBallen ? aktiv : venter` (`perspektivEtikett.ts`).

**Fallback:** udefinerte (perspektiv, status)-celler faller tilbake til **kolonne D** (nøytral sannhet) i mapping-laget. Ingen mister informasjon; perspektiv-splittene A/B/C er additive overlegg over D.

## 3. Base-matrise — Sjekkliste · Oppgave · Godkjenning

Deler rolle-vokabular. `—` = perspektivet finnes ikke i statusen.

| Lagret status | A · Avsender/venter (inkl. registrator) | B · Mottaker/Utfører | C · Godkjenner | D · Admin/nøytral |
|---|---|---|---|---|
| `draft` | — | **Utkast** · default | — | **Utkast** · default |
| `received` *(sent→received)* | **Til behandling** · primary | **Til behandling** · warning | — | **Mottatt** · primary |
| `in_progress` | **Under arbeid** · primary | **Under arbeid** · warning | — | **Pågår** · primary |
| `responded` | **Besvart – til godkjenning** · primary | — | **Til godkjenning** · warning | **Besvart** · primary |
| `approved` | **Godkjent** · success | **Godkjent** · success | **Godkjent** · success | **Godkjent** · success |
| `rejected` ¹ | **Til utbedring** · warning | **Til utbedring** · warning | **Til revisjon** · primary | **Til revisjon** · primary |
| `closed` | **Lukket** · default | **Lukket** · default | **Lukket** · default | **Lukket** · default |
| `cancelled` | **Avbrutt** · danger | **Avbrutt** · danger | — | **Avbrutt** · danger |

¹ **`rejected` følger nå den vanlige fargegrammatikken (§ 1) — også fargen er perspektiv-avhengig.** § 9-konsolidering (fabel-gate 2026-07-24): A-laget ga avsender (registrator/bestiller) «Send på nytt» på `rejected`, så ballinnehaveren — avsender-som-utbedrer (A) *eller* utfører (B) — får **warning** («din tur»), mens den som sendte tilbake (C, godkjenner) og nøytral D venter → **primary**. Nøyaktig samme mønster som `received`/`in_progress`. Den gamle § 2b-endringen (global `danger`→ny farge for alle) er dermed **konsumert av § 9** — det finnes ingen egen ikke-perspektiv-avhengig baseline-endring lenger.

Merknader:
- **`received`** er N1-kjernen: samme lagrede rad, ulik etikett per seer. Avsender ser dokumentets *sanne* tilstand («Til behandling»), aldri sin gamle «Sendt»-handling. «Sendt» lever kun som kvittering-øyeblikk (§ 6).
- **`approved`** er `success` for alle. Bestiller har teknisk ballen (kan `closed`), men det er en positiv hviletilstand; lukke-handlingen bor i handlingsmenyen, ikke i badge-fargen. *(Se åpent spørsmål 1.)*

## 4. Type-deltaer

**Oppgave:** append-only, samme etiketter. Anbefaling: behold felles «Besvart» for `responded` — konsistens veier tyngre enn nyanse, og vedtak 2 rører kun `rejected`.

**Sjekkliste:** «Til utbedring» på `rejected/utfører` passer avvikslogikken — allerede i base.

**Godkjenning:** enveis, ingen kryss-faggruppe, men rolle-settet er identisk → base gjelder uendret.

## 5. HMS-matrise

Perspektivene omdøpes: Avsender = **Innsender**, Mottaker + Godkjenner = **HMS-gruppe** (enveis med auto-retur; HMS-gruppen behandler og godkjenner i ett).

| Lagret status | Innsender | HMS-gruppe | Registrator |
|---|---|---|---|
| `draft` | **Utkast** · default | — | **Utkast** · default |
| `received` | **Til behandling hos HMS** · primary | **Til behandling** · warning | **Mottatt** · primary |
| `in_progress` | **Under behandling** · primary | **Under behandling** · warning | **Pågår** · primary |
| `approved` *(auto-retur)* | **Godkjent – returnert** · success | **Godkjent** · success | **Godkjent** · success |
| `rejected` ¹ | **Til utbedring** · warning | **Til revisjon** · primary | **Til revisjon** · primary |
| `cancelled` | **Avbrutt** · danger | **Avbrutt** · danger | **Avbrutt** · danger |

¹ Speiler base-matrisen (§ 9-konsolidering): innsender får ballen tilbake for utbedring → **warning** («din tur»); HMS-gruppen sendte tilbake og venter → **primary**; nøytral D → **primary**. HMS har ingen egen `responded/godkjenner`-node — retursteget til innsender er automatisk (§ 2), **men koden har ingen egen HMS-retur-gren i dag: dette MÅLES og flagges i Fase B, det fylles ikke på eget initiativ** (fabel-svar 3 + § 7). *(Se åpent spørsmål 3.)*

## 6. Kvitterings-øyeblikket (Del 1b — overlay, IKKE lagret tilstand)

Momentan kvittering rett etter egen handling (toast/optimistisk badge), erstattes av sann tilstand ved neste visning:

| Handling | Momentan kvittering | Farge | Neste visning viser |
|---|---|---|---|
| Send | **Sendt ✓** | primary | Til behandling |
| Besvar | **Besvart ✓** | primary | Til godkjenning |
| Godkjenn | **Godkjent ✓** | success | Godkjent |
| Send tilbake / Avvis | **Sendt tilbake ✓** | warning | Til revisjon |
| Videresend | **Videresendt ✓** | primary | Til behandling hos [ny mottaker] |
| Trekk tilbake *(pkt 7 — FLAGGET, bygges ikke uten Kenneth-vedtak)* | **Trukket tilbake ✓** | default | Utkast |

## 7. Designspørsmål — BESVART (fabel 2026-07-20, relayet av Kenneth)

Alle tre anbefalinger **godkjent som anbefalt**. Fase A er dermed lukket.

| # | Spørsmål | Fabel-vedtak |
|---|---|---|
| 1 | `approved`-farge for bestiller | ✅ **`success`** — hviletilstand. Badgen sier tilstand, ikke valgfri opprydding. Lukke-handlingen bor i handlingsmenyen |
| 2 | `received`/avsender-ordlyd | ✅ **«Til behandling»** — «hvem har ballen»-chippen (Del 1c) navngir mottakeren separat |
| 3 | HMS `rejected`-retur til innsender | ✅ **Bekreftet som modell.** Men koden har **ingen egen HMS-retur-gren i dag** — dette er en **påstand som skal verifiseres i Fase B**, ikke et bekreftet kodefaktum |

**Ufravikelig på pkt 3:** finner Fase B at retursteget ikke finnes i koden, er det et **funn som flagges** — ikke et hull som fylles på eget initiativ. Enveis-modellen tilsier retur, men avstanden mellom modell og kode skal måles og rapporteres før noen bygger den.

Egen korreksjon ført samtidig: `rejected` → **«Sendt tilbake ✓» / «Til revisjon»** (§ 6), og «Kladd» → **«Utkast»** gjennomgående (terminologi).

## 8. NÅ-RAPPORT — REGISTRATOR-kolonnen revideres etter registrator-fiksen (cowork-måling 2026-07-23)

Per fabel-c-vedtaket: registrator-fiksen har landet (live på prod, `cb3ce3d1`), så perspektivmatrisen leveres på nytt mot **ny semantikk** — fabel gater FØR 1c-wiring gjenopptas.

**Målt semantikk-endring (develop/prod, post-fiks):**
- `flytRolle.ts`: admin → `"registrator"`-rolle beholdt, men **admin-makten kommer nå fra `erAdmin`-flagget, ikke rollen**. `ROLLE_PRIORITET.registrator = 1` (lavest — «en oppretter/leser skal ikke slå en skrive-rolle»).
- `statusHandlinger.ts`: `ROLLE_HANDLINGER.registrator = { draft: {sent, deleted} }` — registrator **oppretter + sender sin egen del**, deretter leser status. Ikke global makt.
- Kenneths definisjon: registrator «oppretter oppgave/sjekkliste, sender den videre, ser om mottaker har besvart» = nøyaktig **Avsender-perspektivet (Kolonne A)**.

**Konsekvensen for tabellen:** Kolonne D («Registrator / Admin — nøytral global sannhet», `erAdmin | rolle=registrator`) og `perspektivEtikett.ts` («Registrator/admin ser alltid nøytral sannhet») er bygget på **gammel superbruker-semantikk**. En registrator som opprettet + sendte et dokument er **avsender** — hun skal se «Til behandling» (Kolonne A: avsenderskap/venter), ikke den nøytrale D-en. Å kollapse registrator til D **skjuler avsenderskapet hennes**.

**Foreslått revisjon (fabel gater):**
- **Admin** beholder Kolonne D («nøytral global sannhet») — admin har globalt tilsyn, ikke flyt-deltaker. Kun `erAdmin` → D ubetinget.
- **Registrator (ikke-admin)** utleder perspektiv fra ballinnehav/avsenderskap som andre deltakere: **A** (avsender/venter) når hun opprettet+sendte, B/C hvis hun holder utforer/godkjenner-rolle, og **D (nøytral leser) kun som fallback** når hun leser et dokument hun ikke er part i (leserett uten avsenderskap/ball).
- Dvs. **registrator er ikke lenger en egen perspektiv-kolonne** — hun flyter gjennom A/B/C med D som leser-fallback. Perspektiv-tabellens rader er uendret; det er **utledningen til kolonne** som endres.

**Kode-konsekvens (etter fabel-gate):** `perspektivEtikett.ts` (a3b-branch, Del 1a): `Perspektiv`-typen + utledningen endres fra «registrator|admin → nøytral» til «erAdmin → nøytral; registrator → deltaker-utledning med nøytral-fallback». `perspektivEtikett.test.ts` frosne rader oppdateres. Del 1c-wiring gjenopptas etter gaten.

## 9. NÅ-RAPPORT komplettering — A-laget endrer `rejected`-raden (cowork-måling 2026-07-24)

§ 8 fanget registrator-fiksen, men **siden landet A-laget (`7571e968`) + hele flyt-fundamentet (Kloss 1→2d)**. Én transisjon påvirker perspektiv-tabellen direkte. Målt mot develop (`ROLLE_HANDLINGER_DEFAULTS` + `validTransitions`):

**`rejected` — hvem har ballen nå:**
- **registrator:** `rejected → {sent}` (Send på nytt) — **NY (A-laget)**
- **bestiller:** `rejected → {sent}` (Send på nytt) — **NY (A-laget)**
- **utforer:** `rejected → {in_progress, forwarded}` (gjenoppta/videresend)
- **godkjenner:** ingen (sendte tilbake, venter)

**Konsekvens for `rejected`-raden (base-matrise § 3):** dagens rad har A(avsender) = «—». **Utdatert** — registrator/bestiller (avsender) kan nå Send på nytt → de har ballen → «din tur» (warning), ikke fravær. Foreslått revidert rad (fabel gater):

| `rejected` | A · Avsender (registrator/bestiller) | B · Utfører | C · Godkjenner (sendte tilbake) | D · Registrator-leser/Admin |
|---|---|---|---|---|
| **Ny** | **Til utbedring** · warning (din tur — kan sende på nytt) | **Til utbedring** · warning (kan gjenoppta) | **Til revisjon** · primary (venter) | **Til revisjon** · primary (nøytral) |
| *(var)* | *«—»* | *Til utbedring* | *Til revisjon* | *Til revisjon* |

**`closed → draft`:** `validTransitions` har den, men den er **INERT** (ingen menyhandling ennå — 2b-matrisen kan slå den på). `closed`-raden står uendret («Lukket» · default) inntil gjenåpne-handlingen bygges.

**adminNiva (Kloss 2):** perspektiv-D-kolonnen bruker `erAdmin`, som er **uendret** av Kloss 2 (adminNiva er containet til flyt-rettighets-funksjonene). § 8-revisjonen (erAdmin → D; registrator → deltaker) står. Verifiseres i Fase B mot `perspektivEtikett.ts`.

**Til fabel-gate:** § 8 (registrator-kolonne) + § 9 (`rejected`-rad) = den komplette nå-rapporten mot post-fundament-semantikk. **Fabel gater begge FØR** Del 1a-revisjon + Del 1c-wiring. A-3b-Opus må dessuten re-base `feat/a3b-perspektiv` (`535f8d8a`, 3+ commits bak) på develop før koding.

### ✅ FABEL-GATE (2026-07-24) — § 8 + § 9 godkjent som foreslått + konsolidering

- **§ 8:** `erAdmin → D` ubetinget; registrator flyter A/B/C med D kun som leser-fallback.
- **§ 9:** A/B «Til utbedring · warning», C/D «Til revisjon · primary»; closed-raden uendret (inert transisjon får IKKE badge).
- **🔴 Konsolidering Opus tar i Del 1a-revisjonen:** § 9 gjør `rejected`-**fargen perspektiv-avhengig** — samme grammatikk som `received`/`in_progress` (warning til den med ballen, primary til den som venter). Dermed:
  - **Fotnote ¹** (base § 3 + HMS § 5: «fargen er IKKE perspektiv-avhengig, § 2b global») er **foreldet → strykes/omskrives.**
  - **Ordrens § 2b-punkt** (global `rejected`-fargeendring) er **konsumert av § 9** — ingen separat global baseline-endring lenger; fargen følger perspektiv.
  - **HMS-matrisen (§ 5) synkes:** Innsender = warning (din tur), HMS-gruppe = primary (venter) på `rejected`.
- **Ufravikelige står:** HMS-retur-grenen **måles og flagges** (fylles ikke på eget initiativ), `sent→received` (`sjekkliste.ts:923`) røres ikke, lesekvittering («Lest») er egen sak, pkt 7 «Trekk tilbake» bygges ikke uten Kenneth-vedtak.

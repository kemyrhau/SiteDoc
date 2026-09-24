---
status: 🟢 ORDRE — klar. 🔴 REVIDERT 2026-09-24: del E avgjort (15 min) og del G tilføyd. Ingen åpne beslutninger
til: kode-agent (worktree og branch bestemmes av cowork)
fra: design
dato: 2026-09-24
grunnlag: dokgens steg-0-måling 2026-09-24 · sikkerhet.md § /uploads/ (fire funn) · S1 Fase 1b (`vedleggSignering.ts`, 2026-08-12)
kenneth_krav: 2026-09-24 — «vi må sjekke om den som henter ut bilder og mere er innlogget. ikke bare sjekke ved pålogging»
---

# Ordre: signaturgate på hele `/uploads/` — fullfør S1 Fase 1b

## [1] HVA SOM ER GJORT — og hvorfor dette IKKE er en retrofit

> **Kenneth 2026-09-24:** *«husk å ivareta sikkerhet. vi må sjekke om den som henter ut bilder og mere er
> innlogget. ikke bare sjekke ved pålogging»*

🔴 **Kravet er ikke oppfylt.** Koden sier det selv — `server.ts:113`:
«`/uploads/*` er uendret i Fase 1 (**global gate kommer i Fase 1b**).»

| Sti | Beskyttelse i dag | Målt |
|---|---|---|
| `/uploads/privat/*` | 🟢 HMAC, 15 min, signatur-KUN, herdet mot sti-traversering | `server.ts:110-125`, `hmac.test.ts` |
| `/uploads/*` for øvrig | 🔴 **INGEN.** `fastifyStatic` serverer rått | `server.ts:127-131` |

### 🟢 Og det avgjørende: sømmen for denne migreringen er ALLEREDE lagt

**`vedleggSignering.ts:15-17` (S1 Fase 1b, 2026-08-12), ordrett:**

> «Rekursjonen speiler tellings-SQL-ens `$.**.url`: ethvert `url`-strengfelt på et hvilket som helst nivå
> signeres via `signerHvisPrivat` (som er en **no-op for alt utenfor `/uploads/privat/`**, så åpne URL-er **før
> migreringen** berøres ikke).»

🔴 **«Før migreringen» er denne migreringen.** Dypgåeren over nestede `data`-strukturer finnes, er testet, og
er skrevet for å bli utvidet. **Dette er å fullføre en planlagt fase, ikke å ettermontere.**

### 🔴 Og opt-in-mønsteret har alt sviktet i produksjon

`apps/mobile/.../FeltDokumentasjon.tsx:191` bærer kommentaren
«åpen `/uploads/`-sti (**S1-hull, funnet ved prod-opprydding 2026-08-15**)».

⚠️ **Det er målt, ikke antatt: et mønster som må huskes, ER glemt — tre dager etter at det ble innført.**
🔴 **Derfor skal gaten være default-deny på serveren, ikke opt-in signering på kallstedene.**

### Dokgens steg-0-måling

| Flate | Antall | Form |
|---|---|---|
| api MED signering | 38 kall / 9 filer | No-op for offentlige filer i dag |
| api UTEN signering | **≥7 rutefiler** — `mappe`, `mengde`, `punktsky`, `overflate`, `tegning`, `upload`, `ftdSok` | ⚠️ **grov proxy** |
| web | 50 linjer / 29 filer | `/api${fileUrl}` inline, ingen hjelper |
| mobil | 11 filer | inline base-URL + `utils/signerteUrler.ts` (kun `privat/`) |
| `packages/pdf` | 1 hjelper (`hjelpere.ts:334`) | server-side, leser fra disk |

⚠️ **Dokgen markerte forbeholdet selv, og det står:** «returnerer `fileUrl`» er ikke det samme som «returnerer
den USIGNERT til klient». **De 7 skal bekreftes per fil, ikke antas.**

🟢 **Og mobil lagrer IKKE `fileUrl` i SQLite** — målt, `apps/mobile/src/db` har null treff. **Offline-kravet er
derfor ikke i konflikt med signaturer i lagret data.**

**BACKLOG-grep (steg 0):** `/uploads/` er dekket av [sikkerhet.md](../claude/sikkerhet.md) som **fire funn**.
🔴 **Denne ordren skal PEKE dit, ikke opprette en ny post.**

## [2] HVA SOM GJENSTÅR

Gjør signering **default-på ved emisjon** og **påkrevd ved konsum**, uten å røre de 61 inline-URL-byggingene i
web og mobil. 🟢 **Signaturen rir i URL-en, så `<img src>` og `<Image uri>` virker uendret.**

## [3] OPPGAVE

### 🔴 A. Generaliser `signerHvisPrivat` — ÉN funksjon, 38 kallsteder arver det

`apps/api/src/utils/hmac.ts:65`. **Utvid fra `/uploads/privat/` til hele `/uploads/`.**

🟢 **Dette er den billigste og mest virksomme endringen i hele ordren:** de 38 kallene og
`signerVedleggIData`s dypgåer **delegerer alle hit**. Én funksjon endres; hele Fase 1b-maskineriet følger.

🔴 **Idempotens er et KRAV:** bærer URL-en alt `sig=`, returnér den uendret. **Uten det dobbeltsigneres
alt som går gjennom to lag.**

### 🔴 B. Default-deny-gate i `server.ts`

`vurderPrivatFilForesporsel` (`hmac.ts:165`) dekker `privat/`. **Utvid til hele `/uploads/`.**

- **Ugyldig, utløpt eller manglende signatur → 401.** Ingen sesjons-fallback (samme modell som `privat/`).
- 🔴 **Gjenbruk `normaliserFilSti`** — sti-traverserings-herdingen fra hastefiksen 2026-08-11 skal gjelde hele
  treet, ikke bare `privat/`. ⚠️ **`/uploads/./x`, `/uploads//x` og `/uploads/a/../x` slapp forbi gaten sist.**
- **Behold `Cache-Control: no-store` kun for `privat/`.** Offentlige filer kan caches innenfor signaturens
  levetid.

### 🔴 C. De ≥7 rutene uten emisjonssignering

🔴 **Bekreft per fil FØR du fikser** — dokgens tall er en proxy. **Skriv i rapporten hvilke som faktisk
returnerte usignert, og hvilke som var falske treff.**

**For de som er ekte:** signer ved emisjon. 🟡 **Vurder om en sentral tRPC-output-middleware er renere enn
7 punktvise kall** — den ville gjort mekanismen ubøyelig for framtidige ruter.
⚠️ **Velger du middleware: den skal treffe OUTPUT, aldri input, og kun strenger som matcher `/uploads/`-mønsteret
strengt.** Meld valget med begrunnelse.

### 🔴 D. To invarianter som IKKE må brytes — begge er navngitt i koden

**D1 — «forgiftet URL».** `vedleggSignering.ts:10-13`: en signert URL som havner i DB er **forgiftet
permanent**. Signering skjer ved emisjon, i en **dyp kopi**; originalen muteres aldri.
🔴 **Utvider du signeringen til offentlige URL-er, utvider du også denne faren.** Mutasjoner som returnerer en
rad klienten skriver tilbake, er den farlige veien.

**D2 — `bilde.slettMedUrl` gjør EKSAKT STRENGMATCH** (`vedleggSignering.ts:13`). **En signert URL dit knekker
sletting.**

🔴 **Krav: én test pr. invariant, og begge skal FEILE hvis vernet fjernes.**
- D1: en mutasjonsoutput som klienten persisterer skal ikke bære `sig=`.
- D2: `slettMedUrl` skal virke med en URL som har passert emisjonssignering.

### 🟢 E. Signaturens levetid — AVGJORT 2026-09-24: 15 minutter for ALT

> **Kenneth 2026-09-24:** valgte selvfornyelse framfor lang levetid — *«gå for denne med din anbefaling»*.

**`privat/` beholder 15 min. Øvrige `/uploads/` får OGSÅ 15 min.** 🔴 **Det er bare forsvarlig fordi del G
gjør en utløpt signatur usynlig.**

⚠️ **E og G hører sammen.** Bygges G ikke, skal E være **24 timer** — ellers får brukeren tomme bilderammer
hver gang en fane står åpen over lunsj. **Leveres G delvis, settes 24 timer for de flatene G ikke dekker.**

### 🟡 F. Filnavn + RFC 5987 — EGEN sak, ikke denne ordren

**UUID-filnavnene løses IKKE av gaten.** `setHeaders(res, path)` har bare disk-stien; det ekte navnet ligger i
DB. **Det krever en nedlastingsrute som slår opp navnet og setter
`Content-Disposition: attachment; filename*=UTF-8''…`.**

🔴 **Holdt utenfor med vilje.** Gaten er sikkerhet, filnavnet er brukskvalitet. **Blandes de, blir en
sikkerhetsfiks forsinket av en kosmetisk.** Egen ordre når denne er merget.

### 🔴 G. Selvfornyelse — TILFØYD 2026-09-24. Formen er viktigere enn mekanismen

**Kenneth valgte dette framfor lang levetid.** En utløpt signatur blir da et blunk i stedet for en tom ramme.

🔴 **Men IKKE som `onError` på 50 steder. Det er nøyaktig opt-in-mønsteret som sviktet 15.08.**
Målt 2026-09-24: **ingen delt bildekomponent finnes** — `packages/ui` har 15 komponenter, ingen for bilde;
`BildeLightbox.tsx` er en lightbox. **Den skal lages.**

#### G1 — én komponent pr. plattform, delt REGEL

- `apps/web/src/components/SignertBilde.tsx` — wrapper `<img>`
- mobil-ekvivalent — wrapper `<Image>`
- 🔴 **Delt gjenforsøks-policy i `packages/shared`** (debounce-vindu, maks forsøk). **Web og mobil kan ikke dele
  komponent** (`<img>` vs RN `<Image>`), **men de skal dele regelen** — ellers drifter de fra hverandre, og da
  har vi to oppførsler ingen har bestemt.

#### G2 — 🔴 ORDRENS VIKTIGSTE DESIGNVALG: debouncet invalidering, IKKE en signeringsprosedyre

En `fil.signer({ sti })`-prosedyre ville vært enklere for komponenten. **Ikke bygg den.**

🔴 **Begrunnelsen er sikkerhet:** en slik prosedyre må autorisere stien. Gjør den ikke det, er den et orakel som
gjør «er innlogget + kjenner en sti» til «får fila» — **og da har vi gjenåpnet hullet for enhver innlogget
bruker i et annet firma.** ⚠️ **En sti-basert signeringsprosedyre uten autorisasjonssjekk er en
kryssfirma-lekkasje, ikke en bekvemmelighet.**

🟢 **Riktig vei: `onError` → debouncet invalidering av tRPC-queriene → serveren re-emitterer signerte URL-er
gjennom veien som ALT er autorisert.** Ingen ny prosedyre, ingen ny autorisasjonsflate.

- **Debounce:** en side full av utløpte bilder skal utløse **én** invalidering, ikke femti.
- **Maks ett gjenforsøk pr. bilde.** 🔴 **Feiler det igjen: vis en tydelig tilstand. Aldri en løkke mot 401.**
- ⚠️ **Skill 401 fra 404.** En slettet fil skal ikke utløse evige gjenforsøk — det ville gjort en manglende fil
  til et selvpåført DoS.

#### G3 — gjør feilklassen ulovlig (lag 1 i kvalitetssikring-plan)

🔴 **Dette er delen som hindrer at hullet gjenoppstår, og den er ikke valgfri.**

**En lint-regel som FEILER på en rå `/uploads/`-sti i `src`/`uri` i JSX.**
[kvalitetssikring-plan.md](../claude/kvalitetssikring-plan.md) lag 1 er «gjør feilklassen ulovlig (lint)» —
**dette er presis tilfellet den ble skrevet for.**

⚠️ **Uten G3 vokser de 50 + 11 inline-byggingene tilbake, og neste S1-hull kommer av samme grunn som forrige:
ingen håndhevelse. Regelen ble husket i tre dager sist.**

#### G4 — migrering: FULLSTENDIG, ingen unntaksliste

**De 50 web-linjene (29 filer) og 11 mobil-filene bytter til komponenten i denne ordren.**

🔴 **Ingen allowlist.** En delvis migrering pluss en liste over unntak **er** mønsteret som må huskes — og det
blir glemt. Endringen er mekanisk (`<img src={`/api${fileUrl}`}>` → `<SignertBilde url={fileUrl}>`), stor i
linjetall og lav i risiko.

⚠️ **Blir migreringen større enn den ser ut: STOPP og meld, framfor å levere halvveis med en unntaksliste.**
Da splitter vi ordren — **men standarden er fullstendig.**

## [4] UFRAVIKELIG

- **Arbeidstre + branch:** cowork bestemmer.
- **Filer ordren eier:** `apps/api/src/utils/hmac.ts` · `apps/api/src/server.ts` · de bekreftede rutefilene i C
  · ny `SignertBilde` (web + mobil) · delt policy i `packages/shared` · lint-regel · de 50 web-linjene og 11
  mobil-filene (**kun bytte til komponenten**) · tester.
- 🔴 **Presisering etter at del G kom inn 2026-09-24:** konsumentene SKAL røres, men **kun ved å bytte til
  komponenten.** ⚠️ **Ingen signeringslogikk i web eller mobil** — signaturen rir i URL-en og lages på
  serveren. **Legger du signering i en klient, har du valgt feil lag.**
- 🔴 **`packages/pdf` leser fra disk, ikke over HTTP** — den skal være upåvirket. **Bekreft det, ikke anta det.**
- 🔴 **Din ordre er input, ikke fasit — mål premisset selv.** Alle linjenumre er målt på `origin/develop`
  2026-09-24.
- 🔴 **Sjekk treets alder før du melder et fravær.** ⚠️ **Og i denne saken særlig: tom grep-output betyr
  «kommandoen døde» like ofte som «finnes ikke».** Dokgen ble selv tatt av zsh-globbing av `--include=*.ts` uten
  fnutter. **Verifiser at stien finnes før du tolker tomhet.**
- **Ingen `.env`-endring uten at Kenneth kjører den.** Finnes signeringsnøkkelen alt (`harSigneringsSecret`),
  trengs ingen ny.
- **Gate:** `pnpm test` fra ROT (`--force`) + kald `pnpm --filter @sitedoc/web build` +
  `pnpm --filter @sitedoc/mobile typecheck`.

## [5] FORVENTET OUTPUT

1. 🔴 **Negativ kontroll på gaten:** at en usignert `/uploads/<fil>` gir **200 FØR** og **401 ETTER**.
   **Uten før-bildet er det ingen måling.**
2. **Sti-traversering:** at `/uploads/./x`, `/uploads//x` og `/uploads/a/../x` alle avvises.
3. **Idempotens:** at en alt signert URL ikke dobbeltsigneres.
4. 🔴 **At mekanismen er DEFAULT-PÅ:** legg til en midlertidig testprosedyre som returnerer en rå
   `/uploads/`-URL og vis at den kommer ut **signert uten at noen la til et kall.** ⚠️ **Det er beviset på at
   S1-hullet fra 15.08 ikke kan gjenta seg. Fjern testprosedyren etterpå, men vis beviset.**
5. **C:** hvilke av de 7 som var ekte, og hvilke som var falske treff.
6. **D1 + D2:** at begge testene feiler når vernet fjernes.
7. **Gate-tall som sier hva som kjørte.**

## [6] OPPRYDDING

Cowork sletter branchen etter merge. Agenten gjør ingenting.

---

## Akseptkriterier (designgate)

| # | Krav | Bevis |
|---|---|---|
| 1 | Usignert `/uploads/` → 401, med før/etter-måling | Pkt 1 |
| 2 | Sti-traversering avvist på hele treet | Pkt 2 |
| 3 | `signerHvisPrivat` dekker hele `/uploads/` og er idempotent | Pkt 3 |
| 4 | **Default-på bevist** — ny rute arver signering uten eget kall | Pkt 4 |
| 5 | D1 «forgiftet URL» og D2 `slettMedUrl` beskyttet av tester som feiler ved fjerning | Pkt 6 |
| 6 | Web/mobil-konsumentene **urørt** | `git diff` |
| 7 | De 7 bekreftet per fil | Rapport |

🔴 **Ikke i denne ordren:** filnavn/RFC 5987 (del F).

⚠️ **Merk at de 61 inline-URL-byggingene NÅ ER i ordren** (G4). De sto som «ikke i denne ordren» i
førsteversjonen, før del G kom inn.

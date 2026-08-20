# NÅ-RAPPORT — flytmodell: rolle-TYPEN i dag (mot vedtak «rekkefølge styrer alene»)

> Kodeverifisert nå-rapport til fabels flytmodell-vedtak [`docs/redesign/vedtak-flytmodell-rekkefolge-fabel-2026-08-21.md`]. **Kun lesing** — ingen kode/branch/commit rørt. **Ingen løsningsforslag** (fabel skriver fjernings-/migreringsdesign etter rapport). Kun fakta med fil:linje.
>
> **Seksjonene 1–6 følger fabels seks kartleggingspunkter direkte.** To målegrenser er eksplisitt merket: prod-radtellinger (pkt 2/6) krever DB-tilgang jeg ikke har, og klikk-/begrepsgevinst-estimat (pkt 5) er et design-steg utenfor en fakta-rapport.

## Metode og gyldighet

- Arbeidstre på `develop`. Alle premisser målt mot **kode** (grep/git/schema), ikke docs. `[MÅLT]` = verifisert med fil:linje/grep.
- Grunnlag: to dyp-lesings-agenter (api/shared/db-atferd · web/mobil/PDF/i18n-visning) + egne målinger på schema, autoritets-kjernen (`statusHandlinger.ts`, `flytRolle.ts`, `tilgangskontroll.ts`) og datapersistens.
- **Rolle-aksene holdes adskilt:** denne rapporten gjelder **`DokumentflytMedlem.rolle`** (flyt-ledd-typen). `User.role`/`ProjectMember.role` (`sitedoc_admin`/`admin`), HMS `firmaRoller`, og faggruppe-feltene `bestillerFaggruppeId`/`utforerFaggruppeId` er **andre akser**, utenfor migreringen (markert «annen akse» der de dukker opp).

---

## 0. HOVEDFUNN (det viktigste, på tvers av punktene)

**Serverens FAKTISKE autorisasjon for statusoverganger / «hvem har ballen» / terminering er allerede POSISJONS-basert, ikke type-basert.** [MÅLT `tilgangskontroll.ts:824-885`]

- Serverens eneste statusovergang-gate er `verifiserRetningsrett` → `retningsrettigheter`/`byggPosisjonsLedd` (posisjon + `klassifisering` + `kanTerminereUtenBall`). `isValidStatusTransition` [`index.ts:161`] er rolle-agnostisk (kun fra→til).
- Den rolle-TYPE-baserte matrisen (`erTillattForRolle` / `ROLLE_HANDLINGER_DEFAULTS`) lever fortsatt i `packages/shared`, **men kalles IKKE fra apps/api sin endreStatus-sti** [MÅLT — ❌ ingen treff på `erTillattForRolle`/`celleTillatt`/`hentRolleFiltrertHandlinger` i `apps/api` utenom tester]. Den konsumeres av **klient-UI** (web/mobil) og **admin-konfig-CRUD** (`flytMatrise`).
- Type-makten som gjenstår i praksis: (a) klient-UI via shared-matrisen, (b) admin-konfig + dens DB-rader, (c) `senderRolle`-snapshot per transfer. Ingen sitter i serverens aktive flyt-autorisasjon.

> 🔑 **RAPPORTENS VIKTIGSTE FUNN (pkt 3):** `registrator` er i dag **BÅDE en rolle-TYPE-verdi** (`DokumentflytMedlem.rolle="registrator"` — gater hvem som kan opprette) **OG en tillatelse** (`create_checklists`/`create_tasks` — gater flytt/eierbytte + `senderRolle`-snapshot). **Disse to må reconciles når registrator skal bli ett flagg (fabels F4)** — ellers står to uavhengige «registrator»-kilder igjen. Full mekanikk: pkt 3.

---

## 1. Hvor leses ledd-typen i dag? (uttømmende)

### 1a. Statusoverganger — server: posisjon · shared/klient: type
- **Server (aktiv sti): posisjon.** `verifiserRetningsrett(...)` [`tilgangskontroll.ts:824-885`] + `seerLedd.kanTerminereUtenBall` [`:856-864`]. `isValidStatusTransition` rolle-agnostisk [`index.ts:161`].
- **Shared/klient: type.** `ROLLE_HANDLINGER_DEFAULTS` (rolle×status→tillatte overganger) [`statusHandlinger.ts:327-375`]; `celleTillatt(rolle,…)` [`:266-279`]; `erTillattForRolle(rolle,…)` [`:211-228`]; `hentRolleFiltrertHandlinger(status,rolle,…)` [`:110-132`]; `hentHandlingEierRoller` løper `["bestiller","utforer","godkjenner"]` for «Kun utfører»-begrunnelser [`:235-241`]. Posisjons-erstatteren finnes allerede: `hentPosisjonFiltrertHandlinger` [`:158-202`].

### 1b. Signering — nei (urelatert)
- «Signering» på api = HMAC av fil-URL-er [`apps/api/src/utils/hmac.ts`, `utils/vedleggSignering.ts`] — urelatert til flyt-rolle. [MÅLT]
- PDF-signaturblokk viser **faggruppenavn + handlingsetikett** («Utført av»/«Godkjent av»), ikke typen: `sammenstilling.ts:235-241` → `signatur.ts:14,19-20`.

### 1c. Attestering / godkjenning — server: posisjon
- Godkjenning (→`approved`) autoriseres av `retningsrettigheter.kanTerminere = harBallen ∨ kanTerminereUtenBall` [`flytPosisjon.ts:298-315` + `tilgangskontroll.ts:872-877`]. **Ingen «kun godkjenner kan godkjenne»-sjekk på serveren.** [MÅLT] (Shared-matrisen «eier» `godkjenner` `received/responded→approved` [`statusHandlinger.ts:364-374`] — klient/konfig-laget.)

### 1d. Varsling / notifikasjoner — nei
- **Ingen** push/varsel-mekanisme i apps/api forgrener på rolle (kun `sendInvitasjonsEpost` [`gruppe.ts:13`]). Mottaker bestemmes posisjonelt: `utledMottakerForPosisjon` [`flytPosisjon.ts:101-122`] + `recipientUserId`/`recipientGroupId`. [MÅLT]

### 1e. PDF / visning — vises typenavnet?
- **JA, i PDF: arkiv-PDF-ens «Dokumenthistorikk» viser rå `aktorRolle` (uoversatt enum) i parentes** [`packages/pdf/src/arkivmal/loggseksjon.ts:46`]; kilde `DocumentTransfer.senderRolle` via `arkiv/logg-lesere.ts:57`, kontrakt `typer.ts:27-28`. **Eneste sted typen når PDF.**
- **JA, i mobil flyt-sheet:** `t(\`dokumentflyt.${m.rolle}\`)` per medlem [`apps/mobile/src/components/Flytlinje.tsx:271`].
- Web `FlytIndikator` viser **ansvarsmerke** (avledet av typen), ikke typenavnet i boksene [`FlytIndikator.tsx:159`]. Full UI-liste: se pkt 5.

### 1f. Tilgang/synlighet — annen akse
- `avgjorDokumentTilgang.ts:78,84` bruker `User.role`/`ProjectMember.role` (admin-akse), ikke `DokumentflytMedlem.rolle`. Faggruppe-tilgang bruker `bestiller/utforerFaggruppeId` (faggruppe-akse). Utenfor migreringen.

---

## 2. Skjema — hvor bor enumen, hvilke verdier, prod-rader?

| Felt/modell | fil:linje | Merknad |
|---|---|---|
| `DokumentflytMedlem.rolle String` — `"registrator"\|"bestiller"\|"utforer"\|"godkjenner"` | `schema.prisma:1360` | Selve kolonnen |
| `DokumentflytMedlem.steg Int` | `schema.prisma:1361` | Posisjonen — den nye styringsaksen |
| `klassifisering` / `kanTerminereUtenBall` / `ansvarsmerke` | `schema.prisma:1362-1365` | Retningsrett/terminering + brukervendt merke (posisjonsmodell) |
| `@@unique([…, rolle, steg])` ×3 | `schema.prisma:1379-1381` | Unique-constraints inkluderer `rolle` — DB-struktur endres ved fjerning |
| `Dokumentflyt.roller Json` — `Array<{rolle, label?}>` | `schema.prisma:1329` | Flytens rolle-liste (konfig) som JSON |
| `DocumentTransfer.senderRolle String?` | `schema.prisma:1240` | Rolle-type **frosset på hver transfer-rad** (historikk) |
| `FlytRettighetOverride { rolle,fraStatus,tilStatus }` | `schema.prisma:1412` | Per-firma override, rolle-nøklet, `@@unique([rolle,fraStatus,tilStatus])` |
| `FlytRettighetLogg { rolle … }` | `schema.prisma:1428` | Append-only endringslogg, rolle-nøklet |

- Enum-kilde: `dokumentflytRolleSchema = z.enum(["registrator","bestiller","utforer","godkjenner"])` [`packages/shared/src/validation/index.ts:11`]; `faggruppeRolleSchema` = samme [`:12`]; brukt i `addDokumentflytMedlemSchema` m.fl. [`:246,267,286`].
- **Verdier som ville miste betydning ved fjerning:** `bestiller`, `utforer`, `godkjenner` i alle feltene over (`registrator` beholdes).
- ⚠️ **MÅLEGRENSE — prod-radtellinger ikke målt:** jeg har ikke prod-DB-tilgang i denne økta, så jeg kan ikke telle hvor mange `DokumentflytMedlem`/`DocumentTransfer.senderRolle`/`FlytRettighetOverride`-rader i prod bærer de tre typene. Feltene *finnes* og *bærer* typen (over); antallet krever en DB-spørring (Kenneth-hånd).

---

## 3. Registrator i dag — hvordan er «kan starte» implementert?

**«Kan opprette/starte et dokument» = være `registrator`-MEDLEM av flyten (rolle-verdien "registrator"), ikke enhver rolle.** [MÅLT]

- `sjekkliste.opprett`: «oppretter-rollen (lagret som "registrator"), ikke enhver rolle … må være registrator-medlem av flyten for å opprette (F1-oppfølger, Kenneth-vedtak 2026-07-24) — admin legger seg selv i en flyt som registrator ved behov» [`apps/api/src/routes/sjekkliste.ts:407-410`, kontroll `:423`].
- `oppgave.opprett`: «medlem (rollen lagret som "registrator"). Ingen bypass — også admin må være registrator-[medlem]» [`apps/api/src/routes/oppgave.ts:499`].
- **Kandidat-flytene** (hvilke maler/flyter en bruker kan opprette i) beregnes av `hentMineOpprettFlyter` [`medlem.ts:136`] + den delte `opprettbar`/`opprettbareFlytIder`-regelen [`mal.ts:151-199`] — en mal er opprettbar hvis brukeren er registrator-medlem av en flyt med den malen (HMS auto-rutes, flyt-løst).
- **Andre «registrator»-mekanisme (parallell):** `erRegistrator = tillatelser.has("create_checklists") || tillatelser.has("create_tasks")` — en **tillatelse**, brukt til «flytt/bytt eier»-gaten [`sjekkliste.ts:1828-1837`, `oppgave.ts:1910-1963`] og til å utlede `senderRolle` i snapshot [`transfer-snapshot.ts:52`]. Admin → alltid `"registrator"` i `utledMinRolle` [`flytRolle.ts:73`].
- Default: ny flyt starter med ett `registrator`-ledd [`dokumentflyt.ts:58-60`].

> 🔑 **Faktisk tilstand (rapportens viktigste funn — reconciles i fabels F4):** «registrator» er i dag **BÅDE** (a) en **rolle-TYPE-verdi** i `DokumentflytMedlem.rolle` (gater hvem som kan **opprette** — man må være registrator-medlem av flyten [`sjekkliste.ts:407-410`, `oppgave.ts:499`]) **OG** (b) en **tillatelse** `create_checklists`/`create_tasks` (gater **flytt/eierbytte** [`sjekkliste.ts:1828-1837`] + utleder `senderRolle` [`transfer-snapshot.ts:52`]). **To uavhengige «registrator»-kilder.** For at registrator skal bli ett **flagg** i stedet for en type, må begge reconciles: «registrator-medlem av flyten»-konseptet (i dag `rolle="registrator"`) uttrykkes som en per-ledd-egenskap, `hentMineOpprettFlyter`/`opprettbareFlytIder` key-e på den, **og** forholdet til `create_*`-tillatelsen avklares (er de samme flagg, eller to ulike ting?). *(Hvordan = fabels designsteg / F4.)*

---

## 4. Rekkefølge — er posisjonen autoritativ, eller avgjør typen? (migreringspunkter)

### 4a. Rekkefølgen ER allerede autoritativ for stegning (posisjon)
| fil:linje | Hva |
|---|---|
| `tilgangskontroll.ts:824-885` | `verifiserRetningsrett` — serverens **eneste** statusovergang-autorisasjon (posisjon/ball) |
| `flytPosisjon.ts:172-315` | `nesteLedd`/`forrigeBallLedd`/`retningsrettigheter`/`harBallenPosisjon` — neste-mottaker/ball/terminering på posisjon+klassifisering |
| `flytPosisjon.ts:101-122` | `utledMottakerForPosisjon` — hvem får dokumentet neste = posisjon |
| `flytRolle.ts:190-218` | `utledDokumentRettighet` — **destrukturerer UTEN `minRolle`**; rettighet = ball/status/tillatelser/admin |
| `flytRolle.ts:132-146` | `beregnHarBallen` — ball = recipient/bestiller-**identitet**, ikke type |
| `statusHandlinger.ts:158-202` | `hentPosisjonFiltrertHandlinger` — posisjons-erstatteren for handlingsfilter |

`minRolle` legges i `rettighetInput` [`useFlytKontekst.ts:214`, `useSjekklisteSkjema.ts:300`] men er **inert** (leses ikke av `utledDokumentRettighet`).

### 4b. Steder der TYPEN — ikke posisjonen — avgjør (migreringspunkter, kode)
| # | fil:linje | Hva |
|---|---|---|
| 1 | `flytRolle.ts:43-48` | `ROLLE_PRIORITET {registrator:1,bestiller:2,utforer:3,godkjenner:4}` — tie-break på type |
| 2 | `flytRolle.ts:67-107` | `utledMinRolle` — utleder rolle-streng (bruker #1); mates til perspektiv + (inert) rettighet |
| 3 | `statusHandlinger.ts:327-375` | `ROLLE_HANDLINGER_DEFAULTS` — rolle×status-matrise |
| 4 | `statusHandlinger.ts:266-279` | `celleTillatt(rolle,…)` — matrise-oppslag per type |
| 5 | `statusHandlinger.ts:211-228` | `erTillattForRolle(rolle,…)` (backend-form, IKKE kalt fra apps/api) |
| 6 | `statusHandlinger.ts:110-132` | `hentRolleFiltrertHandlinger` — filtrerer handlingsknapper per type |
| 7 | `statusHandlinger.ts:235-241` | `hentHandlingEierRoller` — «Kun utfører»-begrunnelser |
| 8 | `transfer-snapshot.ts:8-17` | `utledSenderRolle(status, erRegistrator)` — status→rolle-type-streng, skrives til `senderRolle` |
| 9 | `transfer-snapshot.ts:70-72` | snapshot-faggruppenavn valgt ut fra `senderRolle`-type |
| 10 | `flytMatrise.ts:92-129` | rolle-nøklet override/logg-CRUD (admin) |
| 11 | `flytRettighet.ts:15-25` | bygger rolle-nøklet override-map (mates til #4; ikke i apps/api endreStatus) |
| 12 | `oppgaver/page.tsx:430`, `sjekklister/page.tsx:375` | klient `find(m => m.rolle === "utforer")` — henter utfører-navn til liste-kolonne (eneste klient-sted som forgrener på en spesifikk type-verdi) |
| 13 | `dokumentflyt.ts:121-135` | `deleteMany({ where:{ rolle:{ in: fjernedeRoller }}})` + `:196-203` hovedansvarlig-unikhet grupperer på `rolle+steg` (konfig-identitet på rolle) |

Klient-vaktene som KUN er null-sjekk på type (ikke type-forgrening): `DokumentHandlingslinje.tsx:223`, `DokumentHandlingsmeny.tsx:556`, `perspektivEtikett.ts:78-82`.

---

## 5. UI — flytbyggerens typevelger + alle flater som viser typenavn

### 5a. Flytbyggerens typevelger (config)
- Web flyt-oppsett (typevelger + labels): `apps/web/src/app/dashbord/oppsett/produksjon/dokumentflyt/page.tsx:410-413,495,556,1216` (`tittelNoekkel:"dokumentflyt.registrator"` osv.).
- Kontakt-modal (velg rolle i flyt): `OpprettKontaktModal.tsx:135-136,384`.
- Mobil dokumentflyt-oversikt (config): `apps/mobile/app/dokumentflyt.tsx:223-225,308`.
- Admin rettighetsmatrise (rå rolle-type): `apps/web/src/app/dashbord/admin/flyt-rettigheter/page.tsx:291`.

### 5b. Typenavnet vist til sluttbruker (dokument-kontekst)
- **Arkiv-PDF «Dokumenthistorikk»:** `packages/pdf/src/arkivmal/loggseksjon.ts:46` (rå enum).
- **Mobil flyt-sheet:** `apps/mobile/src/components/Flytlinje.tsx:271`.
- **Brukeroversikt (FlytChip):** `brukere/page.tsx:422` + `apps/web/src/components/oppsett/FlytChip.tsx:23`.

### 5c. Ansvarsmerke (AVLEDET av typen), vist til bruker
- Web `FlytIndikator.tsx:159` (kilde `flyt-ledd.ts:123`); mobil `Flytlinje.tsx:249,133` (kilde `dokumentflyt-ledd.ts:102`); delt avledning `flytPosisjon.ts:32-47`.

### 5d. i18n-nøkler som navngir typene (kandidater for fjerning/omdøping)
- `dokumentflyt.{registrator,bestiller,utforer,godkjenner}` (+ `*Beskrivelse`) — `nb.json:2428-2433, 573-574`
- `hjelp.rolle.registrator.*` (+ admin/firmaansvarlig/medlem) — `nb.json:2502-2505`
- `ansvarsmerke.*` — `nb.json:3537-3544`; `flyt.duHarBallenMerke`/`flytlinje.duHarBallenMerke` — `nb.json:3547, 2272`
- Alle 17 språkfiler speiler disse.

### 5e. IKKE flyt-rolle-typen (ikke forveksle)
- PDF-signaturblokk (`signatur.ts:19`, `sammenstilling.ts:235-241`) + print-header = faggruppenavn + handlingsetikett.
- `malbygger.rolle` [`FeltKonfigurasjon.tsx:211`, placeholder «Kontrollør, Prosjektleder»] = fritt signaturfelt i mal, ikke `DokumentflytMedlem.rolle`.
- `sluttrapport.ts:188` («Ansvarlig kontrollerende») = fast tekst, ikke koblet til rollen.

⚠️ **MÅLEGRENSE — «klikk-/begrepsgevinst estimeres»:** et estimat er et design-/vurderingssteg, ikke en måling; utelatt fra denne fakta-rapporten. Faktagrunnlaget er surface-listen over (config-typevelger på 4 flater + typenavn-visning på 3 sluttbruker-flater + 4 i18n-nøkkelgrupper).

---

## 6. Migreringsrisiko — eksisterende flyter/maler, trengs type→posisjon-mapping?

- **Rekkefølgen (`steg`) er allerede den operative aksen** på serveren (§0, §4a) — «neste-mottaker», ball, terminering leser posisjon, ikke type. En type→posisjon-**mapping for kjøre-logikk** trengs derfor i praksis ikke på server-siden; posisjonen er komplett der.
- **Det som må håndteres er data + de gjenstående type-leserne** (§4b): shared-matrisen (klient-UI), admin-konfig (`flytMatrise` + `FlytRettighetOverride`/`Logg`-rader), og `senderRolle`-snapshot.
- **Lagret data som bærer typen** (må vurderes ved fjerning): `DocumentTransfer.senderRolle` [`schema.prisma:1240`], `Dokumentflyt.roller` JSON [`:1329`], `DokumentflytMedlem.rolle` + tre `@@unique(…, rolle, steg)` [`:1360, :1379-1381`], `FlytRettighetOverride.rolle`/`FlytRettighetLogg.rolle` [`:1412, :1428`].
- ⚠️ **MÅLEGRENSE (som pkt 2):** antall prod-flyter/maler/transfer-rader som bærer `bestiller/utforer/godkjenner` er ikke målt (ingen prod-DB-tilgang). Kreves for å dimensjonere migreringen — Kenneth-hånd (DB-spørring).

---

## Rekonsiliering mot fabels seks punkter
Seksjonene 1–6 svarer 1:1 på fabels punkter. **Full dekning**, med to eksplisitte målegrenser (ikke gap i kartleggingen, men grenser for hva denne økta kan måle):
- **Pkt 2 & 6 — prod-radtellinger:** ikke målt (ingen prod-DB-tilgang). Feltene og deres skrive-/lese-stier er kartlagt; *antallet* rader krever en DB-spørring.
- **Pkt 5 — klikk-/begrepsgevinst-estimat:** utelatt som design-/vurderingssteg; surface-faktagrunnlaget er levert.
Ingen innholdsmessig avvik mellom min opprinnelige seksjonering og fabels nummerering — kun omstrukturert til fabels rekkefølge.

---

## Prod-radtellinger — punkt 2 og 6 (målt 2026-08-21, kjørt av Kenneth)

Rapportens forfatter hadde ikke prod-DB-tilgang; tallene ble hentet av Kenneth og
føres inn her av cowork ved merge.

| Tabell | Verdi | Rader |
|---|---|---|
| `dokumentflyt_medlemmer` | `utforer` | 10 |
| | `bestiller` | 8 |
| | `registrator` | 6 |
| | `godkjenner` | 4 |
| | **sum** | **28** |
| `document_transfers` | `(null)` | 20 |
| | `utforer` | 18 |
| | `bestiller` | 18 |
| | `godkjenner` | 2 |
| | **sum** | **58** |
| `flyt_rettighet_overrides` | — | **0 rader** |

**Tre konsekvenser for fjerningsdesignet:**

1. 🟢 **`flyt_rettighet_overrides` er tom.** Ingen kunde har lagret overstyringer.
   Fabels F5 («kunde-overrides migreres kun der entydig, aldri stille») har ingen data
   å migrere — tabellen og lese-/skrivestien kan behandles som ren kode, ikke som et
   datamigreringsproblem.
2. **28 leddrader totalt** på tvers av alle flyter i prod. Type→posisjon-mapping er en
   liten, håndterbar mengde — ikke en masseoperasjon.
3. **20 av 58 `document_transfers` har allerede `sender_rolle = null`.** PDF-loggen må
   altså **allerede i dag** tåle at feltet mangler. Det styrker F3 (frys historikk, ikke
   migrer): null-håndteringen finnes eller trengs uansett, og enum-bug-fiksen
   (`loggseksjon.ts:46`) må dekke begge former.

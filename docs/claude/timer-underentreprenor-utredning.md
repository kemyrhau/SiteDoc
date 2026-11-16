# Utredning — timer som underentreprenør i et annet firmas prosjekt

---
status: 🟡 UTKAST 2026-11-07 (Fabel) — analyse, ingen kode. Venter Kenneths svar på B1–B7 (§ 4).
sist_verifisert_mot_kode: 2026-11-07 (develop @ 09ec0060)
bestilling: relay/inbox-fabel.md:811 (orkestrator 2026-11-07, Kenneth sitert)
berører: timer.md, arkitektur.md § Roller, terminologi.md § UE, fase-0-beslutninger.md § B.5, maskin-vare-kontroll-spec.md (36d), dagsoversikt-beskrivelse-spec.md (36b)
---

## 0. Bestilling og kort svar

Kenneth (sitert i ordren):

> «Firma: en ansatt tilhører kun et firma. Alle timer tilhører dette firmaet. Dette firmaet kan likevel jobbe på et annet prosjekt som et annet firma eier. Da jobber man som underentreprenør. […] Hva gjør jeg når jeg er invitert inn som UE i et annet firmas prosjekt? Da eier ikke mitt firma det prosjektet! Hvordan kan vi registrere timer inn i det prosjektet? Hvordan kan firma B holde sin egen økonomi adskilt fra firma A som eier prosjektet? […] Foreløpig kan vi forholde oss til at Amarkussen alene har kun sine egne prosjekter. Utred likevel muligheten […] Dersom denne finnes og det er hensiktsmessig å implementere nå så gjør vi det, dersom dette er vanskelig venter vi.»

**Kort svar.** Modellen Kenneth beskriver er allerede halvbygd i koden. Prosjektet har et deltakerfirma-register (`ProjectOrganization` med rolle `underentreprenor`), og timer-modulens skrivevakt slipper gjennom rader mot prosjekter der firmaet *deltar*, ikke bare eier (§ 1.2). Dagsseddelen eies alltid av arbeiderens eget firma (B), så lønn, lønnsart og pris forblir B sine. Det som mangler er fire ting:

1. Bare `sitedoc_admin` kan koble B til A sitt prosjekt i dag (§ 1.2 punkt 4).
2. Mobilens prosjektvelger viser aldri A sitt prosjekt for en B-ansatt (§ 1.2 punkt 5).
3. Attesteringslistene er **ikke** firma-isolert: A sin prosjektleder ser og kan attestere B sine sedler, inkludert B sine priser (§ 1.3). Dette er et sikkerhetshull uavhengig av UE-funksjonen.
4. B sin lønnsrapport tar ikke med rader på A sitt prosjekt (§ 1.3, kjent asymmetri).

**Anbefaling (§ 3):** vent med UE-funksjonen som helhet, men lukk de tre hullene som gjelder uansett (H1–H3 i § 5) i en liten egen leveranse. Fire valg i 36b/36d må tas nå for ikke å stenge døren (§ 3.3).

## 1. Dagens modell (målt mot `09ec0060`)

### 1.1 Hvem eier hva

| Entitet | Eier-felt | Kilde | Merknad |
|---|---|---|---|
| `User` | **ingen** `organizationId` | `packages/db/prisma/schema.prisma:10-80` | Firmatilhørighet er m:n via `OrganizationMember` (`:246-289`, unik `[userId, organizationId]` `:284`). `hentBrukersOrg` kaster BAD_REQUEST ved flere aktive ansettelser (`apps/api/src/trpc/tilgangskontroll.ts:292-305`) — «én ansatt, ett firma» håndheves i runtime, ikke i skjema. |
| `Project` | `primaryOrganizationId String?` | `schema.prisma:688` | Nullable. Deltakerfirmaer i `ProjectOrganization` (`:354-366`): `rolle` «hovedeier \| byggherre \| konsulent \| underentreprenor» (`:358`), unik `[projectId, organizationId]` (`:364`). |
| `ProjectMember` | **ingen** org-kolonne | `schema.prisma:726-750` | `role` «admin \| member» (`:732`), `kanAttestere` (`:736`). Kommentaren på `:731` sier UE «utledes deterministisk via erUnderentreprenor()» — utlederen finnes ikke i kode (negativsøk `erUnderentreprenor` i `apps/` og `packages/`: 0 treff; bekreftet i `terminologi.md:220`). |
| `DailySheet` | `organizationId` påkrevd | `packages/db-timer/prisma/schema.prisma:153` | Ingen `projectId` siden T.1 (`:156-157`). Unik `[userId, dato]` (`:211`) — én seddel per person per dag uansett firma. |
| `SheetTimer` / `SheetMachine` | arver firma fra seddel | `:236` (`projectId`), `:238`/`:245` (byggeplass/ECO); maskin `:545-553` | Prosjekt per rad. Ingen org-felt på rad. |
| `Lonnsart`, `Aktivitet`, `Tillegg` | `organizationId` | `db-timer schema.prisma:24`, `:62`, `:87` | Bærer `prisMotKunde`, `internkostnad`, `sats` (`:28-31`). Rad må bruke seddelens firmas katalog (`dagsseddel.ts:2012-2016`). |
| `Vareforbruk` | **ingen** org | `packages/db-varelager/prisma/schema.prisma:74-100` | Varelageret eies av **prosjekteier** (`vareforbruk.ts:68-91`). |
| `ExternalCostObject` (underprosjekt) | `organizationId` **og** `projectId` | `schema.prisma:2798-2801` | Unik `[organizationId, proAdmId]` (`:2832`). B kan i skjemaet ha egne ECO-er med `projectId` = A sitt prosjekt. |
| `Byggeplass` | `projectId` | `schema.prisma:1138-1183` | Eies av prosjektet, altså A. Ingen org-felt. |
| `PsiTilstedevarelse` (innsjekk) | `projectId`, `userId?` | `schema.prisma:2428-2463` | Ingen org. Klokkeslett skjules for annen arbeidsgiver i `serialiserMedIsolasjon` (`apps/api/src/routes/mannskap.ts:147-152`). |

### 1.2 Hva stopper en B-ansatt fra å føre på A sitt prosjekt i dag

1. **Seddelen blir B sin.** `resolverOrgForEgenTimeføring` = `inputOrgId ?? krevBrukersOrg` + `verifiserAnsattIFirma` (`tilgangskontroll.ts:360-367`). `opprett` lagrer `organizationId: orgId` (`dagsseddel.ts:1787`, `:1847`). Brukeren kan ikke velge A som timerfirma uten aktivt `OrganizationMember` i A (`:386-399`, «Timer kan bare føres av ansatte»).
2. **Firmagrensen per rad slipper gjennom deltatte prosjekter.** `prosjektTilhørerFirmaWhere` = `primaryOrganizationId == org` **eller** `projectOrganizations.some(org)` (`tilgangskontroll.ts:812-821`). `verifiserProsjekterTilhørerFirma` (`:832-863`) kalles i `opprett` `:1809`, `tilfoyTimerRad` `:2036`, `forsonDagskort` `:2468`, `redigerSedelRader` `:4557`, `syncBatch` `:6275`, splitt `:1470`. Uten `ProjectOrganization`-rad for B: FORBIDDEN «Prosjektet «X» tilhører ikke firmaet ditt» (`:856-862`). **Med** rad: timer, maskin og splitt går gjennom. `timer.md:662` dokumenterer dette som tilsiktet («dekker underentreprenør»).
3. **Mobilsynk krever i tillegg `ProjectMember`** på seddelprosjekt og hvert radprosjekt (`dagsseddel.ts:6088`, `:6240-6242`). Webveien krever ikke medlemskap.
4. **Bare `sitedoc_admin` kan koble et fremmed firma.** `admin.tilknyttProsjekt` (`apps/api/src/routes/admin.ts:471-491`); `organisasjon.leggTilProsjekt` godtar bare eget eid prosjekt (`organisasjon.ts:486-507`, kommentar `:498`). `arkitektur.md:394-395` sier det samme.
5. **Mobilens prosjektvelger viser aldri A sitt prosjekt.** Cachen fylles fra `prosjekt.hentMine` (medlemskap, `prosjekt.ts:38`), `prosjektLocal.organizationId` settes fra `primaryOrganizationId` (`apps/mobile/src/services/prosjektKatalog.ts:51`), og `hentProsjekterLokalt(orgId)` filtrerer `organizationId == valgt firma` (`:69-82`). Brukes i `ProsjektVelger.tsx:49`, `TimerSeksjon.tsx:2369`, `NyTimerRadFlyt.tsx:55`, `bekreft-dag.tsx:189`, `dagsforslagInput.ts:95`. Web bruker `prosjekt.hentForTimer` med `prosjektTilhørerFirmaWhere` (`prosjekt.ts:74-86`) — eid ∪ deltatt, uten medlemskapskrav. **Mobil og web har ulik regel.**
6. **`timerTilgangDefault` håndheves ikke.** Finnes i skjema (`schema.prisma:382`) og web-innstillinger, men 0 treff i `apps/api/src/routes/timer` og `apps/mobile`. Kun `vareforbrukTilgangDefault` håndheves (`vareforbruk.ts:104-138`).
7. **B-bruker kan være `ProjectMember` i A-prosjekt.** Admin-grenen i `medlem.registrer` sjekker ikke org-likhet (`medlem.ts:283-303`); firmaansvarlig-grenen sammenligner med *innbyderens* firma (`:276-281`). `tilgangskontroll.ts:103-104` kaller dette «guest-tilgang på annet firmas prosjekt». Gjesten kan likevel ikke føre timer (punkt 2) før B er deltakerfirma.

**Hull uavhengig av UE:** `tilfoyTilleggRad` (`dagsseddel.ts:2865-2912`, `projectId` skrives rett `:2903`) og `tilfoyUtleggRad` (`:3093-3180`, `:3170`) har ingen prosjektgrense. `tilfoyTimerRad` validerer ikke `externalCostObjectId` (`:1979` → `:2053`; F-U1 i 36d-spec).

### 1.3 Hva A ser av B i dag — isolasjonen målt

Forutsetning: B er koblet via `ProjectOrganization` og en B-ansatt har ført rader på A sitt prosjekt.

| Flate | Firma-isolert? | Kilde | Følge |
|---|---|---|---|
| Lønnsrapport/eksport (`firmaPeriodeRapport`, `detaljEksport`) | **Ja** — `organizationId: orgId` (`rapport.ts:156`, `:361`) | A ser aldri B sine timer her. **Men** prosjektuniverset er kun eide prosjekter (`:120-126`, `:333-339`) → **B sin egen rapport mister rader på A sitt prosjekt** (kjent asymmetri `timer.md:677`). |
| `hentTilAttestering` (prosjektvisning) | **Nei** — bare `timer.some.projectId` + `status: "sent"` (`dagsseddel.ts:3458-3462`) | A sin prosjektleder ser B sine sedler, med rader fra *alle* prosjekter på seddelen (`:3469-3470`). |
| `hentTilAttesteringFirma` (mobil) | **Nei** — prosjekter via `projectOrganizations` (`:3540-3547`), sedler uten org-filter (`:3568-3573`) | A sin firmaadmin får B sine sedler med alle skalarfelt og utleggsbeløp. |
| `hentForAttestering` | **Nei** — auth på første rads prosjekt (`:3828-3832`), returnerer `attestertSnapshot` (`:3797-3808`) | Snapshotet bærer B sine `prisMotKunde`/`internkostnad`/`sats` (`:4176-4184`). **A kan lese B sin kundepris og internkostnad etter attestering.** |
| `attesterRader`/`attester`/`returner*` | **Nei** — `krevProsjektLeder` per radprosjekt (`:4128-4129`, `:5397`, `:5518`) | A kan attestere og returnere B sine rader. `erProsjektLeder` = sitedoc_admin ∨ firmaadmin i **eier**firma ∨ ProjectMember admin/kanAttestere (`:141-156`, `erFirmaAdminForProsjekt` sjekker kun `primaryOrganizationId` `tilgangskontroll.ts:476-486`). **B sin egen firmaadmin kan derfor ikke attestere B sine rader på A-prosjektet.** |
| `rapport.hentFirmaAnsatteMedTimer` | **Nei** — `groupBy userId` uten org (`rapport.ts:889-893`) | A får navn og e-post på B sine ansatte. |
| Web attestering (`attestering-buckets.tsx`) | katalog hentes for innlogget firma (`:150-161`) | B sine lønnsartnavn vises som «—» hos A — symptom på at flaten aldri var ment for kryssfirma. |
| Mannskap/innsjekk | **Ja** (feltnivå) — `visTid = sitedocAdmin ∨ segSelv ∨ deltArbeidsgiver` (`mannskap.ts:147-152`) | A ser at B-arbeideren var på plassen, ikke klokkeslett. Dette er modellen Kenneth ber om («mannskapsliste, ikke lønn»). |
| Maskin-ruter | **Ja** — org-avgrenset (`routes/maskin/equipment.ts:84-97`) | B sin maskinbruk lekker likevel via attesteringsspørringene over. |
| Vareforbruk | eies av A | `vareforbruk.ts:68-91`, `:356` (`vare: true` gir pris) | Lekkasje motsatt vei: A sine varepriser til B sine arbeidere som er prosjektmedlemmer. |
| Prosjektarkiv (`samleProsjektFiler`) | **Nei** for kvitteringer (`services/eksport/filer.ts:185-222`) | A sin eksport tar med B sine utleggs-/tilleggskvitteringer. Timer holdes bevisst utenfor (`arkiv.ts:162-166`). |

Konklusjon: skrivesiden er bygget for UE, lesesiden er det ikke. `timer.md:1327` vedtar «Et firma ser kun egne timer — aldri prosjekteiers/annet firmas, selv på delte prosjekter»; attesteringsflatene bryter dette.

### 1.4 Hva dokumentasjonen allerede har vedtatt

- **Streng firma-isolasjon** (`timer.md:1327`, `OPPSUMMERING-timer-arkitektur.md:58`): hvert firma rapporterer egne timer, aldri prosjekteier.
- **UE utledes, lagres ikke** (fase-0 B.5, `fase-0-beslutninger.md:1172-1229`, lukket 2026-04-27): `erUnderentreprenor(user, project)` = arbeiderens firma ≠ prosjektets eierfirma. Lønnseksport filtrerer ut UE-timer (`:1215`), ProAdm-eksport tar med alle (`:1216`). **Drift:** B.5 forutsetter `User.organizationId` (`:1223`); feltet finnes ikke lenger — tilhørighet er `OrganizationMember`. Utlederen må skrives mot `OrganizationMember` ∪ `DailySheet.organizationId`.
- **UE-timer mot UE-firmaets katalog, eksport til UE-firmaets regnskap** (`domene-arbeidsflyt.md:758`, `:762`). Samsvarer med dagens skrivevakt.
- **Kryssorg-deling** (`arkitektur.md:404-408`): deaktivert som standard (`eksternDeling` — finnes ikke i kode, negativsøk 0 treff), kun push, varsling ≠ deling, ingen duplikater. Gjelder dokumenter, ikke timer, men «ingen duplikater» veier mot speilprosjekt (§ 2 alt. 2).
- **Mannskap: hovedentreprenør ↔ UE-innsyn ÅPEN** (`mannskap.md:423`): Fase A er konservativ (tid kun til delt arbeidsgiver).
- **HMS-vedtak 2026-07-21** (`hms-domenemodell.md:31-36`): UE-arbeiders RUH på A sitt prosjekt skal synes både hos A (prosjekt) og hos B (firma). Presedens for «prosjektet ser hendelsen, firmaet eier personen».
- **BACKLOG `:1429-1442`**: RUH fra innleid firma skal telle hos det firmaet — ses sammen med kryssorg-deling; Fabel skal skrive spec før kode.
- **Kryssprosjekt-deling** (memory, DRØFTES): UE med *eget* prosjekt deler sjekklister til HE. Avklart: sjekklister lastes opp som dokumenter, RUH deles bevisst. Dette er speilprosjekt-varianten for dokumenter, ikke for timer.

## 2. Løsningsalternativer, rangert

### Alt. 1 — Kryssorg-deltakelse: B fører på egen seddel mot A sitt prosjekt (ANBEFALT)

**Idé.** A inviterer firma B som deltaker (`ProjectOrganization.rolle = "underentreprenor"`). B sine ansatte får A-prosjektet i velgeren, fører på sin vanlige B-seddel med `SheetTimer.projectId` = A-prosjektet. Alt annet (lønnsart, pris, attestering, lønn, eksport) skjer hos B. A ser kun det A allerede ser av eksterne i dag: mannskapsliste uten klokkeslett.

**Hvorfor dette bærer.** Skrivevakten gjør allerede dette (§ 1.2 punkt 2). Datamodellen krever **ingen migrering**. Det som skal bygges er invitasjon, prosjektvelger på mobil, tetting av lesesiden og rapport-univers.

**Firma-isolering:**

| Data | A ser | B ser |
|---|---|---|
| B sine timer, maskintimer, lønnsart, pris, lønn | **nei** (etter tetting H1–H3) | ja |
| Hvem fra B var på plassen (innsjekk) | ja, uten klokkeslett (finnes) | ja, med klokkeslett |
| Antall B-personer per dag | ja via mannskapsliste | ja |
| B sine varer | n/a — varelager eies av A; B fører uttak fra A sitt lager (dagens modell) | ja |
| B sine utlegg/tillegg-kvitteringer i A sitt prosjektarkiv | i dag ja (`filer.ts:185-222`) — **bør bli nei** (H4) | ja |
| Kostnad B krever av A | via **dokumentflyt** (regningsarbeid/godkjenning), ikke via timer-modulen. Attestering ≠ Godkjenning (låst 2026-04-26). | — |

**Konsekvens for prosjektkortet (36b):** A-prosjektet dukker opp i B-ansattes velger med UE-merke. Byggeplass velges blant **A sine** (eies av `projectId`, § 1.1) — ingen endring i modell. Underprosjekt: B sitt `foringsnivaa` (36d-2) gjelder, men ECO-ene er per `(organizationId, projectId)`; B har bare underprosjekter på A-prosjektet hvis B selv har ProAdm-import mot det. Uten det: «Hele prosjektet» (36d § 3.4). ECO-oppslag må gå på `(valgt firma, projectId)`, aldri `(prosjektets eier, projectId)`.

**Eksport/lønn for B:** rapport-universet utvides fra `primaryOrganizationId == B` til `prosjektTilhørerFirmaWhere(B)` (`rapport.ts:120-126`, `:333-339`). Org-filteret på seddel (`:156`) står. Dermed får B alle egne timer, også på A-prosjekt, og A får fortsatt ingen av B sine.

**Omfang (estimat):**

| Lag | Arbeid | Størrelse |
|---|---|---|
| Migrering | ingen tvingende. Valgfritt: `ProjectOrganization.invitertAvUserId`/`status` for en invitasjonsflyt med aksept | 0 / S |
| API | (a) `prosjekt.inviterDeltakerfirma` for A sin firmaadmin (ny rute, rolle låst til `underentreprenor`); (b) org-filter i `hentTilAttestering`, `hentTilAttesteringFirma`, `hentForAttestering`, `attesterRader`, `attester`, `returner*`; (c) `erProsjektLeder` må også godta firmaadmin/`kanAttestere` i **seddelens** firma; (d) rapport-univers; (e) `erUnderentreprenor()`; (f) org-filter i `hentFirmaAnsatteMedTimer`; (g) prosjektgrense i `tilfoyTilleggRad`/`tilfoyUtleggRad` | M |
| Mobil | `prosjektKatalog` fylles fra eid ∪ deltatt (ny `hentForTimer`-variant med medlemskap, eller `hentMine` + deltakerfirmaer); `prosjektLocal` får `eierOrgId` + `deltakerRolle`; `hentProsjekterLokalt` filtrerer på «tilhører valgt firma»; UE-merke i velger | M |
| Web | invitasjons-UI under prosjektmedlemmer/firma; attesteringsliste filtrert; UE-merke i medlemsliste (B.5) | S–M |
| Tester | isolasjonstester: A-leder får 0 B-sedler; B-admin kan attestere B-rad på A-prosjekt; B-rapport inkluderer A-rad; mobil-velger viser A-prosjekt for B-ansatt | S |

### Alt. 2 — Speilprosjekt: B oppretter eget prosjekt som peker til A sitt

**Idé.** B lager «Skole X (UE for A)» eid av B, med ny kolonne `Project.speilAvProjectId → A-prosjekt`. B fører mot eget prosjekt; alle dagens vakter og rapporter virker uendret.

**Fordeler.** Null endring i timer-API, full isolasjon gratis, B sin rapport virker i dag. Kan i praksis gjøres allerede nå uten kobling (B lager et internt prosjekt) — dette er den faktiske «vent»-løsningen.

**Ulemper.**
- Byggeplass og underprosjekt eies av A sitt prosjekt (§ 1.1); speilet har ingen. Enten dupliseres de (strider mot `arkitektur.md:408` «ingen duplikater», og 36d sier byggeplass/ECO er prosjektets) eller rad-oppslag må krysse prosjekter — det er *mer* kode enn alt. 1, ikke mindre.
- Mannskapsliste på A sin plass mangler B (innsjekk er per `projectId`); HMS-vedtaket (RUH synlig begge steder) brytes.
- To prosjekter per oppdrag i alle lister, dokumentflyt, kontrollplan.
- Løser ikke lesesiden: hullene i § 1.3 står igjen for alle *andre* deltakerfirmaer som allerede kan kobles av sitedoc_admin.

**Rangering: 2.** Egnet som manuell midlertidighet («B lager eget prosjekt»), ikke som målmodell.

### Alt. 3 — B-ansatt blir gjesteansatt i A og fører på A-seddel (FORKASTES)

Krever `OrganizationMember` i A; `hentBrukersOrg` kaster ved to aktive firmaer (`tilgangskontroll.ts:298-303`), seddelen får A sitt `organizationId`, lønn og pris havner hos A. Bryter Kenneths premiss «alle timer tilhører dette firmaet» og `timer.md:1327`.

### Alt. 4 — Timer overføres som dokument fra B til A (komplement, ikke alternativ)

B sender timeliste/regningsarbeid til A via dokumentflyt (push, godkjenning). Dette er **økonomi-sporet** i alt. 1 og finnes allerede som begrep (regningsarbeid, `BACKLOG:4946` UE → HE «Økonomisk krav»). Skal ikke erstatte timeføring.

## 3. Anbefaling

### 3.1 Nå eller vente

**Vent med UE-funksjonen** (invitasjon, mobil-velger, rapport-univers, UE-merke). Begrunnelse: Kenneth sier A.Markussen har kun egne prosjekter; 36b/36c/36d ligger foran i køen; funksjonen er M-størrelse på to lag og trenger invitasjonsflyt-UX som ikke er tegnet.

**Lukk tre hull nå**, uavhengig av vedtak, fordi de er sikkerhetsfeil mot vedtatt isolasjon (`timer.md:1327`) og rammer alle deltakerfirmaer sitedoc_admin allerede kan koble:

- **H1** org-filter i de fire attesteringslesingene og i `attester*`/`returner*` (§ 1.3). Ingen bruker mister noe i dag: ingen deltakerfirma er koblet i prod så vidt docs viser (verifiseres av Kontrollør mot `sitedoc_test`, ikke prod).
- **H2** org-filter i `rapport.hentFirmaAnsatteMedTimer` (`rapport.ts:889-893`).
- **H3** prosjektgrense i `tilfoyTilleggRad`/`tilfoyUtleggRad` (samme `verifiserProsjekterTilhørerFirma` som timer-rad).

Merk «Sikkerhet fritar ikke» (memory): H1 fjerner at A sin prosjektleder kan attestere eksterne rader. Det er ikke dokumentert noe sted at A *skal* kunne det; tvert imot `timer.md:1327`. Flagges likevel som funksjonsendring i leveransen.

### 3.2 Hva som må være klart før bygging av alt. 1

- B3 (hvem inviterer) og B5 (hvem attesterer) i § 4.
- UX for invitasjon: A søker opp firma B (Organization med `erKunde`) — finnes ikke i dag; `OrganizationPartner` (`schema.prisma:550-570`) er et fritekst-bibliotek uten FK til fremmed `Organization` og brukes ikke i kode (0 treff).
- `erUnderentreprenor()` skrives mot `OrganizationMember`, ikke `User.organizationId` (B.5-drift, § 1.4).

### 3.3 Valg i 36b/36d som må gjøres nå for ikke å stenge døren

1. **Prosjektvelger-begrepet er «tilhører firmaet», ikke «eies av firmaet».** All ny 36b-kode går via `hentProsjekterLokalt(orgId)` (`prosjektKatalog.ts:69`) — ett sted å endre. Ingen ny komponent skal sammenligne `prosjekt.organizationId === valgtFirmaId` direkte. `prosjektLocal` bør få `eierOrgId` skilt fra «mitt firma» når UE bygges; 36b trenger ikke kolonnen, men skal ikke bruke `organizationId` som eier-identitet i UI-tekst («Prosjektet eies av …»).
2. **ECO-oppslag på `(valgt firma, projectId)`** i 36d-2/36d-3 — aldri via `project.primaryOrganizationId`. Dagens `eksternKostObjekt.ts:35-41` gjør det rett (krevBrukersOrg). Spec 36d § 3 er forenlig; presiseres der ved neste revisjon.
3. **Byggeplass-oppslag på `projectId`**, aldri på org (eies av A). Dagens `byggeplass`-rute følger prosjektet; 36b må ikke innføre org-filter på byggeplass.
4. **Ingen `organizationId` på rad-nivå** (`SheetTimer`/`SheetMachine`). Firmaet arves fra seddelen; dobbel sannhet ville gjøre UE-isolasjon vanskeligere, ikke lettere. 36d-2 innfører ingen (bekreftet i 36d § 1.1).
5. **Ikke bygg prosjektmedlemsport på `timerTilgangDefault`** i 36b/36d uten å ta med deltatt-firma-tilfellet. Feltet er i dag dødt (§ 1.2 punkt 6); lar det ligge.
6. **Dagsseddel-unikhet `[userId, dato]` beholdes** — én person, ett firma, én seddel. Ikke innfør per-org seddel.

## 4. Spørsmål til Kenneth (B1–B7)

| # | Spørsmål | Anbefaling | Begrunnelse |
|---|---|---|---|
| **B1** | Implementere UE-funksjonen nå eller vente? | **Vente** med funksjonen; **lukke H1–H3 nå** i egen liten leveranse (Kontrollør-gate) | § 3.1. Hullene gjelder uavhengig av UE. |
| **B2** | Målmodell: alt. 1 kryssorg-deltakelse eller alt. 2 speilprosjekt? | **Alt. 1** | Skrivevakten finnes; byggeplass/underprosjekt/mannskap/HMS følger A sitt prosjekt. Speil dupliserer. |
| **B3** | Hvem kobler B til A sitt prosjekt? | **A sin firmaadmin** inviterer (ny rute, rolle låst `underentreprenor`); B aksepterer ikke — B sine ansatte ser bare prosjektet dukke opp | Enkleste flyt; A eier prosjektet og bestemmer hvem som deltar. Aksept-steg kan legges til senere. |
| **B4** | Hva skal A se av B? | **Kun mannskapsliste uten klokkeslett** (finnes) + antall personer. Ingen timetall, maskintimer, lønnsart eller pris. Kostnad via dokumentflyt. | Kenneths premiss «adskilt økonomi»; Attestering ≠ Godkjenning. |
| **B5** | Hvem attesterer B sine rader på A-prosjektet? | **B**: firmaadmin i B eller `kanAttestere` i B sitt prosjektmedlemskap — aldri A | Krever at `erProsjektLeder` også ser på seddelens firma (API-punkt c). I dag kan B sin admin *ikke* attestere disse radene — en feil i dagens kode. |
| **B6** | Underprosjekt for UE-rader? | **Ingen i første versjon** («Hele prosjektet»); byggeplass fra A | B har bare ECO på A-prosjekt hvis B har ProAdm mot det. Åpnes senere uten skjemaendring. |
| **B7** | Skal B sin lønnsrapport/eksport ta med rader på A sitt prosjekt? | **Ja** — rapport-univers = eid ∪ deltatt | Det er B sine timer og B sin lønn. Dagens asymmetri (`timer.md:677`) er en feil, ikke et vedtak. Kan gjøres sammen med H1–H3 eller vente til UE. |

## 5. Hull funnet underveis (noteres, løses ikke her)

| # | Hull | Kilde | Alvor |
|---|---|---|---|
| ~~H1~~ 🟡 | ~~Attestering ikke firma-isolert (4 lesinger + attester/returner) — A ser og attesterer B sine sedler inkl. prissnapshot~~ — lukket på `fix/firmagrense-attestering` ([sikkerhet.md § 8n](sikkerhet.md)) | `dagsseddel.ts:3458-3462`, `:3568-3573`, `:3797-3808`, `:4128-4129`, `:4176-4184` | Høy (pris + lønn lekker på tvers av firma) |
| ~~H2~~ utgått | ~~`hentFirmaAnsatteMedTimer` uten org-filter — navn/e-post på fremmede ansatte~~ — kontaktinfo deles (Kenneth 2026-11-08); ansattnummer kun fra eget firma | `rapport.ts:889-893` | Middels (persondata) |
| ~~H3~~ 🟡 | ~~`tilfoyTilleggRad`/`tilfoyUtleggRad` uten prosjektgrense~~ — lukket, samme branch | `dagsseddel.ts:2903`, `:3170` | Middels |
| H4 | Prosjektarkiv tar med fremmede firmaers kvitteringer | `services/eksport/filer.ts:185-222` | Lav–middels; beslutning (B4) |
| H5 | B sin rapport mangler rader på deltatte prosjekter | `rapport.ts:120-126` | Middels for B (feil lønnsgrunnlag) — B7 |
| H6 | `timerTilgangDefault` og `maskinbrukTilgangDefault` dødt i runtime | `schema.prisma:382-384`, 0 treff i timer-ruter | Lav (dokumentert i `historikk-2026-05.md:3661`) |
| H7 | Mobil og web har ulik prosjektregel (medlem ∧ eid vs eid ∪ deltatt) | `prosjektKatalog.ts:69-82` vs `prosjekt.ts:74-86` | Lav nå, blokkerer UE |
| H8 | Docs-drift: B.5 og `terminologi.md:174` viser til `User.organizationId` / `OrganizationProject` som ikke finnes | `fase-0-beslutninger.md:1223`, `terminologi.md:174` | Docs |
| H9 | `erUnderentreprenor()` vedtatt (B.5) men ikke bygget | `terminologi.md:220` | Blokkerer UE-merke og lønnseksport-filter |

## 6. Ut av scope

- Dokument-/sjekkliste-deling mellom prosjekter (kryssprosjekt-deling, memory DRØFTES) og RUH-telling hos innleid firma (`BACKLOG:1429`) — egne specs.
- Fakturering B → A (beløp, påslag) — dokumentflyt/økonomi, ikke timer.
- Multi-firma-ansatte (`hentBrukersOrg` kaster) — O-4 primær-org, egen sak.
- Varelager for UE (B sine varer på A sin plass) — varelager eies av prosjekteier i dag; ikke berørt av UE-timer.

# Måling M2 — skall-firma (faggruppe lagret som Organization)

**Status:** måling, ingen kode endret. Base `origin/develop` @ `f7a277d3`. Målt 2026-11-26 av web-timer-o13.
**Data:** `sitedoc_lokaltest` (kopi av `sitedoc_test` 26.11), kun lesing. Prod er ikke målt av agenten; spørringer for Kenneth står i § 5.

**FASIT (Kenneth 2026-11-26):** «her er det fulstendig kaos på hva som er faggruppe og hva som er firma» · «det kan være hele årsaken til at vi ikke klarer å knytte data rett» · «koden må ryddes opp for slike tvetydigheter».

---

## 0. Kort svar

1. **Ingen vei i UI lager skall-rader i dag.** Den eneste API-veien er `organisasjon.opprett` (`apps/api/src/routes/organisasjon.ts:247-260`). Den setter ikke `erKunde`, er sperret til `sitedoc_admin` og har ingen kaller i web eller mobil. Integrasjonstestene lager skall-rader fordi kolonnen har default `false` (`schema.prisma:120`).
2. **Skall-radene i test er historiske.** De fire radene har håndlagde id-er `f1000001-…-0001/3/4/5`, er fra 2026-04-06 og finnes ikke i seed-koden. Migreringen `20260503000001_add_organization_er_kunde` satte `er_kunde=false` på dem.
3. **Kenneths tre symptomer skyldes ikke skall-firma** (§ 4). Målt: prod har 0 skall-rader. Kenneths testbruker har ett medlemskap, i et kundefirma. Alle 38 sedler i test ligger på kundefirma. Rotårsakene er funnet i M1 (`maaling-timerad-livslop.md`, R1–R4) og er uavhengige av firma.
4. **Tvetydigheten er likevel reell**, og den gir andre feil. Tre ting kan i dag bety «firmaet bak faggruppen» (§ 1). «Brukerens firma» finnes på minst seks måter, og ingen av dem skiller ut skall-rader (§ 2C). Opprydningsplanen står i § 3.

---

## 1. Datamodellen i dag (målt)

| Begrep | Tabell / modell | Peker til firma via | Målt i test |
|---|---|---|---|
| **Firma (kunde)** | `organizations`, `erKunde=true` | — | 3 rader: SITEDOC MYRHAUG, Demo Bygg AS, Testfirma AS |
| **Skall-firma** | `organizations`, `erKunde=false` | — | 4 rader (Byggherre, Tømrer Hansen, Elektrikker Hansen, Hovedentreprenør) |
| **Faggruppe** | `Faggruppe` → `dokumentflyt_parts` (`schema.prisma:870/907`) | `partnerId` → `OrganizationPartner` (`:874`), eller fritekst `companyName` / `organizationNumber` | 16 faggrupper, **0 med `partner_id`**; 2 med `company_name` («Elektrikker hansen», «Tømrer Hansen») |
| **Partnerbibliotek** | `OrganizationPartner` → `organization_partners` (`:559`), eid av et kundefirma | — | **0 rader** |
| **Prosjekt ↔ firma** | `projects.primary_organization_id` (eier) + `project_organizations` (kobling med `rolle`) | — | Røstbakken: eier = SITEDOC MYRHAUG, men eneste kobling = **Hovedentreprenør (skall)**, rolle `hovedentreprenor` |
| **Medlemskap** | `organization_members` (eneste modell; `User.organizationId` er droppet i O5c) | — | 22 aktive medlemskap i skall-rader; ingen av de 22 brukerne har medlemskap i et kundefirma |

Det faggruppen skulle peke på (`OrganizationPartner`) er tomt. Navnet på firmaet bak faggruppen står i stedet tre steder: som skall-`Organization`, som fritekst på faggruppen og som `project_organizations`-kobling. Ingen av dem er koblet til de andre.

### Hva skall-radene bærer (test)

| Tabell | Rader på skall-firma |
|---|---|
| `organization_members` | 22 (alle `aktiv`, `ansatt`, opprettet 2026-05-12) |
| `organization_settings` | 4 (bakfylt for alle firma av `20260501000002_add_organization_settings/migration.sql:44-49`) |
| `project_organizations` | 1 (Hovedentreprenør ↔ Røstbakken) |
| Alle andre 26 tabeller med `organization_id` (timer.*, maskin.*, varelager.*, avdelinger, moduler, oppmøtesteder …) og `projects.primary_organization_id` | **0** |

Blant de 22 er `kemyrhau3@gmail.com` (Hovedentreprenør) og `kemyrhau4@gmail.com` (Tømrer Hansen).

---

## 2. Inventar (kodeveier)

### A. Oppretter `Organization`

| fil:linje | Rute / funksjon | Setter `erKunde` | Utløses fra |
|---|---|---|---|
| `apps/api/src/routes/organisasjon.ts:247-260` | `organisasjon.opprett` | **Nei → false (skall)** | Ingen kaller i web/mobil. Kun `sitedoc_admin`. |
| `apps/api/src/routes/admin.ts:411-431` | `admin.opprettOrganisasjon` | Ja, `true` (`:427`) | Web Admin → Firmaer → «Opprett firma» (`admin/firmaer/page.tsx:66`) |
| `packages/db/prisma/seed-helpers.ts:24-36` | `finnEllerOpprettDemoFirma` (upsert) | `true` ved create; `update: {}` retter ikke en eksisterende rad | `seed.ts`, `seed-agent-mobil-test.ts`, `test-harness/seed.ts` |
| `packages/db/scripts/seed-testbrukere.ts:29-31` · `seed-timer-demo.ts:248-255` · `apps/api/scripts/roykt-grense.ts:67` | skript | `true` | CLI |
| ~50 `*.integration.test.ts` | tester | Nei (default) | Kun tester |

Faggruppe-, partner-, dokumentflyt- og invitasjonsflytene oppretter **ingen** `Organization`.

### B. Leser eller skiller på `erKunde`

| fil:linje | Hva | Filtrerer bort skall? |
|---|---|---|
| `admin.ts:145` `hentAlleOrganisasjoner` | Admin-firmaliste, «nytt prosjekt»-nedtrekk | **Ja** |
| `organisasjon.ts:136-140` `hentTilgjengelige` | Firmavelger | Kun i `sitedoc_admin`-grenen; firma_admin-grenen (`:154-158`) **nei** |
| `organisasjon.ts:184-235` `hentMineMedlemskap` | Web `firma-kontekst`, mobil `FirmaKontekst`/`FirmaVelger` | Kun `sitedoc_admin`. Vanlig bruker (`:212-235`) og fallback via `primaryOrganizationId` (`:197-211`): **nei**, og heller ikke på `status` |
| `trpc/tilgangskontroll.ts:972-990` `krevErKundeFirma` | Gate | Ja, men eneste kaller er `maskin/import.ts:35` |
| `medlem.ts:283-302` `registrer` | Autorisasjon: skall-firma → ingen ekstra sjekk | Skiller, men slipper skall **lettere** gjennom |
| `medlem.ts:756-793` `endreFirma` | Regeltabell på fra/til-firmaets `erKunde` | Skiller |
| `medlem.ts:690-721` `hentProsjektFirmaer` | Web `PersonKort.tsx:160-164` «Endre firma» | **Nei** — skall og kunde i samme nedtrekk, uten merke |
| `services/firmaOversikt.ts:19` `klassifiserFirmaStatus` | Visning | Ignorerer argumentet, returnerer alltid «kunde» |
| `web/kontekst/firma-kontekst.tsx:23`, `mobile/kontekst/FirmaKontekst.tsx:100` | Kun type | Leses aldri |

### C. Finner «brukerens firma»

| fil:linje | Kilde | Skall mulig? | Ved flere aktive medlemskap |
|---|---|---|---|
| `tilgangskontroll.ts:293-306` `hentBrukersOrg` | `organization_members`, `status=aktiv` | **Ja** (eneste aktive rad returneres) | Kaster BAD_REQUEST «Bruker tilhører flere firmaer» |
| `tilgangskontroll.ts:313` `krevBrukersOrg` | som over | Ja | som over |
| `tilgangskontroll.ts:330-345` `resolverOrgFraInput` | Input, men kaller `hentBrukersOrg` også når input er gitt (ikke-admin) | Ja | Kaster selv med riktig input |
| `tilgangskontroll.ts:361-368` `resolverOrgForEgenTimeføring` | Input + `erAnsattIFirma`; ellers `krevBrukersOrg` | Ja | Kaster uten input |
| `tilgangskontroll.ts:1820-1826` `harOrgRolle` | `findFirst` uten status, `erKunde` eller sortering | Ja | Tilfeldig rad |
| `bruker.ts:30-46` `bruker.hentMin` | Første aktive fra usortert `findMany` | Ja | Tilfeldig rad |
| `admin.ts:871` `hentImpersoneringStatus` | `findFirst`, usortert | Ja | Tilfeldig rad |
| `medlem.ts:100-111` medlemsliste | eierfirma → nyeste aktive → eldste | Ja | Deterministisk |
| `prosjekt.ts:421-471` `prosjekt.opprett` | `hentBrukersOrg` ubetinget | **Ja — prosjektet får skall som eier** | Kaster selv med `input.organizationId` |
| Web `firma-kontekst.tsx:84-93` | admin: localStorage; ellers 1 firma_admin-firma → 1 medlemskap → **null** | Ja | `valgtFirma = null` |
| Mobil `FirmaKontekst.tsx:177-191` + `FirmaVelger.tsx` | `hentMineMedlemskap`; brukeren velger | Ja, uten merke | Brukeren velger fritt |

Øvrige kallere av `hentBrukersOrg`: `medlem.ts:252/278/642/1089`, `organisasjon.ts:265/877/971`, `kompetanse.ts:157`, `maskin/ansvarlig.ts:83`, `maskin/service.ts:46`, `maskin/equipment.ts:83/90/109`, `admin.ts:954`, og i `tilgangskontroll.ts:1171/1614/1867/1874/1947` (dokument-tilgang, `byggTilgangsFilter`, kompetanse, maskinansvar).

### D. Timer, lønnsart og innstillinger — kan de havne i skall?

| Vei | `organizationId` kommer fra | Skall-only bruker | Bruker med kunde + skall |
|---|---|---|---|
| Web Mine timer / Ny dagsseddel (`timer/mine/page.tsx:122`, `timer/ny/page.tsx:79`) | `valgtFirma?.id`, ellers server-fallback | Server løser til skall → `krevTimerAktivert` (`services/timer/moduleGate.ts:32`) sperrer (skall har ingen timermodul) | `valgtFirma=null` → `dagsseddel.list` / `kanFoereTimer` / `opprett` / `prosjekt.hentForTimer` kaster «flere firmaer» |
| Firmaadmin lønnsart/tillegg/aktivitet/onboarding (`lonnsart.ts:30`, `tillegg.ts:27`, `aktivitet.ts:25`, `onboarding.ts:34`, `expenseCategory.ts:50/114`) | `valgtFirma.id` via `resolverOrgFraInput` | Skall (tom katalog) | Kaster |
| Mobil katalog `timerKatalog.ts:75-82` | **Ingen** `organizationId` → `krevBrukersOrg` | **Tomme kataloger** | Hele katalog-henten feiler (cache beholdes) |
| Mobil `syncBatch` / `pushEnSedel` (`dagsseddel.ts:11119/11322`) | Lagret firma-id fra `FirmaVelger` | Stoppes av `krevTimerAktivert` | Brukeren kan velge skall i velgeren → stoppes |
| `organisasjon.hentSetting` (`:1150-1160`), `hentArbeidstidDefaults` (`:1290-1300`) | Gitt org | **Upserter innstillingsrad for skall ved lesing** | — |
| Eksisterende sedel (`timer/[id]/page.tsx`, `dagsseddel.ts:663/820/5083 …`) | `sheet.organizationId` | — | — (låst ved opprettelse) |

**Målt i test:** 0 brukere har mer enn ett medlemskap. 0 sedler, lønnsarter, tillegg eller aktiviteter ligger på skall-firma. Feilene i D-tabellen kan derfor ikke ha rammet en sedel i test.

### E. Opprettes automatisk mot vilkårlig firma

- `organization_settings`: bakfyll-migreringen over, pluss upsert ved lesing (`organisasjon.ts:1150`, `:1290`, `:1362/1474`).
- `project_organizations`: `prosjekt.ts:471` (kan bli skall via fallback), `admin.ts:482` `tilknyttProsjekt` (vilkårlig org), `admin.ts:536`, `organisasjon.ts:508`.
- `organization_members`: `medlem.ts:379` `registrer` — ikke-admin-grenen tvinger `organizationId` til **innbyderens** `hentBrukersOrg`. En firmaansvarlig i et skall-firma melder dermed inn nye folk i skallet. Web-kallere: `OpprettKontaktModal.tsx:122/157`, `dokumentflyt-komponenter.tsx:316`, `PersonKort.tsx:141`. Videre `medlem.ts:844` `endreFirma` (til-firma kan være skall) og `organisasjon.ts:899/931` `inviterBruker`.
- Historisk kilde: `packages/db/scripts/backfill-organization-members.ts:15-40` kopierte alle gamle `User.organizationId` til medlemskap uten `erKunde`-filter.
- `admin.settBrukerOrganisasjon` (`admin.ts:452-468`) skriver `user.organizationId`, som ikke finnes lenger. Den har ingen kaller og er død kode (ikke kompilert/kjørt i denne målingen).

---

## 3. Opprydningsplan

### Prinsipp (vedtaket, uendret)

- **Firma** = `Organization` med `erKunde=true`. Det eier prosjekter og firmamoduler og har ansatte (`organization_members`).
- **Faggruppe** = `Faggruppe` (`dokumentflyt_parts`), alltid pr. prosjekt. Firmaet bak faggruppen er en `OrganizationPartner` i eierfirmaets partnerbibliotek (`partnerId`). En faggruppe er **aldri** en `Organization`.
- Personer i en faggruppe er prosjektmedlemmer (`ProjectMember` + `group_faggrupper`). De er **ikke** ansatte i et firma bare fordi de deltar i dokumentflyten.

### Før / Nå

| | Før (i dag) | Nå (etter plan) |
|---|---|---|
| Ny `Organization` | Kan bli skall (default `false`, `organisasjon.opprett`) | Alltid kunde; skall kan ikke opprettes |
| «Brukerens firma» | 6+ veier, ingen filtrerer skall, tre av dem tilfeldig rekkefølge | Én resolver: aktive medlemskap i kundefirma, deterministisk |
| Firmavelger web/mobil, «Endre firma» | Viser skall-firma uten merke | Viser kun kundefirma |
| Innmelding via faggruppe-flyt | Kan melde inn i innbyderens skall-firma | Avvises hvis innbyderens firma ikke er kunde |
| Prosjekt-kobling | `tilknyttProsjekt` tar vilkårlig org; Røstbakken er koblet til et skall | Kun kundefirma kan kobles |
| Firmaet bak faggruppen | Skall-org / fritekst / ingenting | `partnerId` → `OrganizationPartner` (egen ordre, se steg 4) |

### Steg 1 — kode, ingen migrering (web + api + mobil-OTA)

1. **Én resolver for brukerens firma.** `hentBrukersOrg`, `hentMineMedlemskap` (vanlig bruker + fallback), `bruker.hentMin`, `harOrgRolle` og `hentImpersoneringStatus` filtrerer `organization: { erKunde: true }` og `status: "aktiv"`. Rekkefølgen er deterministisk (samme regel som `medlem.ts:100-111`).
2. `hentProsjektFirmaer` og `hentTilgjengelige` (firma_admin-grenen) filtrerer `erKunde: true`. Da forsvinner skall fra «Endre firma» og fra mobilens `FirmaVelger`.
3. `medlem.registrer` (ikke-admin-grenen) og `prosjekt.opprett` krever at innbyderens/skaperens firma er kunde (`krevErKundeFirma`). `prosjekt.opprett` kaller ikke `hentBrukersOrg` når `input.organizationId` er gitt.
4. `admin.tilknyttProsjekt` og `organisasjon.leggTilProsjekt` krever kundefirma.
5. `organisasjon.hentSetting` / `hentArbeidstidDefaults` upserter ikke for skall-firma (returnerer default uten å skrive).
6. Fjern `organisasjon.opprett` (ingen kaller) og `admin.settBrukerOrganisasjon` (død). Ingen klient bruker dem, så alias-regelen (1 uke) gjelder ikke.

**Hva brukeren ser:** i prod ingenting, fordi prod har 0 skall-rader (forutsatt at § 5 bekrefter det). I test mister de 22 skall-medlemmene firmaet sitt og blir som de 7 brukerne som allerede er uten firma: de ser prosjektene de er medlem av, men ingen firmameny og ingen Timer. Det er det samme som i dag for Timer, siden skall-firmaene ikke har timermodul.

### Steg 2 — additiv migrering (to-stegs, ingen sletting)

- `ALTER TABLE organizations ALTER COLUMN er_kunde SET DEFAULT true` (Prisma: `@default(true)`). Integrasjonstester som i dag lager skall ved et uhell, lager kunde.
- Ingen rader endres, ingen kolonner droppes. Prod: ingen synlig endring.

### Steg 3 — testdata (kun `sitedoc_test`, SQL som Kenneth kjører)

De fire skall-radene slettes **ikke** (arkitektur.md § Schema- og migreringsregler):
- De 22 medlemskapene settes `status='deaktivert'`, `deaktivert_ved=now()`. Prosjektmedlemskap og faggruppe-tilhørighet røres ikke.
- Koblingen Hovedentreprenør ↔ Røstbakken (`project_organizations`) blir stående som historikk; steg 1 punkt 4 hindrer nye. Ønskes Røstbakken koblet til eierfirmaet, er det en egen kobling SITEDOC MYRHAUG ↔ Røstbakken (`hovedeier`), som også mangler i dag.
- `kemyrhau3`/`kemyrhau4`: se SPØRSMÅL.

Avhengighet: steg 3 er bare kosmetisk etter steg 1 (koden ser ikke skall lenger), men gjør tabellene ærlige.

### Steg 4 — firmaet bak faggruppen (egen ordre, ikke del av denne)

`partnerId` er satt på 0 av 16 faggrupper, og `organization_partners` er tom. Å bakfylle partnere fra `company_name`/`organization_number` er en egen leveranse med egen backfill-garanti («stille tomhet er forbudt»). Den nevnes her fordi det er der tvetydigheten til slutt må løses.

### Endres IKKE

- `Faggruppe`-modellen, dokumentflyt, `group_faggrupper`, prosjektmedlemskap.
- `erKunde`-kolonnen beholdes (drop vurderes først når § 5 viser 0 skall i alle miljø og steg 1 har stått en release).
- Eksisterende sedler (`sheet.organizationId` er låst ved opprettelse).
- Multi-firma-støtte (BAD_REQUEST «flere firmaer») er en egen sak (O-4 primær-org); steg 1 fjerner bare skall som årsak til den.

---

## 4. «Kan være hele årsaken» — svar pr. symptom

| Symptom (Kenneth) | Skyldes skall-firma? | Måling | Rotårsak |
|---|---|---|---|
| Raden «borte» | **Nei** | Prod: 0 skall-rader (Kenneth 26.11). Test: `kemyrhau@gmail.com` har ett medlemskap (SITEDOC MYRHAUG, `er_kunde=t`), og alle 8 sedlene hans ligger der. 0 sedler i test på skall-firma. Ingen bruker har flere medlemskap. | M1 R1 (skjermen leses ikke på nytt etter delvis lagring, `JobbSkjema.tsx:316-327`) og R2 (endring under lagring droppes, `:330/395/416`) |
| Overtid regnes ikke ut | **Nei** | Lønnsartene leses fra `sheet.organizationId`; 0 lønnsarter på skall-firma; sedlene ligger på kundefirma | M1 R3: `foreslaOvertidSplitt` gir `[]` både under normen og over normen uten art med `overtidsnivaa` (`overtidForslag.ts:115/117`) |
| «Gammelt kort» | **Nei** | Kort-id er sedel-intern og uavhengig av firma | M1 R1 + O27 (sedler slettet på PC kom tilbake via `syncBatch`, rettet i `0b4aee5f`) og M1 R4 (tillegg/maskin/utlegg uversjonert ved synk) |

**Der skall-firma faktisk gir feil** (målt i kode, ikke observert hos Kenneth): skall-only brukere får tomme kataloger på mobil og havner i skall-firmaet i velgeren; en firmaansvarlig i et skall-firma melder nye folk inn i skallet; `prosjekt.opprett` kan gi et prosjekt skall-eier; og «Endre firma» blander skall og kunde. Dette rammer testmiljøets 22 skall-brukere, ikke Kenneths egen konto.

---

## 5. Prod-spørringer (Kenneth kjører, kun lesing)

```sql
SELECT er_kunde, count(*) FROM organizations GROUP BY 1;
SELECT count(*) AS brukere_flere_aktive FROM (SELECT user_id FROM organization_members WHERE status='aktiv' GROUP BY user_id HAVING count(*)>1) x;
SELECT count(*) AS koblinger_til_skall FROM project_organizations po JOIN organizations o ON o.id=po.organization_id WHERE NOT o.er_kunde;
SELECT count(*) AS faggrupper, count(partner_id) AS med_partner, count(company_name) AS med_firmanavn FROM dokumentflyt_parts;
SELECT count(*) AS prosjekter_uten_eierkobling FROM projects p WHERE p.primary_organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM project_organizations po WHERE po.project_id=p.id AND po.organization_id=p.primary_organization_id);
```

Forventet hvis prod er ren: `t | 4`, `0`, `0`, ukjent, ukjent. Linje 2 > 0 betyr at noen i prod får «Bruker tilhører flere firmaer» i Timer i dag. Det er da en egen sak, uavhengig av skall.

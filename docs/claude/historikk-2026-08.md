---
name: historikk-2026-08
description: Arkiv av deployete PR-er/saker fra august 2026. Flyttet hit fra STATUS-AKTUELT ved DEPLOYET TIL PROD.
sist_verifisert_mot_kode: 2026-08-07
---

# Historikk august 2026

## Prod-deploy 2026-08-28 (`ba234fd1`, develop→main) — 26 commits, 6 spor: registreringsmodell fase 1 + fundament + slettevakter (LIVE)

Verifisert innlogget på sitedoc.no. `/version` → `ba234fd1`, `byggTid 2026-08-28T13:55Z`.

**🔴 Første prod-release som kan FRATA noen tilgang.** `OrganizationMember.status` er ny og styrer 11 prosjekt-porter. Deaktivering er manuell — ingen eksisterende ansatt endret status ved deploy (migreringen er additiv med default `aktiv`).

**Migrering:** `20260828120000_organization_member_status` (tre `ADD COLUMN`, ren additiv). `db-timer`/`db-maskin`/`db-varelager`: ingen ventende.

### Sporene

**1. Ansatt-status-guard — registreringsmodell fase 1** (`ea6a9d8d`). Hullet: en ansatt som sluttet beholdt tilgang til alt; `ProjectMember.periodeSlutt` var inert og guarden leste bare rad-eksistens. Fiks ved porten: `krevAktivAnsettelse` i alle 11 prosjekt-porter i `tilgangskontroll.ts` (etter sitedoc_admin-, før firma-admin-bypass) + `status:"aktiv"` i `hentBrukersOrg` — én linje som dekker hele firma-nivået inkl. timeføring og samtidig løser multi-org-kastet. `prosjekt.hentAlle`/`hentSistBrukte` skjuler prosjekter eid av deaktivert org. Mutasjon `organisasjon.settAnsattStatus` (firmaadmin, lockout-guard, sitedoc_admin skjermet), varig spor i `Activity`. Web: deaktiver-modal, «Vis sluttede»-filter, «Sluttet»-merke, aktiver-igjen. **Åpen oppfølger i BACKLOG:** deaktivert firma-admin beholder admin-rettigheter.

**2. Ansattvelger** (`97102d2f` + `9630a8a3`). «+ Legg til» på en flytrolle åpnet kun e-postinvitasjon for folk som allerede var ansatt. Ny delt `services/ansatt.ts`: `aktivAnsattIFirmaWhere` (status + `canLogin`) samler kandidatregelen som var håndskrevet flere steder — og rettet en reell bug: `hentLedigeFirmaBrukere` manglet `status`, så en deaktivert ansatt var valgbar. `sikreProsjektmedlemmer` deles av `medlem.leggTilEksisterendeMange` + `dokumentflyt.leggTilAnsatteIRolle`. Ny gjenbrukbar `AnsattVelgerModal` (ansatte + avdelinger, «gir tilgang til N personer») på to flater. `9630a8a3` var etterslep: `IKKE_SLETTET` spredt inn i et `Dokumentflyt`-oppslag på en modell uten `deletedAt` — typecheck fanger det ikke ved spread.

**3. Fundament ut av gruppemodul + flytvelger merker** (`b5cae541`). Kenneth-vedtak: *«sjekklister og oppgaver skal alltid være en del av prosjekt — uten dette faller grunnlaget bort. Tegninger er også automatisk en del av grunnlaget. 3D skal være ekstra feature.»* `kreverGruppemodul` fjernet fra sjekklister/oppgaver/tegninger; **3D beholder sin**. Målt trygt: ledd 6 gatet kun klienten, ingen api-rute leser `group.modules`; lagrede verdier røres ikke. Flytvelgeren MERKER nå folk som alt står i en rolle (amber rolle-chip, scopet per flyt) i stedet for å utelate dem — Kenneths innvending om at et menneske «forsvinner fra listen». Ni-ledds-stigen fra «ansatt» til «ser Sjekklister» skrevet inn i [arkitektur.md § Stigen](arkitektur.md).

**4. Slettevakter — tre falske «nei»** (`dca9c382`). (a) Malobjekt kunne ikke slettes: vakten talte soft-slettede dokumenter (manglet `deleted_at IS NULL`) og brukte `data ?|`, som tester JSONB **nøkkel-eksistens** — og klienten auto-lagrer `{verdi:null,kommentar:"",vedlegg:[]}` så snart et dokument åpnes, så ethvert *åpnet* dokument talte som bruk. Nytt delt predikat `harFaktiskInnholdForObjekt` brukt av både klient-sjekk og server. (b) «Objektet kom tilbake etter refresh» var samme rot — klient tillot, server nektet, optimistisk fjerning rullet stille tilbake; nå vises serverens melding. (c) Oppretter kan slette eget utkast: serveren tillot det alt, klienten skjulte knappen.

**5. Deaktivert bruker på dyplenke** (`728d11fe`). Forklaringen løftet til `dashbord/layout.tsx` — ett punkt høyt i treet som dekker både dashbord og alle prosjekt-ruter, i stedet for N steder. **Kun deaktivert-tilfellet:** en aktiv bruker som mistet ett prosjekt får bevisst «ikke funnet», fordi «du mistet tilgangen» ville lekke at prosjektet finnes til en URL-gjetter.

**6. Død kode** (`f4e78114`). `@xenova/transformers` fjernet (0 kildebruk). Den dro `sharp@0.32.6`, som lastet `libvips` fra GitHub ved HVER `pnpm install` og feilet både 27.08 på test og 28.08 midt i en prod-release. Lockfile −347 linjer. Seks kommentarer som pekte på slettede `verifiserFlytRolle` omskrevet.

### Lærdom fra selve deployen

**`deploy-prod.sh` printet migrate-linja for kun `@sitedoc/db`, og etter `up`.** Begge er rettet i skriptet samme dag. Det var den linja som lot en `db-timer`-migrering fra 11. august ligge ukjørt i prod i to uker, og den ville gjentatt seg her. Ny regel i [deploy-detaljer.md](deploy-detaljer.md): **spør databasen, ikke diffen** — kjør `migrate deploy` for alle fire db-pakker hver gang, og **før** `up` (ny kode mot gammelt skjema gir 500 i vinduet mellom).

**Merge-treet trenger `prisma generate` når et schema er rørt.** Gaten stoppet releasen på `TS2353: 'status' does not exist in OrganizationMemberWhereInput` — utdatert generert klient i `SiteDoc-merge`, ikke en kodefeil. Samme rot som `Cannot find module '.prisma/timer-client'` tidligere samme dag.

## Printmotor fase 3 + 4 — i prod siden `5dcdeb58` (2026-08-28 06:23), arkivert 28.08

Lå feilaktig som «PÅ TEST / Ingen prod» i STATUS-AKTUELT. `eddc118b` (fase 4) og `17fd66f6`
(fase 3) er forfedre av `5dcdeb58`. ⚠️ **Åpen rest i [BACKLOG](BACKLOG.md):** pdf-render-
containeren er ikke bygget, så `landscape` (liggende Fakturagrunnlag) virker ikke ennå.

### 🟢 Printmotor fase 4 — byggherredokumentet (branch `feat/eksport-fase4-byggherredokument`, MERGET develop `eddc118b`) — PÅ TEST, gatet

config v2 (JSONB, **ingen migrering**) med fire nye akser: `mottaker`/`gruppering`/`orientering`/`topptekst`; v1-rader leses med v1-defaults (ingen atferdsendring). **`mottaker=ekstern`** fjerner status STRUKTURELT (Excel Detaljer + Sammendrag, PDF) + ID (Excel) — regel, ikke avhuking, ingen overstyring; redigereren viser noten «Ekstern — interne kolonner utelatt». **`gruppering`** (ingen/ansatt/prosjekt) via ny delt `grupperDetaljRader` i `@sitedoc/shared` som **pakker** `byggDetaljRader` (rører den aldri) — subtotal pr. gruppe + grand total, SUBTOTAL(109) i Excel (ingen dobbelttelling), samme funksjon i PDF. **`orientering`** (auto/staaende/liggende) — auto → liggende når beskrivelse med; avledet server-side, sendt som `landscape` til pdf-render. **`topptekst`** ({firma}/{periode}/{prosjekt} flettes server-side). Innebygde: **Lønnsgrunnlag** (intern·ansatt) + **Fakturagrunnlag** (ekstern·prosjekt·liggende·firmatopp) aktivert ved siden av Full eksport — ett-klikk + Rediger. i18n 19 nøkler × 15 språk. 🔴 **pdf-render-containeren fikk valgfri `landscape`-param (default false → arkiv uendret) — DELT MED PROD, eget deploy-steg Kenneth gater; liggende virker ikke før den er bygget.** Grønt: typecheck shared/pdf/api/web, test shared 551 / pdf 80 / web 189, lint (mine filer). Detaljer: [timer.md § Fase 4](timer.md) · [printmotor-faser](delplaner/printmotor-faser-2026-08-25.md). **Ingen migrering. Ingen prod.**

### 🟢 Printmotor fase 3 — lagrede utskriftsmaler (branch `feat/eksport-fase3-lagrede-maler`, MERGET develop `17fd66f6`) — PÅ TEST

Ny tabell `EksportOppsett` (`db-timer`, migrering `20260827120000_eksport_oppsett` — **additiv, gatet av Kenneth, ikke kjørt på test/prod**), router `timer.eksportOppsett` (list/lagre/oppdater/slett), fase-2-modalen fikk lagringsknapper (Lagre / Lagre som min / Lagre som firma / Slett) + maler-velger i eksport-menyen (Mine · Firmaets · Innebygd «Full eksport» · Ny). To nivåer via nullable `eierId` (firma/personlig), `basertPaId` med SetNull i slett-prosedyren. i18n 14 nøkler → 15 språk. **Kun én innebygd** («Full eksport») — Lønnsgrunnlag/Fakturagrunnlag venter på grupperings-fase 4. **+ To defektrettinger fra fase-2-output (samme runde):** (1) status-verdiene (`pending`/`sent`) oversettes nå i Excel+PDF via delt `STATUS_I18N`-mapping; (2) klokkeslett `Fra`/`Til` (`SheetTimer.fraTid`/`tilTid`) tatt inn i `byggDetaljRader` → begge formater. Grønt: typecheck 11/11, shared 547 / pdf 80 / web 189, lint (mine filer). Detaljer: [timer.md § Fase 3](timer.md) · [printmotor-faser](delplaner/printmotor-faser-2026-08-25.md). **Ingen prod.**

## Arkivert 2026-08-28 — fjorten spor som lå som «venter gate», men var i prod

Målt mot git: alle fjorten er forfedre av `origin/main`. De sto i STATUS-AKTUELT som «PÅ
BRANCH, venter dual-review / Kenneths gate / Ingen prod». Innslagene er flyttet hit ordrett;
åpne restanser og ubesvarte gater er høstet ut til STATUS-AKTUELT § Åpne gater og restanser.

### 🔴🟢 Prosjektfilter-lekkasje rad-nivå — bug-fiks (branch `fix/rapport-prosjektfilter-radniva`, fra develop) — PÅ BRANCH, venter Kenneths gate

**Datakorrekthet, prioritert foran husk-konfig.** Kenneth filtrerte på Fjordgata 12 og fikk 6 t Sentrumsparken med i PDF-en (skjerm 129 = 123+6). Årsak: `firmaPeriodeRapport` + `detaljEksport` valgte sedler med `timer.some.projectId in prosjektIder`, men `include`-en trakk ALLE rader på sedelen uten rad-filter → split-sedler (P1+P2) lekket. Fiks: rad-nivå-`projectId`-filter på alle fire relasjoner (timer/tillegg/maskin/utlegg) i begge spørringene, **kun når `input.prosjektId` er satt** (bevarer kryss-prosjekt-rader utenfor firmaet ved ingen filter). Sedel-valg + `statusFordeling` (per-sedel) urørt — `antallSedler` teller fortsatt sedler som berører prosjektet. Grønt: typecheck api/shared/pdf/web, test 4/4 tasks, lint. Detaljer: [timer.md § Prosjektfilter rad-nivå](timer.md). **Ingen migrering. Ingen prod.** `fix/eksport-husk-konfig` er PAUSET (WIP `bbd62ba0` på egen branch, ikke pushet).

### 🟢 Fase 4-oppfølger — ekstern-lekkasjer + sist brukt (branch `fix/eksport-ekstern-ansattnr-maskinmerke`, fra develop) — PÅ BRANCH, venter Kenneths gate

Kenneth gatet Fakturagrunnlag-PDF på test (Demo Bygg AS) — harde regler holdt (ingen status/ID, liggende, prosjektgruppert, topptekst). To lekkasjer igjen, begge intern info ut av huset: (1) **ansattnr** (pseudonymiseringsnøkkel) utelates nå strukturelt ved `mottaker=ekstern` i Excel Detaljer+Sammendrag + PDF Detaljer+Sammendrag — **ansattnavn BLIR**; (2) **maskin-anomali-merkene** (`utenTimerad`/`ikkeEksporterbar`) undertrykkes for ekstern (kun navnet står; raden blir) i PDF+Excel. + **Sist brukte mal** merkes i eksport-menyen («Sist brukt», delt `useSistBrukteMal`, localStorage, MERKING ikke omorganisering, ukjent id ignoreres stille). + Demo-seed fikk fra/til-klokkeslett (koden var riktig, dataene manglet tider). Regresjonstest `timer-rapport.test.ts` (intern vs ekstern). i18n 1 nøkkel × 15 språk. Grønt: typecheck shared/pdf/web, test shared 551 / pdf 82 / web 189, lint (mine filer). Detaljer: [timer.md § Fase 4 → Oppfølger](timer.md). **Åpent (fabel): Sammendrag per ansatt selv ved prosjektgruppering — ikke bygd.** **Ingen migrering. Ingen prod.**

### 🟢 DG-sporet + flytmodell — SEKS MERGER TIL DEVELOP 2026-08-21 (kontrollplan)

Alt merget til `develop`, **ikke deployet til prod**. Test har alt til og med radkortet.

| Merge | Innhold |
|---|---|
| `4d561a93` | D2b-helside, funn 2b (rekursiv markør-innsamling), funn 3 (lesbar `drawing_position` i endringsloggen), `byggDetaljUtsnitt` ekstrahert byte-identisk |
| — | Utsnitt i repeater-celle + tegningsside flyttet inn i rapportkroppen + celle-kommentar |
| `271b9d6e` | **Lukk som slette-port** — kun admin, håndhevet i klient OG server |
| — | Radkort-form for rike repeatere (mockup 2a); tabell beholdes for helskalare |

**Rekkefølgen i arkiv-PDF er nå:** innhold → tegningsside(r) → dokumenthistorikk →
endringslogg → signatur.

🔴 **Åpent, venter Kenneth:** bildeblokken i radkortet får egen «BILDER»-etikett i samme
stil som feltetikettene, så den leses som et femte felt — og siden bilder henger på ulike
felt i ulike rader, ser kortet inkonsekvent ut. Ikke en feil i formvalget: bildene *er* på
forskjellige felt. Anbefalt løsning er innrykk + eierreferanse («Bilder — Posisjon i
tegning»). Se [designnotat-arkivmal-pdf-fabel-2026-08-21.md](../redesign/designnotat-arkivmal-pdf-fabel-2026-08-21.md).

**Senere samme kveld — fire merger til:** flytvisning-opprydding (`cancelled`-celler +
`lukkTrukket` → `slettLukket`), **funn 3** (oversikt og 4×-detalj traff ulike koordinater —
én delt `beregnUtsnittVindu`, detaljen ER oversikten croppet, så avviket er umulig ved
konstruksjon), **funn 4 + F7-D1** (alle fire kommentar-nivåer printes; «Registrert utenfor
rader»-blokk med kommentar **og** vedlegg), og **onError** på slette-mutasjonen.

🔴 **Funn 3 endret også sjekkliste-PDF-en på mobil-veien** (`sjekkliste.ts:156` går via samme
`byggTegningPosisjon`). Begge var feil; begge er rettet. **Reload:** full JS-bundle på mobil.

**Funn 6 er IKKE startet** — tilbehør-fjerning på `drawing_position`, `location`,
repeater-radnivå og `date`/`date_time` i utfyllingsflaten (web + mobil). Migreringsmåling
gjort i prod: **kun repeater har data** (4 kommentarer + 4 vedlegg av 13 felt); de tre andre
felttypene har null. Ren fjerning der, ingen read-only-visning å bygge.

⚠️ **Verifiseringsgrunnlaget er borte:** Kenneth slettet BEF-001, BEF-002 og BHO-002.
F7s DoD er skrevet om til å peke på **et nytt kontrolldokument på dagens mal**. Bygg malen
først — da dekker samme runde både funn 6-verifiseringen og F7s skjermbevis.

⚠️ **Mockupsiden «Repeater F7» finnes ikke.** F7-ordren refererer til den, men det er null
treff i `docs/redesign/arkivmal-pdf-mockup/`. Blokken er bygget mot ordrens skriftlige spec.
Fabel skylder enten mockupen, eller en bekreftelse på at spec-en er fasit.

**Vedtak fattet 2026-08-21 som må huskes:** H6 er **revidert, ikke reversert** — «Godkjent
er stoppsted i FLYTEN; Lukk er administrativ exit». Slettevakten er nå `draft || closed`.
`cancelled` er død status (0 rader i prod). Lukk er **kun admin** i begge lag.

### 🟢 F1 — endringsloggen lesbar (branch `fix/endringslogg-lesbar`, fra develop) — PÅ BRANCH, venter merge

Arkivmalens endringslogg ga ikke mening for en leser. Fire punkter, én runde
(ordre `relay/inbox-endringslogg.md`): **(1)** nøkkelsortering (`kanonisk()` i
`@sitedoc/pdf/hjelpere`) i to lag — storage-sammenligning (`sjekkliste.ts:666`)
+ render-tids no-op (`arkivmal/logg.ts`) — så lik verdi med ulik nøkkelrekkefølge
ikke er en endring. **(2)** lesbar transform: ny `endringsdiff.ts` ekspanderer
repeater-endringer til én rad per endret celle («Rad 3 — Kommentar: X → Y»),
lagt-til/fjernet rad = én linje; primitiver ryddes for JSON-anførselstegn.
**(3)** vedlegg-radformat: bilde-celler → «N bilder (filnavn)», filnavn beholdt
(eneste identifikator i loggen). **(4)** full dato+tid på hver rad (ikke bare
klokkeslett). Kolonne-labels tres inn via `sammenstilling.ts` (`byggKolonnerPerFelt`
fra objekt-treet) + `RåEndring.feltId`.

**Målt på BEF-001 i prod (`relay/endringslogg-radantall-maletall.sql`, read-only):
16 → 4 rader.** De fire er tre ekte tekstredigeringer (04:55: «press» →
«freseasfalt» → «fresemasse») + én ikke-repeater-endring. De tjue som forsvant var
signatur-churn: auto-vær-lagring returnerte ferskt signerte bilde-URL-er på urørte
repeater-celler → `normaliserForDiff` (`url.split("?")[0]`) i begge lag fjerner
`?exp=&sig=` fra sammenligningen (visning/lagret verdi uendret).

**Rotårsak ført til BACKLOG:** signerte URL-er persisteres i `Checklist.data` (bevist:
`?exp=1786657261918&sig=…` ligger i prod-data). Changelog-normaliseringen fikser
symptomet; databasen fylles fortsatt med utløpte signaturer ved hver lagring. To
spørsmål å måle før fiks: om `signerDataRad` dobbeltsignerer, og hvor mange rader som
har signatur i data i dag. Se [BACKLOG § Signerte vedlegg-URL-er persisteres](BACKLOG.md).

**Web-endringsloggen gjenbruker samme transform** (`sjekklister/[sjekklisteId]/page.tsx`):
`ekspanderEndring` + `byggKolonnerPerFelt` (flyttet til `@sitedoc/pdf`, delt med
api-sammenstillingen) erstatter lokal `formaterVerdi` — fikser to bugs som har vært
synlige i web hele tiden: repeater-verdier ble `[object Object]` (`array.join` på
objekter) og vær ble rå JSON. To PDF-observasjoner rettet samtidig (gjelder begge
flater): kolonne-label faller nå tilbake til «Kolonne N» i stedet for rå UUID/`_`,
og en uendret bildeliste gjentas ikke på begge sider av pilen (viser kun det ulike).

**Ord-nivå diff (branch `fix/endringslogg-web`, holdes til app-runden):** transformen
returnerer nå SEGMENTER (`{tekst, endret}[]`), ikke ren tekst — hver flate rendrer
endrede ord i `<strong>` (arkiv-PDF: HTML-streng, web: JSX). Slik uthever ett endret
ord seg i et langt avsnitt i stedet for at hele teksten gjentas identisk. LCS på
ord-tokens (`ordDiff`), pakken returnerer aldri HTML til web. `_`-fallbacken skjerpet:
en label uten alfanumerisk tegn (bokstavelig `"_"` overlevde `trim()`) gir «Kolonne N».
Forkorting av lange tekster: **anbefaling avventer Kenneth** — ikke bygget.

133/133 arkiv-tester grønne · pdf/api/web typecheck grønt. Ikke deployet.

### 🟡 Startbar kontrollplan — Leveranse 1 (branch `feat/kontrollplan-startbar`) — PÅ BRANCH, venter diff-gate + test

Kontrollpunkt kan startes/kobles til sjekkliste → planen teller reell status. Null nye kolonner
(fyller `KontrollplanPunkt.sjekklisteId`). `sjekkliste.opprett` += valgfri `kontrollplanPunktId`
(atomisk kobling via delt `koblePunktTilSjekkliste`), ny `kontrollplan.koblePunkt` +
`hentKoblbareSjekklister`, fremdrift avledet fra sjekkliste-status (delt `kontrollplanFremdrift.ts`),
sjekklistefilter «hører til planen / kommer i tillegg». Bygget på egen branch fra develop (ikke oppå
revisjonsarbeidet). API+web typecheck grønt, i18n 15 språk. Leveranse 2 (tegningspunkter + passiv
fargevarsling) og aktiv scheduler-varsling (Leveranse 3) er egne saker.

### 🟢 PÅ TEST — fem spor merget til develop (`d4e0d8f1`, 2026-08-12)

Merget fra `SiteDoc-merge`, deployet test, migrering kjørt. **Ikke i prod.**

| Spor | Branch | Innhold |
|---|---|---|
| Sikkerhet | `fix/uploads-signatur-path-normalisering` | test som fester `%252e`-restformen (fiksen selv alt i prod `0d5d54ee`) |
| Dataeksport fase 1 | `feat/eksport-infrastruktur` | `EksportJobb`, poll-worker m/ watchdog + 7-dagers utløpsrydding, stream-zip til `uploads/privat/`, signert levering, `verifiserKanEksportere` |
| Dataeksport fase 2 | `feat/eksport-fase2-filer-csv` | filer på tvers av 5 modeller, manifest-innhold, timer/utlegg-CSV (`;` + BOM + desimalkomma), **Activity-logging** på `bestill` + URL-utstedelse |
| Lagringsstatistikk | `feat/lagringsstatistikk` | aggregering per prosjekt/firma på `primaryOrganizationId` (eierskap), 1t cache, to flater, **tre ærlige restposter** (foreldreløse · umålt størrelse · DB-estimat) |
| Dokumentgenerering fase 3 | `feat/dokumentgenerering` | arkivmal-datalag: rent lag i `packages/pdf/src/arkivmal/` (ingen Prisma — mobil importerer pakken) + fire logg-lesere i `apps/api/src/services/arkiv/` |

**Migrering kjørt på `sitedoc_test`:** `20260811160000_eksport_jobb` (176 migreringer totalt). Gaten (`grep -q sitedoc_test`) virket.

**Merge-lærdom:** `server.ts` ga konflikt mellom hotfixen og fase 1 (begge la til i samme område). `--theirs` ville tatt hele filen fra fase 1-branchen, som er *fra før* hotfixen — altså gjenåpnet sårbarheten. Løst manuelt ved å beholde begge. **Ved konflikt i en fil der en sikkerhetsfiks nylig landet: aldri `--theirs`/`--ours` på hele filen.**

⚠️ **Gjenstår før prod:**
1. **Kenneths test-verifisering av eksport:** `eksport.bestill` på prosjekt med bilder/tegninger/timer → `hentForProsjekt` viser `klar` → last ned zip → åpne `manifest.json` → sjekk `filer/`, `tegninger/`, `timer/*.csv`, og at manglende fil står som `mangler:true`. To raske bestillinger → andre skal gi CONFLICT.
2. **`activity_log`-sjekk:** etter `bestill` + `hentNedlastingsUrl`, verifiser rader med `target_type='eksport'` og utfylt `ip_address`/`user_agent`.
3. **Lagringsflatene:** `/dashbord/admin/lagring` (per firma × prosjekt × modell) + `/dashbord/firma/fakturering` (eget firma).
4. **Innlogget verifisering** at bilder i sjekklister laster — fase 1 rører filserving-området.

**Ikke merget:** `feat/kontrollplan-revisjon` del 1 (lokal hos Opus, push gitt) · deaktiver-mønster (under bygging).

### 🟢 Dokumentgenerering Stage 4 — arkivmal HTML→PDF (`feat/arkivmal-rendering`, ikke merget)

Bygger videre på fase 3-datalaget. **Stage 1–4b pushet** (`e4a3e455`): ramme/innhold/logg/signatur (`packages/pdf/src/arkivmal/`) · 4a `pdf-render`-container (`docker/pdf-render/`, ren HTML→PDF, bilde-vakt, `x-render-komplett`-header, ingen secret) · 4b-1 bilde-inliner (flatt-hvit + 1600px/q88, annotasjon-kvalitet) · persons-resolver (UUID→navn) · 4b-2 orkestrator (`sammenstilling.ts`). **4c (gatet, denne commiten):** render-endepunkt + signert levering — `apps/api/src/services/arkiv/{disk-bilde,render-templates,render}.ts` + tRPC `arkiv.rendrSjekkliste` (samme port som lesing, skriver `/uploads/privat/arkiv/`, 15-min signert URL, activity-logg). Per-side footer-sporbarhet (generert-stempel + dok-id + `Side X av Y`). `@page :first { margin-top:0 }` mot side-1 header-dublering (UVERIFISERT mot Chromium-margin-presedens). **Gjenstår:** container-up (Kenneth) → rendertid-måling BEF-001 + annotasjons-skarphet · klient-knapp (egen runde) · timer/utlegg/kontrollplan-innholdslesere. 80/80 arkiv-tester grønne.

**4c-fiks (denne commiten) — 3 bugs funnet ved prod-render av BEF-001 (Lakselv Lufthavn):** (1) `docker/pdf-render/server.mjs` — bilde-vakten var død: `page.evaluate(VENT_FN, …)` fikk `VENT_FN` som **streng** → Playwright tolket den som uttrykk, kalte den aldri → `x-render-komplett` alltid `false` + 20s-vakten kjørte aldri. Fiks: ekte funksjon + `networkidle` (ikke Puppeteer-`networkidle0`). (2) `services/arkiv/disk-bilde.ts` — `diskSti` strippet ikke `?exp=&sig=` → vedlegg lagret signert i `checklist.data` (4 av ~25 på BEF-001) falt stille ut av PDF-en. Fiks: `url.split("?")[0]` + `disk-bilde.test.ts`. (3) `server.ts` — `Cache-Control: no-store` på `/uploads/privat/` (Cloudflare cachet privat signert fil 4t). **Åpent (server-side, ikke kode):** signert arkiv-URL gir 404 ved nedlasting — skrive-sti (`UPLOADS_DIR`) vs serve-rot (`process.cwd()/uploads`); Kenneth diagnostiserer. 88/88 arkiv-tester.

**4c-oppfølging (samme branch): rekursjon + vei 3b.** Diagnose viste at browser-tRPC kjører in-process i **web**-containeren (Next route `appRouter`), ikke api — web mangler uploads-mount → arkiv-PDF ble skrevet til efemert fs (404) og bilde-lesing feilet. Dessuten: `bilderIFelt`/`inlinDataBilder`/`resolverPersonnavn` rekurserte ikke inn i repeater-rader → 14 av 18 BEF-001-bilder aldri samlet + nestet persons-UUID kunne lekke (nå dyp traversering, 90/90). Løsning: (1) **read-only uploads-mount på web** (`:ro`, begge compose-filer) + (2) **vei 3b — `arkiv.ts` returnerer PDF (base64) i responsen** (ingen `writeFile`/signert URL → 404-en forsvinner). Gjenstår: repeater-vedlegg-render mot mockup (de 14 nestede vises ennå ikke) + de fire målingene (rendertid/skarphet/header/responsstørrelse) etter test-redeploy med mount.

**De fire målingene (2026-08-15, ekte kall mot api-test, `AGENT-TEST-0001`):** `POST api-test.sitedoc.no/trpc/arkiv.rendrSjekkliste`, HTTP 200, `komplett=true`/`renderTimeout=false`/`manglendeVedlegg=[]`. (1) Rendertid **2,18 s** wall-clock — godt innenfor 20 s, og **`x-render-komplett=true` for første gang** (bug 1 bekreftet fikset i drift). (2) Annotasjon skarp+lesbar ved 1600px/q88 på ekte annotert bilde (rød pil/tekst). (3) `@page :first` fjernet — CSS-veien virkningsløs (`page.pdf({ margin })` overstyrer `@page`); dubleringen løst ved at margin-headeren (`render-templates.ts` `byggRenderHeader`) nå bærer **kun dokumentreferanse**, ikke firma/prosjekt. (4) Responsstørrelse **1,43 MB** (PDF 1,07 MB). Forbehold: måleobjektet har 2 bilder mot BEF-001s 18 → rendertid/størrelse ikke verste-fall-representative; skarphet/header er antallsuavhengige.

**Steg 2 — repeater-vedlegg-render (arkivmalen komplett).** De nestede repeater-bildene (14 av 18 på BEF-001) rendres nå samlet UNDER tabellen mot mockupen, ett kort per bilde merket «Bilde — punkt N (filnavn)» (radnummer = kryssreferanse til raden), radrekkefølge, `break-inside:avoid` per kort (flyter over sider, ett bilde+merke samlet). **Latent bug fikset:** `attachments`-kolonne med bilde-array som celle-`verdi` traff `cellVerdi` default → `JSON.stringify` dumpet hele data-URI-base64 i cellen på BEF-001; ny `attachments`-case + array-vakt viser kun filnavn-referanse. Alt i `packages/pdf/src/arkivmal/{repeater,arkiv-css}.ts` — `felt.ts` frossen. 91/91 arkiv-tester (5 nye + header-tester rettet til komplementær margin-header). **Gjenstår: visuell verifisering mot AGENT-TEST-0001 etter test-redeploy** (annoterte bilder i repeater vises under tabellen, rekkefølge, ingen base64 i celle). Arkivmalen er da komplett: ramme · felt · logg · signatur · container · komprimering · persons-resolver · repeater-vedlegg. **Steg 2 live-verifisert 2026-08-15** mot purpose-built repeater-dokument (api-test): bilder under tabellen med «Bilde — punkt N», radrekkefølge, ingen base64 i celle — testdata ryddet.

**Funn 6 (endringslogg-lekkasje).** `byggArkivLogg` (`packages/pdf/src/arkivmal/logg.ts`) oppsummerte ikke repeater-verdier → rå JSON (barn-UUID-er + `/uploads`-stier) lekket til byggherre-dokumentet via endringsloggen. Fikset: ny `oppsummerLoggverdi` mapper `fraVerdi`/`tilVerdi` gjennom byggArkivLogg → «N rader (M bilder)», primitiver/`list_multi` uendret. 98/98 arkiv-tester (7 nye). `felt.ts` urørt.

**N1/N2 — kontrakt for klient-knapp (fabel-vedtak 2026-08-15).** `arkiv.rendrSjekkliste` → **`arkiv.rendr`** (ingen konsumenter → ingen alias). **N1:** payload er alltid en liste — `{ mal, dokumenter: [{ id, type, taMedEndringslogg? }] }`; ett element = som før, flere = **én sammenhengende PDF** (`byggArkivSide` skilt fra shell + `byggArkivSamling` + CSS `.ark-side + .ark-side { break-before: page }`, ett pdf-render-kall), men mangel-kontrakten holdes **per dokument** i responsens `dokumenter[]`. **N2:** `mal` er navngitt felt (bare «arkiv» nå, rutes på malnavn). Respons: `{ pdfBase64, filnavn, komplett, renderTimeout, dokumenter: [{id,type,tittel,manglendeVedlegg}] }`. `type:"oppgave"` godtas men avvises `NOT_IMPLEMENTED` (task-leser mangler). N>1-filnavn `samleutskrift-<prosjektref>-<YYYY-MM-DD>.pdf` (`prosjektReferanseForUtskrift`). Aktivitetslogg per dokument. 102/102 arkiv-tester (4 nye). **Sammenslåing live-verifisert 2026-08-15** (2 dok → 1 PDF, sideskift, samleutskrift-header, per-dok mangel-status, kontinuerlig sidenummer) mot api-test.

**Klient-knapp «Last ned arkiv-PDF».** På sjekklistedetalj (`sjekklister/[sjekklisteId]/page.tsx`): `trpc.arkiv.rendr` → last ned `pdfBase64` (Blob), ikke-blokkerende mangel-melding (amber ved `renderTimeout`/`manglendeVedlegg`, rød ved hard feil — inline banner, ingen toast). Kun sjekkliste; **ikke** oppgavedetalj (task-leser mangler → `NOT_IMPLEMENTED`). i18n `handling.lastNedArkivPdf` + `arkiv.*` × 13 språk. **Gjenstår:** fabel-skjermbilde-gate etter test-redeploy.

### 🟢 Funn 1 — én markør per repeater (branch `fix/tegningsposisjon-repeater-radindeks`, fra develop) — PÅ BRANCH, venter dual-review

Rotårsak (Kenneth-test 2026-08-21): `TegningPosisjonObjekt.tsx` nøklet posisjonsvelgeren på `objekt.id` (malobjektets id). Alle rader i en repeater deler samme malobjekt → rad 2 overskrev rad 1s posisjonsresultat ved retur fra tegningssiden (eller fant ingenting). Blokkerte all D2b-testdata (flere markører på samme tegning). Fiks (ren prop-tråding, ingen kontekst-endring — konteksten nøkler alt på en ugjennomsiktig streng): ny valgfri `feltNokkel` på `RapportObjektProps`; `RepeaterObjekt` sender `${barnObjekt.id}:${radIndeks}` per rad; `TegningPosisjonObjekt` bruker `feltNokkel ?? objekt.id`. Top-nivå + kontrollplan-flyt (egen `punkt.id`) uendret. Web typecheck + build grønn. **Gjenstår:** in-app verifisering (to markører på to rader, begge består) — skjer når Kenneth lager D2b-testdata.
### 🟢 Oppgave per repeater-rad (branch `feat/oppgave-per-rad`, fra develop) — PÅ BRANCH, venter dual-review

Bygger på rad-id-fundamentet (`{ _radId, felter }`, merget). Hver repeater-RAD får egen oppgave-kobling, nøkkel `${objekt.id}:${_radId}` (STABIL rad-id, aldri array-indeks). Web+mobil: per-rad badge i rad-headeren (`RepeaterObjekt`), whole-field-opprettelse PÅ repeater **avskrudd** (per-rad er entydig — prod har 0 whole-field-koblinger på repeater, Kenneth-måling 2026-08-22; avskruingen er kommentert som reversibel). Bakoverkompat gratis: `feltOppgaveMap` på ren streng-nøkkel treffer de 3 eksisterende koblingene (text_field/list_single) uendret. Forhåndsutfylling: oppgaven arver radens `drawing_position` hvis satt, ellers dokumentets lokasjon (`OpprettOppgaveModal.forhandsPosisjon` → `drawingId/positionX/positionY`; API-mutasjonen tok dem allerede). 🔴 **Load-bearing:** `onEndreVerdi(rader)` FØR opprettelse persisterer rad-id-en (ellers ville en gammel-form-rad fått ny uuid ved neste lesing → foreldreløs badge) — 2 dedikerte tester (`repeater-rad-oppgave.test.tsx`: gammel-rad-persist + idempotens). Mobil `drawing_position` er placeholder → rad-posisjon i praksis null, faller til dokument. `pnpm test` fra rot grønn (web 22 filer). **Gjenstår:** in-app-verifisering begge flater + oppgave-per-rad-DEL (visning/flyt i oppgave-detalj) ved behov.
### 🟢 Oppgave arver sjekklistens dokumentflyt — steg 1 (branch `feat/oppgave-arver-flyt`, fra develop) — PÅ BRANCH, venter dual-review

Følger bindende vedtak `domene-arbeidsflyt.md` (`ec79cb2f`): dokumentflyten er nøkkelen, faggruppe er avledet. `OpprettOppgaveModal` var det siste stedet med `.find(faggruppeId)`-mønsteret (ett av fire funn 2026-08-22). **Fiks:** oppgaven ARVER sjekklistens `dokumentflytId` (trås inn fra page via `fullSjekklisteRå.dokumentflytId`); velgeren kollapser til ÉN ting — hvilken oppgavemal i flyten. Faggruppene leses ut av flyten via den delte, testede `byggOpprettInput` (bestiller = utfører = flytens `faggruppeId`). `matchendeArbeidsforlop` + faggruppe-Select FJERNET. **Gate 1 (målt, Kenneth-bekreftet FALLBACK):** flyt-løse sjekklister er en gyldig tilstand (`Checklist.dokumentflyt onDelete: SetNull` schema:1084; F1b HMS-degradering; pre-flyt-dok `5573ccd2`) → når sjekklisten er flyt-løs vises en mikrotekst-linje («ikke knyttet til en dokumentflyt …») + en **flyt-velger** (ikke faggruppe — ellers gjenoppliver vi det forbudte mønsteret). **Gate 2 (målt):** en flyt kan ha 0 oppgavemaler — HOVEDSTI, ikke kant → interim: tom Select + deaktivert knapp (steg 2 legger malbygger-CTA). **Ikke i steg 1:** huske mal, tom-tilstand-CTA, åpne/retur (steg 2/3, steg 3 venter fabel). Tester: `opprett-oppgave-arver-flyt.test.tsx` (2 — arv + fallback binder til flyt) + rettet pre-eksisterende tsc-strict-indeksfeil i `repeater-rad-oppgave.test.tsx` (merget på develop, vitest fanget den ikke). `pnpm test` fra rot grønn (web 23 filer), alle pakker typecheck rene.
### 🟢 Slett-vern på dokumentflyt (branch `fix/dokumentflyt-slettevern`, fra develop) — PÅ BRANCH, venter dual-review

Kenneth-bestilling 2026-08-22. `dokumentflyt.slett` hadde ingen vakt (`verifiserProsjektmedlem` → `delete`), og `Checklist`/`Task`/`Godkjenning`/`KontrollplanPunkt` → `Dokumentflyt` er alle `onDelete: SetNull` (schema:1084/1150/1211/2099) → sletting nullstilte stille flyt-id på ALLE dokumenter i flyten (prod: 1 av 16 sjekklister er flyt-løs — kan være dette). **Vakt:** teller IKKE-slettede (`IKKE_SLETTET = deletedAt:null`) sjekklister + oppgaver; `> 0` → `BAD_REQUEST` «Flyten har N dokument(er) og kan ikke slettes. Flytt eller lukk dem først.» (mikrotekst-standard, speiler `mal.slettMal`). **Klient:** `slettMutation` fikk `onError` som viser meldingen i et rødt banner på flyt-raden (var stille før — tre stille avvisninger på to dager). Tester: `dokumentflyt-slettevern.test.ts` (4 — dokumenter→BAD_REQUEST, entall-grammatikk, tom→slettes, `deletedAt:null`-filter). `pnpm test` fra rot grønn; api-testen kjøres lokalt (api er ikke i root-test-gaten). **MELDT (ikke bygd, Kenneth avgjør):** (1) `onDelete: Restrict` DB-backstop som `ReportTemplate` (schema:1144) — migrering, må tåle den ene flyt-løse raden + Godkjenning/KontrollplanPunkt-FK-ene; (2) hvem bør kunne slette en flyt (i dag: ethvert prosjektmedlem — for bredt).
### 🟢 Admin-gate på dokumentflyt-sletting (branch `fix/dokumentflyt-slett-adminvakt`, fra develop) — PÅ BRANCH, venter dual-review

Kenneth-vedtak 2026-08-22: sletting av en flyt (rører alle dokumenter i den) krever prosjektadmin eller høyere. `dokumentflyt.slett` byttet `verifiserProsjektmedlem` → **`verifiserAdmin`** (tilgangskontroll.ts:389) — dekker sitedoc_admin → prosjektadmin (`ProjectMember.role="admin"`) → **firmaadmin** i én. Firmaadmin-fallbacken er ikke valgfri: firmaadmin har INGEN ProjectMember-rad, så en håndrullet `medlem.role`-sjekk ville avvist ham (samme felle som `verifiserRetningsrett`). Test: `dokumentflyt-slett-adminvakt.test.ts` (3, kjører EKTE `verifiserAdmin` via mocket `@sitedoc/db`-prisma): prosjektmedlem→FORBIDDEN · prosjektadmin→slipper · **firmaadmin uten medlemsrad→slipper** (beviser riktig hjelper). `pnpm test` fra rot grønn; api-testen lokalt. **Merk:** rører samme `slett`-prosedyre som `fix/dokumentflyt-slettevern` → de to må kombineres ved merge (admin-gate-linja + count-vakt-blokken koeksisterer trivielt). **MELDT (ikke bygd, Kenneth avgjør hele settet i én):** disse config-write-prosedyrene står fortsatt på `verifiserProsjektmedlem` og bør trolig admin-gates tilsvarende: `opprett`, `oppdater`, `oppdaterRoller`, `leggTilMedlem`, `fjernMedlem`, `settHovedansvarlig`, `settGruppeHovedansvarlig`, `settKanRedigere` (8 stk). `hentForProsjekt` (lese) bør forbli medlem-nivå.
### 🟢 Oppgave-fra-rad — funn 1–3 (branch `fix/oppgave-rad-funn`, fra `feat/oppgave-arver-flyt`) — PÅ BRANCH, venter dual-review

Fem funn fra Kenneths test 2026-08-22. **Bygget (web):** (1) 🔴 **lokasjonsarv-bug** — rad-oppgave uten egen posisjon fikk «Ikke satt» selv om sjekklisten HAR lokasjon. Rotårsak: dokument-fallbacken leste `sjekkliste` (useSjekklisteSkjema, som sprer posisjon BETINGET fra en annen query) via `as unknown as` → `undefined` skjult for kompilatoren. Fiks: les fra `fullSjekkliste` (= `fullSjekklisteRå`, hentMedId — samme kilde som `dokumentflytId`), `as unknown as`-casten fjernet, `drawingId/positionX/positionY` typet på `fullSjekkliste`. Kjede: radens egen → sjekklistens → ingen. (2) **auto-velg mal** når nøyaktig én finnes (nedtrekk beholdes for flere). (3) **radnummer i tittelen** — «Oppgave fra BEF-002: Observasjon (rad 3)» (radens 1-baserte nr, `onOpprett` fikk `radNummer`-param). Tester: repeater-rad-oppgave (+radNummer-assertion), opprett-oppgave-arver-flyt (+auto-velg-mal). `pnpm test` fra rot grønn (web 23), alle pakker typecheck rene. **Mobil:** funn 1 er allerede korrekt (leser `sjekklisteDetalj` direkte); funn 2/3 er web-UI — mobil-paritet meldt, ikke bygd. **Funn 5** (åpne oppgave + retur-sti) = steg 3, venter fabel — urørt. **MELDT (funn 4, ikke bygd):** kun én oppgave per rad i dag — se kvittering (datamodellen tillater allerede flere; 1:1 er en klient-visningsvalg).
### 🟢 Admin-gate på ALL flyt-konfigurasjon (branch `fix/dokumentflyt-config-adminvakt`, fra `fix/dokumentflyt-slett-adminvakt`) — PÅ BRANCH, venter dual-review

Kenneth-vedtak 2026-08-22 (utvider slett-gaten til alle 8). **Server:** `opprett · oppdater · oppdaterRoller · leggTilMedlem · fjernMedlem · settHovedansvarlig · settGruppeHovedansvarlig · settKanRedigere` byttet `verifiserProsjektmedlem` → `verifiserAdmin`. `hentForProsjekt` (lese) står. Begrunnelse skrevet ÉN gang i router-doccen (slett-kommentaren trimmet til referanse). **Tillegg 1 (halvskreven tilstand i OpprettKontaktModal):** valgte **(b)** — admin-forsjekk FØR første skriving. `medlem.leggTil` (kontakt) er ikke gatet, men `dokumentflyt.leggTilMedlem` (flyt-plassering) er → ikke-admin ville fått kontakt opprettet + plassering avvist = foreldreløs kontakt. Forsjekk (`hentMinTilgang.erAdmin`, kjent i klienten) blokkerer FØR skriving KUN når en flyt-plassering faktisk ville skjedd (kontakt uten flyt fortsatt tillatt for ikke-admin). **Tillegg 2 (onError):** ny delt helper `components/MutasjonsFeil.tsx` (`useMutasjonsFeil()` + `<MutasjonsFeil>`) wiret på alle gatede mutasjoner — page.tsx (4 komponenter), dokumentflyt-komponenter.tsx (2), OpprettKontaktModal (try/catch fantes alt). Ingen stille avvisning. **Tillegg 3 (test):** utvidet `dokumentflyt-slett-adminvakt.test.ts` — 27 tester (3 slett + 8 prosedyrer × [medlem→FORBIDDEN · prosjektadmin→slipper · firmaadmin uten medlemsrad→slipper]), ekte `verifiserAdmin` + permissiv prisma. `pnpm test` fra rot grønn; api-testen lokalt. **Stabler på slett-adminvakt-branchen** (samme router). **MELDT (ikke bygd):** flytoppsett-siden bør vise read-only for ikke-admin (~73 edit-kontroller, ingen route-guard i dag) — se kvittering.
### 🟢 Slett-vern på dokumentflyt (branch `fix/dokumentflyt-slettevern`, fra develop) — PÅ BRANCH, venter dual-review

Kenneth-bestilling 2026-08-22. `dokumentflyt.slett` hadde ingen vakt (`verifiserProsjektmedlem` → `delete`), og `Checklist`/`Task`/`Godkjenning`/`KontrollplanPunkt` → `Dokumentflyt` er alle `onDelete: SetNull` (schema:1084/1150/1211/2099) → sletting nullstilte stille flyt-id på ALLE dokumenter i flyten (prod: 1 av 16 sjekklister er flyt-løs — kan være dette). **Vakt:** teller IKKE-slettede (`IKKE_SLETTET = deletedAt:null`) sjekklister + oppgaver; `> 0` → `BAD_REQUEST` «Flyten har N dokument(er) og kan ikke slettes. Flytt eller lukk dem først.» (mikrotekst-standard, speiler `mal.slettMal`). **Klient:** `slettMutation` fikk `onError` som viser meldingen i et rødt banner på flyt-raden (var stille før — tre stille avvisninger på to dager). Tester: `dokumentflyt-slettevern.test.ts` (4 — dokumenter→BAD_REQUEST, entall-grammatikk, tom→slettes, `deletedAt:null`-filter). `pnpm test` fra rot grønn; api-testen kjøres lokalt (api er ikke i root-test-gaten). **MELDT (ikke bygd, Kenneth avgjør):** (1) `onDelete: Restrict` DB-backstop som `ReportTemplate` (schema:1144) — migrering, må tåle den ene flyt-løse raden + Godkjenning/KontrollplanPunkt-FK-ene; (2) hvem bør kunne slette en flyt (i dag: ethvert prosjektmedlem — for bredt).
### 🟢 Oppgave arver sjekklistens dokumentflyt — steg 1 (branch `feat/oppgave-arver-flyt`, fra develop) — PÅ BRANCH, venter dual-review

Følger bindende vedtak `domene-arbeidsflyt.md` (`ec79cb2f`): dokumentflyten er nøkkelen, faggruppe er avledet. `OpprettOppgaveModal` var det siste stedet med `.find(faggruppeId)`-mønsteret (ett av fire funn 2026-08-22). **Fiks:** oppgaven ARVER sjekklistens `dokumentflytId` (trås inn fra page via `fullSjekklisteRå.dokumentflytId`); velgeren kollapser til ÉN ting — hvilken oppgavemal i flyten. Faggruppene leses ut av flyten via den delte, testede `byggOpprettInput` (bestiller = utfører = flytens `faggruppeId`). `matchendeArbeidsforlop` + faggruppe-Select FJERNET. **Gate 1 (målt, Kenneth-bekreftet FALLBACK):** flyt-løse sjekklister er en gyldig tilstand (`Checklist.dokumentflyt onDelete: SetNull` schema:1084; F1b HMS-degradering; pre-flyt-dok `5573ccd2`) → når sjekklisten er flyt-løs vises en mikrotekst-linje («ikke knyttet til en dokumentflyt …») + en **flyt-velger** (ikke faggruppe — ellers gjenoppliver vi det forbudte mønsteret). **Gate 2 (målt):** en flyt kan ha 0 oppgavemaler — HOVEDSTI, ikke kant → interim: tom Select + deaktivert knapp (steg 2 legger malbygger-CTA). **Ikke i steg 1:** huske mal, tom-tilstand-CTA, åpne/retur (steg 2/3, steg 3 venter fabel). Tester: `opprett-oppgave-arver-flyt.test.tsx` (2 — arv + fallback binder til flyt) + rettet pre-eksisterende tsc-strict-indeksfeil i `repeater-rad-oppgave.test.tsx` (merget på develop, vitest fanget den ikke). `pnpm test` fra rot grønn (web 23 filer), alle pakker typecheck rene.
### 🟢 Oppgave-fra-rad — funn 1–3 (branch `fix/oppgave-rad-funn`, fra `feat/oppgave-arver-flyt`) — PÅ BRANCH, venter dual-review

Fem funn fra Kenneths test 2026-08-22. **Bygget (web):** (1) 🔴 **lokasjonsarv-bug** — rad-oppgave uten egen posisjon fikk «Ikke satt» selv om sjekklisten HAR lokasjon. Rotårsak: dokument-fallbacken leste `sjekkliste` (useSjekklisteSkjema, som sprer posisjon BETINGET fra en annen query) via `as unknown as` → `undefined` skjult for kompilatoren. Fiks: les fra `fullSjekkliste` (= `fullSjekklisteRå`, hentMedId — samme kilde som `dokumentflytId`), `as unknown as`-casten fjernet, `drawingId/positionX/positionY` typet på `fullSjekkliste`. Kjede: radens egen → sjekklistens → ingen. (2) **auto-velg mal** når nøyaktig én finnes (nedtrekk beholdes for flere). (3) **radnummer i tittelen** — «Oppgave fra BEF-002: Observasjon (rad 3)» (radens 1-baserte nr, `onOpprett` fikk `radNummer`-param). Tester: repeater-rad-oppgave (+radNummer-assertion), opprett-oppgave-arver-flyt (+auto-velg-mal). `pnpm test` fra rot grønn (web 23), alle pakker typecheck rene. **Mobil:** funn 1 er allerede korrekt (leser `sjekklisteDetalj` direkte); funn 2/3 er web-UI — mobil-paritet meldt, ikke bygd. **Funn 5** (åpne oppgave + retur-sti) = steg 3, venter fabel — urørt. **MELDT (funn 4, ikke bygd):** kun én oppgave per rad i dag — se kvittering (datamodellen tillater allerede flere; 1:1 er en klient-visningsvalg).
### 🟢 Oppgave/flyt-bunt A–G (branch `feat/oppgave-flyt-bunt`) — PÅ BRANCH, venter dual-review

Kenneth-vedtak 2026-08-22: ÉN branch/merge/deploy for hele settet (større bunter, ikke småordrer). Integrasjonsbranch som fletter inn hele stacken (oppgave-per-rad→steg 1→funn 1–3, slett-vern count-vakt, slett-adminvakt, config-adminvakt) + syv nye deler. Merge-konflikter løst: slett = admin-gate + count-vakt kombinert; slett-testene dekker nå begge gater.
- **A** (web): «+ Oppgave» → oppgaven ÅPNES med én gang for utfylling; retur til dokumentet som opprettet den bæres i URL (`?returnerTil=`, open-redirect-guard: kun interne stier) → overlever full last (som posisjonsvelgeren). `OpprettOppgaveModal` fikk `returnerTil`-prop + `router.push`; oppgave-siden leser `returnerTil` og bruker det som tilbake-mål.
- **B** (web): tegning-opprett → sjekkliste NAVIGERER til nytt dokument (før: måtte letes opp i lista). Oppgave-grenen uendret (markøren på tegningen ER kvitteringen) — begrunnelse i koden.
- **C** (web+mobil): flere oppgaver per rad. `feltOppgaveMap: Map<string,Oppgave>` → `Map<string,Oppgave[]>` (map.set → grupper; siste vant før). Badge-LISTE per rad + «+ Oppgave» blir stående ved siden av. Vanlige felt uendret (én badge, `[0]`).
- **D** (api): ledd-vern på `fjernMedlem` + `oppdaterRoller` — en flyt med aktive dokumenter kan verken slettes ELLER tømmes for ledd (samme skade, ulike dører). Delt `tellFlytDokumenter` (refaktorert slett). oppdaterRoller blokkerer KUN ved rolle-FJERNING (adding trygt).
- **E** (api): en flyt MÅ ha Registrator i første ledd (`roller[0]`) — `validerRegistratorForst()` i opprett+oppdaterRoller. Før: ingen validering → Godkjenner-først = ubrukelig flyt.
- **F** (mobil): funn 2 var ALLEREDE løst (MalVelger auto-velger ved 1 mal); funn 3 (radnummer i tittel) lagt til. Mobil C+funn3.
- **G** (web): read-only flytoppsett for ikke-admin — `FlytAdminContext` + `hentMinTilgang.erAdmin`, read-only-banner + skjuler flyt-KONFIG-kontrollene (ikke faggruppe-CRUD, som ikke er server-gatet).

Tester: api dokumentflyt-flytvern.test.ts (8, D+E) + slett-vern/adminvakt (31) + web oppgave-tester. `pnpm typecheck` OG `pnpm test` fra rot — se kvittering.

**Runde 3 (funn 4b — `company`-felt flyt-scoping):** Bindende vedtak (dokumentflyten er nøkkelen). `FirmaObjekt` hentet ALLE prosjektets faggrupper → et `company`-felt kunne peke på en faggruppe utenfor dokumentets flyt. Fiks: ny prop `tillatteFaggruppeIder?: string[] | null` på `RapportObjektProps` (regnet på siden fra flytens medlemmer via ren `flytFaggruppeIder`-helper, kalt inline — useMemo med dype tRPC-deps tipper TS2589). FirmaObjekt begrenser valgene til flytens faggrupper. **Flyt-løst** (null) → alle + mikrotekst. **Lagret verdi utenfor flyten** → READ-ONLY-merket «(utenfor flyten)», aldri skjult (funn 6). Web (sjekkliste+oppgave+RepeaterObjekt-videreføring) + mobil (samme). Test: `flyt-faggrupper.test.ts` (4). Malsiden (dupliserte company-felt i seed) rydder Kenneth selv — ikke min oppgave.

**Runde 2 (fire funn, samme branch):** (1) 🔴 auto-retur etter Send/Godkjenn (`endreStatus` nyStatus=sent/approved → `returnerTil`) + synlig «← Tilbake til {dok-nr}»-lenke (dok-nr bæres i URL som `returnerNavn`) — brukeren kan gå tilbake når som helst. (2) tittel-form: radnummeret FORAN etiketten («2 Observasjon», ikke «Observasjon (rad 2)») — web+mobil. (3) mal-piller i flytoppsett får S/H-lesbart kategori-ikon (`MalKategoriMerke`: ClipboardCheck=sjekkliste, CheckCircle2=oppgave — form, ikke farge alene). (4) «Oppretter-entreprise»-feltet: MELDT, venter Kenneths måling (malfelt type `company`? → fjern feltet, ikke bygg logikk) — IKKE rørt.
### 🟢 DG D2 — tegning + dokument-lokasjon i arkiv-PDF (branch `feat/arkivmal-tegning-d2`, fra develop) — PÅ BRANCH, venter dual-review

Grunnlag: `docs/redesign/ordre-arkivmal-tegning-d2-d2b-fabel-2026-08-21.md` + designnotat (D2 korrigert: dokument-lokasjon er **tegningsmarkør**, ikke kart/GPS). `felt.ts` FROSSET (delt mobil-sti) — override i `arkivmal/` etter repeater-mønsteret. **Bygget (steg 1–3):** ny `arkivmal/tegningsfelt.ts` (`byggArkivTegningsposisjon` feltnivå + `byggLokasjonsblokk` dokumentnivå, begge gjenbruker `byggTegningPosisjon`) · `innhold.ts` intercepter `drawing_position` · `dokument.ts` plasserer `lokasjonHtml` rett under dokumenthodet · `sammenstilling.ts` samler tegninger (dok + felt) → **samme bilde-inline-batch (data-URI, aldri signert URL)** → `tegningsOppslag` på `PdfConfig` (arkiv-only, mobil uendret). **Cowork-tillegg lukket:** tegningsbildet skaffes som base64 data-URI via disk-inlining (samme kjede som vedlegg) — ingen URL som kan utløpe under render. **Gate (Kenneth 2026-08-21):** tegning uten markør skrives IKKE ut, heller ikke når `drawing_id` er satt men `position_x/y` NULL (BEF-001: ukonvertert PDF-tegning) — presiserer «uten markering utelates seksjonen». **Funn 2a (prod-lekkasje, fikset):** `drawing_position` i en repeater-CELLE dumpet rå koordinat-JSON (`cellVerdi` default `JSON.stringify`) — ny `location`/`drawing_position`-case viser «\<tegningsnavn\> (X,X %, Y,Y %)» som speiler utfyllings-UI, aldri JSON. 19/19 pdf-tester (15 nye/D2-relaterte inkl. kant-tilstander + 2a) + 133/133 api arkiv-tester. **Gjenstår:** render-verifisering begge flater (venter testdata m/ ekte markører) + **funn 2b** (per markering én oversikt+detalj-blokk under repeater-raden — `tegningsOppslag` inn i `byggRepeaterTabell` + samle repeater-nestede `drawingId` i sammenstilling) + **funn 3** (endringslogg no-op på tom markør — venter ekte diff-par) + **D2b** (helside per tegning). 2b/3/D2b venter testdata (blokkert av funn 1: UI kan kun sette én markør per repeater, `TegningPosisjonObjekt.tsx` — egen branch).
### 🟢 Kontekstvelger v2 — retning 1a (branch `feat/kontekstvelger-1a`, fra develop) — PÅ BRANCH, venter designgate + merge

Grunnlag: [ordre-kontekstvelger-1a](../redesign/ordre-kontekstvelger-1a-fabel-2026-08-21.md) + [regresjonsjakt](kontekstvelger-regresjonsjakt-2026-08-21.md). Flagg-nøytralt (funksjonalitet, aldri bak `nyNavigasjon`). Fire commits: **A1+E** (`1fbd9524`), **B+C** (`567e05f5`), **D7** (`9421cb91`), doc-sync. 

- **A1 (datakvalitet):** autovalg byggeplass flyttet fra sideeffekt i `ByggeplassVelger` (kun gammel nav → tapt i ny nav, `4d52114e`) inn i `byggeplass-kontekst.tsx` (query + autovalg-effekt + gyldighets-guard). Nye sjekklister får ikke lenger `byggeplassId=undefined`.
- **E:** `ruteErFirmaKontekst` → delt `@/lib/ruteKontekst` (maskin-bevisst), importert i KontekstChip+Toppbar+NavSidebar (funn 6: `/dashbord/maskin` FIRMA konsistent).
- **B1** åpne() dypeste avklarte steg (verifisert). **B2** prosjektvalg lukker ikke — avanserer til byggeplass-steget (3 klikk mot 5). **B3** favoritter via delt `useFavoritter` (localStorage, ingen ny lagring) + stjerne per rad (ny valgfri `handling`-slot på `TraktRad`) + Favoritter→Sist brukt→Alle. **B4** autofokus-søk.
- **C5** snudd trunkering (prosjektnavn prioritert). **C6** 240px-anker oppgitt, navn flyter ~460px.
- **D7 (design-gated):** byggeplassfilter i sjekklisteoversikten + «Hele prosjektet»-tilstand (klientside, OR-null). **Premiss enkeltmålt — Kenneth bekrefter i designgaten før merge.**

i18n × 15 språk (6 nye nøkler). Web typecheck + build grønn. Doc-sync: `redesign-paritetssjekkliste.md` + `k3-verifiseringslogg.md` re-verifisert (`sist_verifisert_mot_kode=2026-08-21`), K3-vedtakets popover-punkt → B2. **Gjenstår:** fabel skjermbilde-designgate m/ klikk-budsjett-walkthrough + D7-bekreftelse; merge via cowork `--no-ff`.

## Arkivert 2026-08-28 — append-only-fiks + fase M-3a del 2 (i prod siden juli)

### Sjekkliste ikke append-only (branch `fix/sjekkliste-ikke-append-only`) — PÅ BRANCH, venter merge

**Regresjonsfiks fra `04f6d295`** (kun develop/test, prod ikke rammet). `04f6d295` slo på append-only felt-låsing i alle fire skjema-hooks. Riktig for oppgave (mobil manglet den), **feil for sjekkliste** (spec `dokumentflyt.md § 2`: sjekkliste er redigerbar for den som har ballen + admin/registrator) — et innsendt tallfelt ble permanent låst, også for admin.

Fjernet felt-låsen fra begge sjekkliste-hooks (`useSjekklisteSkjema` web+mobil: import, `låsteFelterRef`, init-lås, `erFeltLåst`, settVerdi-guard, interface, retur) + `verdiLeseModus = leseModus` i begge sjekkliste-sidene. **Oppgave urørt** (låsen beholdt). Docs oppgave-only i 4 steder (`feltLaasing.ts`, `flytRolle.ts`, `mobile/hooks/CLAUDE.md`, `shared/utils/CLAUDE.md`) + BACKLOG § server-side scopet til oppgave. Separat funn (oppgave-låsen konsulterer ikke rettighet) → BACKLOG, ikke fikset her.

**Verifikasjon:** `next build` grønn, shared-tester grønne, mobil-typecheck uendret (11 baseline). **Flagg:** pre-eksisterende TS2589 i `sjekklister/[sjekklisteId]/page.tsx:117` finnes på origin/develop uten denne diffen (dukket opp etter del-2-mergen med samtidig arbeid) — feiler ikke `next build`, men bør ryddes separat. Runtime-verifisering på test etter deploy.

### Fase M-3a del 2 — MalBygger gap-bygging (branch `feat/faseM-3a-del2`) — PÅ BRANCH, venter merge + test-verifisering

**Levert i kode 2026-07-16** (build grønn, shared-tester grønne, web+api typecheck rent, mobil-typecheck uendret). Bygget mot del 1-matrisen + Kenneth-vedtak «norsk kanonisk grense-nøkkel + engelsk fallback-les»:

- **F1** grenseverdier (`min`/`maks`/`toleranse`/`enhet`/`desimaler`): delt `@sitedoc/shared/utils/grenseSjekk.ts` (normaliser + validering, m/test), editor-UI i `FeltKonfigurasjon.tsx`, web+mobil-render viser grense (≥ ≤ ±) + amber-markering utenfor (blokkerer ikke innsending). NS3420-seed rendrer nå uten å røres.
- **F2** quiz web (`QuizObjekt.tsx` + KOMPONENT_MAP) — web-datatapet lukket.
- **F4** `persons.max`-input.
- **pkt 2** kollapsbare heading-seksjoner (`seksjoner.ts` delt + `UtfyllingSeksjoner` web+mobil), utledet uten datamodell-endring, print-trygt.
- **pkt 4** `mal.kopier` (to-pass parentId + dokumentflyt-koblinger) + aktivert MalListe-knapp.
- i18n: 11 nøkler × 14 språk (generate.ts kjørt). Restanser (F2-rest/F3/F4-rest/pkt 2-rest) → [BACKLOG § MalBygger felttype-restanser](BACKLOG.md).

**Utestående:** skjermbilder/funksjonell verifisering på test.sitedoc.no etter deploy (kontroll-Claude, ikke Opus' egenrapport). Full detalj: [faseM-3a-felttype-matrise.md § Del 2](faseM-3a-felttype-matrise.md).

**Oppfølger `fix/pdf-enhet-fallback` (2026-07-16):** Del 2-editoren skriver `enhet`/sletter `unit`, men PDF (`felt.ts:78`), `RapportObjektVisning.tsx` og `BeregningObjekt` (web+mobil) leste kun `unit` → mistet enhet ved redigering av int/decimal-mal. Alle lest om til `enhet ?? unit` (pdf beholder null-avhengigheter). Ekte regresjon funnet i exit-runden (fabel). Web+pdf typecheck rent, mobil uendret.

## 🔴 SIKKERHETSFIKS — signaturgate-omgåelse på `/uploads/privat/*` (PROD `0d5d54ee`, 2026-08-11)

**Funnet, fikset, deployet og verifisert i drift samme kveld.** Oppdaget under cowork-gate av dataeksport fase 1.

### Sårbarheten

`server.ts` gatet på **rå** URL (`req.url.startsWith("/uploads/privat/")`), mens `fastifyStatic` normaliserte stien før filoppslag. Gate og oppslag så to forskjellige strenger. I prod siden `ca7f16b6` (S1 Fase 1, autorisert filserving).

**Fire utnyttbare former, alle verifisert med 200 mot ekte fil før fiks:** `/uploads//privat/…` · `/uploads/./privat/…` · `/uploads/x/../privat/…` · `/uploads/%2e/privat/…`

**Reell konsekvens:** filnavn er UUID-er, så ikke fri katalogbla — men **utløpsmekanismen var brutt**. Den som hadde sett en signert lenke én gang kunne bruke den permanent ved å legge til `/./`, uten signatur og uten innlogging. 10-minutters-utløpet gjaldt i praksis ikke.

### Fiksen (`f224fbb3` → develop `b621333c` → main `0d5d54ee`)

Ny ren funksjon `vurderPrivatFilForesporsel(rawUrl)` i `apps/api/src/utils/hmac.ts`: normaliserer (`decodeURIComponent` + `posix.normalize` + kollaps `/+`) og bruker **samme normaliserte sti til både gate og signaturverifisering**. Rot-årsaken — asymmetrien — er borte, ikke maskert.

`normaliserFilSti` er no-op på kanonisk form, så eksisterende signerte lenker verifiserer uendret. Målt og testet, ingen endring på signeringssiden.

🔴 **`%252e` (dobbeltkodet) slipper bevisst forbi normaliseringen.** `fastifyStatic` dekoder også kun én gang, så oppslaget treffer et mappenavn `%2e` som ikke finnes → 404, ingen fil nåbar. **Innfør ikke dekoding-i-løkke** — da dekoder gaten mer aggressivt enn serveren, og asymmetrien vi fjernet kommer tilbake speilvendt. Festet med test.

### Verifisering

12 tester i `hmac.test.ts`, inkl. den som beviser kjerneutnyttelsen er borte: **korrekt signert men utløpt lenke + `/./` → 401**.

Sonde mot ekte fil, alle fem former: **401 på test etter deploy, 401 på prod etter deploy**. Byggstempel bekreftet `0d5d54ee` / `2026-08-11T20:29Z`.

> **Lærdom (deploy-mekanikk):** første test-deploy bygde gammel kode fordi `docker compose up --build` ble kjørt uten forutgående rsync — bygg-konteksten er server-fila i `~/stack/sitedoc`, ikke Mac-en. Sonden fanget det; uten den ville vi gått til prod med en fiks som ikke var der. Rekkefølgen er alltid **pull hovedtre → rsync → build → up**, og hovedtreet er bak hver gang merge-treet har pushet.

⚠️ **Gjenstår:** innlogget verifisering i nettleser at bilder i sjekklister laster normalt. Sonden beviser at ugyldige forespørsler avvises, ikke at gyldige slipper gjennom.

---

Arkiv av arbeid deployet til prod i august 2026. Flyttet hit fra [STATUS-AKTUELT.md](STATUS-AKTUELT.md) per arkiveringsplikten (deployet arbeid ligger aldri igjen i STATUS-AKTUELT).

> **Mobil-forbehold for hele måneden:** ingen EAS-bygg er fyrt i august (siste er #40, 2026-07-15). Mobil-kode som er merget til `main` i august er derfor **i prod-repoet, men ikke hos brukerne** — den når felt først ved neste EAS-bygg + TestFlight. Gjelder særlig mobil detalj-redesign M1–M3. Se [STATUS-AKTUELT § EAS-byggteller](STATUS-AKTUELT.md#eas-byggteller-kvote-15mnd-fri-plan--nullstilles-den-1).

## Prod-deploy 2026-08-10 (`7f838d80`, develop→main) — 33 commits: bunt 44 web/api + utlegg U3 + firma-admin + mal-gate (LIVE)

Første prod-deploy siden `e37621e1` (08.08). **Én migrering:** `20260808130000_sheet_machine_timer_id` (additiv nullable FK, `db-timer`). Backup tatt før deploy. Bygget api og web hver for seg (samtidig = OOM), `up -d --no-deps` uten `-p`. Migrerings-gaten avviste ikke ⇒ traff riktig DB (`sitedoc`).

**Innhold:**
- **Bunt 44 web/api-side.** Mobilkoden nådde felt via EAS-bygg 44 (09.08) — dette er server-siden av samme bunt: HMS melder-flyt, `sheetTimerId`-koblingen for maskin ved redigering, seks katalog-tjenester som ikke lenger tømmer cachen sin ved en feilet pull.
- **Utlegg U3 — web-registrering** (`aa111b45`). Velger 8a + tre radformer 8b + kilde-linje. E2E-verifisert på test i tre lag: CHECK-constraint runtime-bevist, API-guarder (`sats` avvist, beløp påkrevd, `ordningVedFoering` immutabel), browser mot mockup.
- **Firma-admin kan opprette prosjekt** (`3f931fa8`). `dashbord/firma/prosjekter` manglet knappen helt; `/dashbord` hadde den, men auto-redirect gjorde den uåpnåelig ved ≥1 prosjekt. Samtidig harmonisert `dashbord/page.tsx:47` fra `users.role` til `kanAdministrereFirma` — første konvergerte lesebane i firmarolle-oppryddingen.
- **Mal-redigering krever prosjektadmin** (`60752550`). Alle åtte mal-**mutasjoner** gikk på `verifiserProsjektmedlem` ⇒ enhver prosjektdeltaker kunne redigere og slette HMS-malene. Nå `verifiserAdmin` (sitedoc_admin · prosjektadmin · **firma-admin arver**). Queries urørt — feltarbeidere må lese maler for å fylle ut skjema. `oversettFelter` bevisst holdt åpen: den kalles fra dokumentdetaljsidene, admin-gate der ville brutt oversettelse for alle medlemmer. UI gates på ny `mal.kanRedigere` som speiler serverfunksjonen ⇒ divergens strukturelt umulig.
- **`admin.seedManglendeFirmakatalog`** (`966ed8db`) — idempotent seed av manglende firmakatalog per org, sitedoc_admin-gated. Kun `expenseCategories` wiret (se § Modul-onboarding under).
- **Firmarolle-divergensvakt Fase 1** (`586d7296`) — `console.warn` ved firma-kontekst-bygging når gammel (`users.role`) og ny kilde (`firmaRoller`) er uenige, begge veier. Ren diagnostikk, ingen gating.
- **Seed-drift rettet** (`6cf467ec`) — `seed-testbrukere.ts` satte `firmaRoller: ["admin"]` mens serveren filtrerer på `"firma_admin"`. To økter gikk i den fella samme dag.

**Etterarbeid på prod, verifisert:**
- **A.Markussen fikk sine 5 utleggskategorier** (Annet · Diett · Drivstoff · Parkering · Verktøy) via `admin.seedManglendeFirmakatalog` → `{opprettet: 5, hoppet: false}`. **Lønnsart-fordelingen 25 (`seed_nivaa=2`) / 19 (import) er uendret før og etter** — det var hele risikoen, og den er målt på ekte data, ikke bare på testfikstur. Uten dette ville U3-utleggsflaten vært tom for den eneste kunden som skal bruke den.
- **Duplikate maler ryddet på 998 Instinniforbotn:** tom «KS avvik» (0 felter, 0 dokumenter) slettet, «Befaringsnotat» fjernet. Prosjektet står nå med fem maler og unike prefikser.

### 🔴 Funn under deployen som ikke er lukket

**Mal-sletting kan foreldreløse oppgaver.** `mal.slettMal` (`mal.ts:219-225`) gjør rå `delete` uten å telle dokumenter. Utfallet avhenger av en utilsiktet asymmetri: `Checklist.templateId` er påkrevd ⇒ Prisma-default `Restrict` (sletting nektes), mens `Task.templateId` er nullable ⇒ `SetNull` (oppgaven mister malen). **`Task` har ingen `projectId`** — den kobles til prosjektet via malen, så en foreldreløs oppgave mister også veien tilbake til prosjektet. `Task.data` er dessuten JSONB nøklet på `ReportObject.id`, så innholdet blir utolkbart uten malen. **Ingen data tapt** (`SELECT count(*) FROM tasks WHERE template_id IS NULL` → 0), men mekanismen står. Ordre gitt: server-guard + `onDelete: Restrict` + samme sjekk for `slettObjekt` (som har `sjekkObjektBruk` i UI, men ingen server-guard).

**Ingen unikhet på mal-prefiks eller mal-navn.** 998 hadde to «KS avvik» (begge `K-avv`) og to BEF-maler med ulike navn. Nummerering er `_max(number)` per `templateId`, ikke per prefiks ⇒ to maler med samme prefiks gir to serier som begge starter på 1. **Kenneths vedtak: unikt prefiks og navn per prosjekt** (og per firmamal-oppsett når det bygges). Krever DB-constraint + app-validering; `mal.kopier` må håndtere at den i dag kopierer prefikset uendret.

### 🟡 Modul-onboarding: aktivering seeder ikke grunndata
Kartlegging under deployen viste at **kun én modul** (`hms-avvik`) seeder automatisk ved aktivering. Timer har `seedTimerForOrganization`, men den henger på en parallell vei (`timer.onboarding.aktiverNivaa1`) — den generiske `organisasjon.settFirmamodul` kaller ingenting. Maskin og varelager har ingen rutine. Dokumentert som åpen sak i [BACKLOG § Modul-onboarding-veiledning](BACKLOG.md); `arkitektur-syntese.md § 3.8` beskriver en `onOrganizationCreated`-hook som ikke finnes i koden.

**Føring fra Kenneth som endrer premisset:** A.Markussen skal ha **sine egne importerte lønnsarter, ikke lovutledede standardarter**. `seed_nivaa = 1`-tomheten er derfor den *ønskede* tilstanden for dem. En oppstartsrutine må skille tre tilstander, ikke to: aldri onboardet (seed) · onboardet (hopp) · **bevisst egen katalog** (hopp, og ikke rapportér som ufullstendig). `onboarding.status` rapporterer i dag sannsynligvis Timer som ufullstendig for A.Markussen selv om katalogen er som den skal.

## Prod-deploy 2026-08-08 kveld (`e37621e1`, develop→main) — HMS 5a+5b melder-flyt + utlegg U1 (LIVE)

Lukker read-only-regresjonen fra `881e66e6` **ved rotårsaken**. Første migrering på flere dager (additiv, `db-timer`).

- **HMS 5a — opprett = utkast.** `oppgave.opprett` + `sjekkliste.opprett` HMS-gren gir nå `sendt:false` / `aktivPosisjon:1` / `draft`, uten varsel ved opprett. Ny `hmsSendInn` (`draft|responded → received`). Gjenkjennes på **`mal.domain === "hms"`**, ikke subdomene ⇒ gjelder **alle tre typer: avvik, ruh, sja**. Draft-guard skjuler utkast for ALLE inkl. HMS-admin («ingen ser utkastet før du sender»). leseModus = `erMelder && aktivPosisjon===1 && !terminal` — dekker draft OG returnert, så «Returner til melder» faktisk gir melder redigeringsrett tilbake. Forkast gjenbruker eksisterende `slett`.
- **HMS 5b — tillegg-synlig + feltlås.** Ny `HmsMelderTillegg`: synlig forklaring på hvorfor feltene er låst (kun mens ballen er hos behandler, med sendt-dato fra transfer-loggen) + «Tillegg fra melder» som tidsstemplet logg. Melder-tillegg flyttet UT av `HmsHandlingsflate` ⇒ den er nå ren behandler-flate. **Sporbarhet ved revisjon:** `hmsSendInn` skriver distinkte transfers — `draft→received` = «Sendt inn», `responded→received` = «Revidert og sendt tilbake» — så behandler ser at melderen endret noe.
- **Utlegg U1** (`cf1e6c53`) — datamodell + delt utledning, ingen UI ennå. `ExpenseCategory.ordning` (sats|utlegg|fakturert), `sheet_utlegg` + `sheet_utlegg_vedlegg` + `prosjekt_ordning_overstyring`. **CHECK på radens eget `ordning_ved_foering`** (kan ikke referere kategori-tabellen) gjør stempelet til integritetsbærer, ikke bare revisjonsspor. Delt `utledOrdning` (`overstyring ?? firma-default`) i `@sitedoc/shared` med 10 tester. `timer.md` drift-reconciliert: planlagt-men-aldri-bygget `sheet_expenses` erstattet med faktisk modell.

**Verifisert innlogget på prod:** HMS-005 opprettet → «Utkast» + banner + Send inn/Forkast + redigerbare felt → etter innsending «Mottatt» + låste felt + Besvar/Lukk/Returner.

**Spor 2-dekning (asymmetri, kjent):** web-oppgave har full flyt; web-SJA har melder-flyt + Besvar/Lukk men mangler Returner + flyt-stripe; mobil har melder-flyt, behandling er pre-Spor-2. Oppfølgere navngitt, ikke skjult.

**Prosess-lærdom:** forrige deploy (`881e66e6`) tok med Diff 1 mens 5a fortsatt manglet — vi byttet «behandler kan ikke behandle» mot «melder kan ikke melde». Regelen framover: **ikke deploy en bunt med kjent åpen regresjon**, selv om resten er verdifullt.

## Prod-deploy 2026-08-08 (`881e66e6`, develop→main) — HMS received-fiks + fillagring S1 + firma-tilknytning + P4a mobil (LIVE)

25 commits. **Ingen migreringer** (verifisert: kun `schema.prisma`-kommentarrydding). Backup tatt før deploy (`sitedoc-pre-25commits-20260808-0701.dump`, 485K). Bygget api og web hver for seg (samtidig = OOM), `up -d --no-deps` uten `-p`.

**Ny deploy-forutsetning innført samtidig:** `docker/env/felles.env` med `FIL_SIGNING_SECRET`, lest av BÅDE api og web. Verifisert etter start: `${#FIL_SIGNING_SECRET}` = 64 i begge containere, `/api/fil-selvtest` → `{"ok":true}`, og kryss-prosess-sjekk (web signerer → api verifiserer) → **404** = enige (401 ville betydd ulike secrets).

- **HMS `received`-rotfiks + 5c behandler-mønster** (`6e54a3b3`). Rotårsak: HMS opprettes sendt → `avledStatus` → `received` (Q1-kollapsen), men `verifiserHmsHandling` + `HmsHandlingsflate` gjenkjente kun `sent`/`responded` → besvar/lukk filtrert bort → «Lesevisning» for behandler OG admin, uavhengig av `erHmsAdmin`. **Live prod-bug siden 03.08.** Fiks: `åpen behandling = sent|received|responded` + ny `hmsReturner`-mutasjon + `HmsFlytStripe` + Melding read-only-tvang. Verifisert prod: HMS-002 viser flyt-stripe + Besvar/Lukk/Returner.
- **Fillagring S1 Fase 1** (`d1f93dc4`) — autorisert filserving for sensitive filer. HMAC-signerte, kortlevde (5 min) URL-er; `/uploads/privat/*` er signatur-kun (401 ellers); `?privat=1`-opplasting + magic-bytes-sniffing; M1 record-nøklet sign-query for mobil. **Målrettet signering** i de prosedyrene som emitterer privat-URL-er (erstattet all-svar-middleware). **Boot-guard i BEGGE prosesser** — prod nekter å starte uten secreten. Signerings-røyktest (`/api/fil-selvtest`).
- **Firma-tilknytning** (`4b306a14`) — FIRMA-kolonnen i kontakter-matrisen leste fantom-feltet `user.organization` (legacy `User.organizationId`, droppet i O5c). Leser nå `OrganizationMember` med multi-org-regel. Rettet «—» for hele porteføljen siden 13.05.
- **P4a mobil — auto-opprett svart skjerm** (`0fef35fa`). To iOS-modal-race: overlappende present/dismiss (MalVelger↔Opprett) + intern dismiss mid-present ⇒ `onDismiss` fyrte aldri ⇒ usynlig fullscreen modal-VC. Fikset med iOS' egne livssyklus-events (`onShow`/`onDismiss`), ingen timeout. **Fanget av simulator-verifisering før EAS-kvote ble brent.** (I main, men når ikke brukere før EAS-bygg.)
- **Doc-rens + arkitekturvedtak** (`28ffd0b8`, `436d59bd`, `37141be0`) — august-historikk opprettet, `CLAUDE.md` under 40k, vedtak om én kilde til firmarolle, mockups forankret.

### 🔴 Kjent regresjon fra denne deployen (fikses i HMS-bolk 5a+5b)
**HMS-skjemaet er read-only for alle, også melderen.** 5c innførte `leseModus`-tvang med grenen `erMelder && status === 'draft'` — men HMS opprettes fortsatt sendt (`received`), så grenen treffer aldri. Følge: nye HMS-meldinger kan opprettes, men ikke fylles ut. Kenneth på prod 08.08: «status er meldt før skjema er påbegynt utfylt, og skjema er nå låst.» **Rotårsaken løses av 5a** (opprett = utkast) — ingen interim-lapp, jf. «ikke bygg noe å rive». Deployes samlet med 5b.

### Lærdom — topologien som kostet en dag
`FIL_SIGNING_SECRET` ble satt i `api-test.env`, men **tRPC kjører i web-containeren** (`apps/web/src/app/api/trpc/[...trpc]/route.ts` importerer `appRouter`; kun `/api/upload` + `/api/uploads/*` rewrites til api). Signeringen kastet derfor i web-prosessen, og api-loggen viste ingenting. Symptomene (207 på urelaterte batcher, «Dagsseddelen finnes ikke eller du har ikke tilgang», «Ugyldig verdi.») pekte alle mot tilgangskontroll og data — som var feilfrie. **Topologien er nå dokumentert i DOCKER-NOTES + infrastruktur.md**, og boot-guarden gjør at samme feil stopper deployen i stedet for å produsere tause 207-er.

## Prod-deploy 2026-08-06 (`70d2b752`, develop→main) — Spor 2 HMS komplett (LIVE)

Hele Spor 2 (HMS-redesign) deployet og innlogget-verifisert på A.Markussen AS. Backup tatt før deploy. **Ingen migreringer.**

- **Ordre 2.1 — HMS-medlemskap som regel + synlighet (Funn H)** (`d0eccd58`, merge `2599a604`, i18n `4e55450a` 18 nøkler). HMS gjort synlig i det unifiserte oppsett-UI-et; medlemskap uttrykt som regel framfor implisitt tilstand. Verifisert: to-lags-modellen står (prosjekt-HMS-gruppe vs. firma-`hms_ansvarlig` er ulike ting med samme navn).
- **Ordre 2.2 + 2.3 — unifisert velger + segmentert filter/Hos-kolonne/retur (Funn E/F/G)** (Wave 1 `33d7cff9`, Wave 2 `79c5253a`, merge `2ed1d31e`, i18n `b133cd25` 3 nøkler). Wave 1: unifisert velger (E) + retur-kontekst (G) + flyt-select (G4). Wave 2: segmentert «Hos»-filter (F) + «Hos»-kolonne (G). Endringsmelding holdt UTE av HMS-velgeren (Kenneth-vedtak: et HMS-avvik som utløser endringsmelding legges heller som vedlegg til et økonomisk krav).
- **Krasj-fiks — rules-of-hooks** (`8b826ab6`). Klikk på «Hos HMS-ansvarlige»-segmentet ga hvit skjerm: tom-retur (`if (rader.length === 0) return <EmptyState>`) lå FØR `useMemo` i tre tabeller → hook-rekkefølgen brøt. Fikset ved å flytte tom-sjekken etter alle hooks; samme fiks løste tomt-søk-krasjen. «Hos ?» erstattet med «Utkast»-chip.
- **Banner-polish (2.1 fix-forward)** (`54a379b9`, merge `a024827d`, i18n `4c5f1cc0`). Inline «Meld meg inn» på matrise-raden + «behandler på dette prosjektet»-mikrotekst + `HmsTomBanner` verifisert på prosjekt-HMS.
- **v18/v19 build-blocker** (`5a8f63e5`, merge `244ce1cb`). Ferskt `pnpm install` løste `@types/react` til v18 (web pinner ^18.3.0, mobil drar v19) og avdekket en latent typefeil som Docker-cachen hadde maskert: `DokumentHandlingsmeny.tsx:891` sendte `RefObject<HTMLDivElement | null>` der v18 ikke godtar det. Fikset versjons-agnostisk (`Ref<HTMLDivElement>`) + `as unknown as` for TS2589 i brukere-siden. **Lærdom:** en grønn build på cachet image beviser ikke at et ferskt bygg går grønt.

**Kjent restanse:** #7 (bruker ser ikke HMS i firmadelen) var **feil flate**, ikke kodebug — kmy ser HMS på prosjektnivå. Mobil-paritet for HMS-velger/filter er egen runde. Redigerbare medlem-unntak (schema) er backlogget.

## Prod-deploy 2026-08-05 (`8a2f6d9c`, develop→main) — Ordre 1.4 auto-hopp bort overalt (LIVE)

Web-only. `åpneMalVelger` viser nå velgeren alltid ved ≥1 mal på begge web-flater (sjekkliste + oppgave); sist-brukt degradert til ren markør. **Snur Funn C-fasit pkt. 3** — auto-hopp fjernet framfor å beholdes med korrigert nøkkel. Test-verifisert (`fc763960`) før prod. Mobil-paritet (RN `MalVelger`) er egen runde.

## Prod-deploy 2026-08-05 (`5bf25f83`, develop→main) — Funn D + opprettvelger v2 + Spor 1 fundament/1.1 + kontaktside (LIVE)

- **Funn D — P2 tom-besvarelse-guard.** `harMinstEttUtfyltFelt` (`feltLaasing.ts` + `oppgave.ts:1310`) telte kun skjema-objekt-svar, ikke kommentar/vedlegg → «besvar med kun kommentar» ble feilaktig avvist. Fikset og deployet.
- **Opprettvelger v2** (`28808b5f`). To-nivå gruppering faggruppe→flyt, HMS-seksjon ALT 1, sortering flyttet inn i komponenten. Fabel-spec. 11/11 + 107/107 grønt.
- **Spor 1 fundament + 1.1** (`feat/spor1-fundament-terminologi`). Domene-wire (Funn H) + terminologi: Gruppe→Tilgangsgruppe, Brukere→Kontakter, HMS-feilmelding, Endringsmelding-stavefiks, forklaringsboks. Web-only.
- **Kontaktside null-guard** (`26461288`, i18n `4833edf0`). Build-fiks i `OpprettKontaktModal`.

## Prod-deploy 2026-08-04 (`0ac25705`, develop→main) — Funn A + Funn C (LIVE)

- **Funn A — oppgaver bandt ikke dokumentflyt ved opprett.** `matchDf` brukte døde rolle-strenger (`oppretter`/`svarer`), foreldreløse siden navnegjennomgangen 2026-04-05 → **~4 måneder latent bug, IKKE en flytmodell-regresjon.** Fiks: P4b-ens `opprettbareFlytIder`-flytbinding portet til oppgave-opprett + 3 server-vakter, `matchDf` fjernet. Innlogget prod-verifisert: KS-avvik binder «A.Markussen Ansattte -> ledelse», full flyt kjører.
- **Funn C — opprett-velger auto-hoppet** til per-prosjekt sist-brukt-nøkkel → maler ble uåpnelige. Fiks: unifisert `OpprettMalVelger` på begge flater, velger åpnes alltid ved >1, sist-brukt auto-valgt + flyttbar markør, nøkkel per prosjekt+dokumenttype. Fabel-spec. (Fasit pkt. 3 ble senere snudd av Ordre 1.4, se over.)

## Prod-deploy 2026-08-03 (`8b068c73`, develop→main) — flytmodellen komplett + effektivitets-runden + mobil M1–M3 (LIVE)

Den store deployen. Backup prod-DB tatt (`sitedoc-preflyt-2026-08-03-1533.dump`, 99 tabeller). **To additive migreringer** kjørt rent mot `sitedoc`: `20260731120000_flytmodell_fase1_posisjon` + `20260731140000_flytmodell_1b_hms_binding`. Backfill rent: Fase 2 ga 5 sjekklister + 4 oppgaver non-terminal posisjon (1 ubestembar), gjenåpne-cache 0 å rette. `sitedoc-api` + `sitedoc-web` restartet OK. Innlogget verifisert: **sjekklister binder dokumentflyt + flytlinje live** (BEF-002 «BL -> BH», «Du har ballen — Registrerer», «Send til N·X»). Test-verifisert først 2026-08-03 (`0daa89e1`).

### Flytmodell (dynamisk posisjonsmodell)

Rotårsaken som ble fjernet: rutingen konsulterte ALDRI dokumentflytens leddrekkefølge (den var hardkodet på rollenavn/historikk) → Send hoppet ledd, Besvar gikk bakover, Godkjenn kunne skje uten at godkjenner hadde hatt ballen. Pilot-blokkerende med distinkte personer. Vedtatt modell: **ruting teller posisjon, status avledes** (settes aldri direkte), én delt utledning i `@sitedoc/shared`. Grunnlag: `delplaner/flytmodell-veileder-cowork.md` (fabel, Kenneth-godkjent) + `flytmodell-implementeringsplan.md` + `flytmodell-gate-svar-fabel.md`.

- **Fase 1a** (`7e385ade`, branch @ `5c274e55`): datamodell + migrering `20260731120000`. 8 nye felt (`DokumentflytMedlem`: ansvarsmerke/klassifisering/kanTerminereUtenBall; `Checklist`+`Task`: aktivPosisjon/retning/terminal/sendt). To-stegs migrering (nullable/default, ALDRI drop; status-enum degradert til avledet cache). Deterministisk backfill: `steg` = DENSE_RANK rolle-prioritet, klassifisering `{kontroll,utfor,orienteres}`, terminal inkl. `cancelled→avbrutt`, `sendt`, terminal-aktivPosisjon (valg 4).
- **Fase 1b** (`5391f4f7`, branch @ `9c127e7e`): HMS flyt-binding. HMS-opprett binder dokumentet til prosjektets HMS-flyt (`dokumentflytId` + `aktivPosisjon:2` + `sendt:true`, graceful fallback). Interim sikkerhetsgate: `verifiserFlytRolle` hoppet for `domain="hms"` i `endreStatus` (fjernet igjen i Fase 3). Backfill `20260731140000`. FlytIndikator skjult for HMS på web; mobil-skjul utsatt til Fase 4 (manglet `domain`-plumbing).
- **Vedtak (Kenneth 31.07):** klassifisering + retningsrettigheter (← = kontroll+utfør, ↔ = H3), HMS = ordinær 2-ledds flyt, `cancelled`→terminal `avbrutt`, sletting § 2.5 (utkast `!sendt` = hard, underveis = myk 90d, terminaler aldri slettbar; rett = firmaadmin + prosjektadmin + sitedoc), FLAGG 1–3.
- **Fase 2** (`94b99149`, branch @ `e87a7120`+`7b378fda`): delt utledning `packages/shared/src/utils/flytPosisjon.ts` — 7 funksjoner + `FlytPosisjonLedd`-type. 37 enhetstester + **divergens-test** (gammel recipient-basert vs. ny posisjons-basert `harBallen`: Kenneths pilot-case divergerer på 2 seere = beviser at den nye er riktig). Reconciliation Q1–Q4 (fabel): `received`/`in_progress` kollapser til «Hos N», `harBallen` posisjons-basert, `avvist`→`dismissed` i cache.
- **Fase 3** (3.1 `8758bb1b` · 3.2 `deaa578e` · 3.3+3.4+3.5 `7a1b172e`): **server-omskriving komplett — rutingen er posisjons-basert.** De 11 statusskrivestedene skriver fakta; `avledStatus` setter status-enum-cachen. Send→`nesteLedd`, Besvar→`forrigeBallLedd`, forwarded→`finnPosisjon`. `verifiserFlytRolle`→`verifiserRetningsrett`; 1b-gaten fjernet. **Besvar-semantikk (fabel-bindende, Tolkning A):** utfører-submit = Send→ framover; Besvar← = KUN retur bakover. 424 shared + 16 api-tester grønne.
- **Fase 3.6** (`773c1a58`, fabel-løsning 1): `received→sent` gjeninnført i `isValidStatusTransition` (én linje). §8A hadde fjernet den som recipient-løs no-op i den gamle modellen; i posisjonsmodellen ruter `sent→nesteLedd`, så «Send → = neste ledd» virker fra ethvert ledd. **Fullfører P1, reverserer den ikke.**
- **Fase 4** (`merge-flyt4` + `feat/flytmodell-fase4-steg34`): **hele klientsiden på posisjonsmodellen.** Web `flyt-ledd.ts` + mobil `dokumentflyt-ledd.ts` konsolidert mot delt `byggPosisjonsLedd`; `forventetRolleKandidater` + `ROLLE_RANG`×3 slettet. **Klient-handlingsfilteret ER serverens `verifiserRetningsrett`** (`hentPosisjonFiltrertHandlinger`) — én kilde, klient = server. Send-fra-received wiret; primær «Send til N · X →» / «Godkjenn og fullfør ✓». shared 429 + web 91 + api-e2e 8 grønt.
- **Fase 5a** (`12d2e401`): server-integrasjons-e2e via `createCaller` — kjører 31.07-sekvensen gjennom ekte `endreStatus` med distinkte personer. Pilot-fiksen bevist: Besvar går IKKE bakover til vilkårlig avsender. Opt-in `test:integration`.
- **Pilot-fiks A+B+D/#11** (`29b26d47`): obsolet utkast-mottakervelger fjernet fra flyt-bundne dok; primær `nesteLedd`-styrt; gjenåpne skriver ikke draft til cache.
- **Runde 2** (`0a833261`, fabel-vedtak): **én bakover-handling** — «Send tilbake» fjernet, «Besvar til N·X ←» er eneste bakover; **`in_progress` kollapset helt** (ingen «Under arbeid» i loggen); trekk-tilbake→«Hos N» + guard; «UTFØRER»→«Faggruppe»; seer-relativ «Venter på deg»-chip; tooltip-portal.
- **Polering P1+S2** (`0daa89e1`): «Send» skjult i split-▾ på siste ledd; admin-flytmatrisens døde `in_progress`-stasjon ryddet.
- **P1-restfiks** (`8b068c73`, selve deploy-commiten): «Send» borte fra deaktivert-visning på siste ledd + DropdownMeny-korrigering.
- **Bygg-stempel:** `GIT_SHA` + byggtid bakt inn i image → `/version` + diskret linje i Innstillinger. Se `deploy-detaljer.md § Bygg-stempel`.

### Effektivitets-runden (audit → P1–P4b)

Fabels **Effektivitets-gate** (klikk-budsjett obligatorisk i brukervendte ordrer) + effektivitets-audit (`verifisering/effektivitets-audit-2026-07.md`) → fiks-plan `delplaner/effektivitets-fiksplan-2026-07-29.md`.

- **P1 Send-bugfiks** (`402b9ce4`): «Send fram» fjernet fra `received`/`responded`/`approved` (recipient-løs no-op — serveren auto-konverterte tilbake, markøren flyttet seg aldri) + first-match rolle-konsistens + flytmatrise-konsistens.
- **P2 småsaker** (`402b9ce4`, 6 wire-ins): byggeplass/tegning i opprett-mutasjoner, lønnsart-prefill web, fjernet suksess-Alert (sjekkliste-mobil), galleri-kobling `FeltDokumentasjon`, V3 web auto-hopp malvelger, onSlett-wiring (fikset utkast-slett-no-op).
- **P3 handlingslinje-redesign** (`50ce6d90`): primær + split-▾ — **5 → 2 flate elementer**; ett-trykks-utkast-slett med papirkurv som sikring. Fabel-godkjent.
- **P4b web ett-klikk opprett** (`4858d342`): delt `DokumentKontekstChipLinje`, utfyllingsmodus + redigerbar tittel, flyt-gruppert mal-velger, `useSistBrukteMal`. Tilgjengelighets-filter (`mal.hentForProsjekt` additivt `opprettbar`) — maler som ville blitt avvist vises ikke lenger. E2e fanget + fikset en stale-closure-bug: **auto-hopp fra toppknappen hadde aldri virket.** Klikk ≤2.
- **P4a mobil iOS-modal** (`0cb74bbe`): serialisert `<Modal onDismiss>` + Platform-gren + `internSynlig`-speil → auto-opprett-skip trygt ved entydig kontekst. GPS best-effort.

### Mobil detalj-redesign M1–M3 (i main, **ikke hos brukerne** — ingen EAS-bygg)

Merget `784c90b7` (branch @ `a8603a4a`). Fabel-ordre `delplaner/mobil-detalj-redesign-ordre-M1-M3.md`, Kenneth-godkjent mockup.

- **M1** én flytlinje i header (rolle-gruppert kjede + «Du har ballen»/«Venter på …»), erstatter `FlytIndikator` + boks-raden.
- **M2** P3-mønsteret på mobil: primær med retningsnavn + split-▾ med alle lovlige handlinger. «Lagre utfylling» demotert; påkrevd-validering = deaktivert Send + «X påkrevde felt gjenstår».
- **M3** ren flyt-sheet (vertikal 1→N, «DIN TUR»-badge, medlemsliste), erstatter flat medlemspopup.
- **Bug fanget i walkthrough:** mobilens `byggLedd` portet til ROLLE-gruppering (speiler web) — steg-gruppering kollapset en 4-rolle-flyt til én chip. Dead code slettet (`DokumentHandlingsmeny` + `FlytIndikator`).

**Gjenstår for mobil:** Kenneths fysiske re-test på develop-bygg + EAS-bygg før noe av dette når felt.

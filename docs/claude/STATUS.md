# STATUS — docs/claude/-filer

> **Vedlikeholdsregel:** STATUS.md oppdateres av Opus i samme commit som endrer fil-status. Aldri separat commit.
>
> **Status oppdateres ved:** (1) ny verifikasjon/screening fullført, (2) drift rettet, (3) fil opprettet/slettet/arkivert, (4) ny prod-deploy som rammer fil-status.
>
> **Konsolidering ≠ verifikasjon:** Når en fil får tilført en ny seksjon med besluttede regler/policy (markert med `K{n}.x YYYY-MM-DD`), endrer det IKKE filens verifikasjons-status. Eksisterende innhold er ikke re-verifisert mot kode. Status forblir som var.
>
> **Kommentar-kolonne-tagger:**
> - `Sannhetskilde:` — innholds-aktiv (peker-mål for andre filer)
> - `Arbeidsanker:` — bruks-aktiv (pågående arbeid, endres ofte)
> - Hvis ingen av delene: kort fri beskrivelse (eller tom)

**Sist oppdatert:** 2026-05-14 (T7-3-bunken merget til develop)
**Antall filer dekket:** 50 (44 i `docs/claude/` + 6 i `docs/arkiv/`) — `neste-oppgave.md` slettet 2026-05-14, innholdet konsolidert til [STATUS-AKTUELT.md § Neste oppgaver](STATUS-AKTUELT.md)

---

## Prod-deploys 2026-05-03 → 2026-05-14

**2026-05-14 — T7-2b-bunken komplett (per-rad-attestering + edit-modus + settings-toggle):**
- `3234c057` — T7-2b1 per-rad-attestering: AttesteringDetalj-felleskomponent, `attesterRader`/`returnerRader`-mutations (per-rad-validering + auth per unike projectId), per-rad-status-badge + checkboxer, firma-detalj-side (`/dashbord/firma/timer/attestering/[id]`). Schema-kommentar-rensk `godkjent → attestert` (ingen migration). Gamle `attester`/`returner` beholdt som `@deprecated` thin wrappers.
- `755c542a` — T7-2b2 edit-modus ved attestering: `redigerSedelRader`-mutation (firma-admin-auth + flagg-gate + transaksjon erstatt/opprett-nye), `OrganizationSetting.tillatt_rediger_ved_attestering` (default false), `parent_rad_id` på alle tre rad-tabeller, `attestertStatus = "erstattet"`. Ny `AttesteringDetalj_Edit.tsx` + 3 sub-komponenter (RedigerTimerRad/TilleggRad/MaskinRad). Activity-log per rediger.
- `af4a7deb` — T7-2b3 settings-toggle: `RedigerVedAttesteringSeksjon` i `firma/innstillinger/page.tsx`, følger samme mønster som eksisterende TilgangPolicySeksjon. 5 nye i18n-nøkler. Ingen server/schema-endring (klargjort i b2).
- `d194332c` — attestering-hint: diskret blå info-stripe i `AttesteringDetalj.tsx` synlig for firma-admin når `tillattRedigerVedAttestering = false`. Peker mot innstillinger-siden (Progressive Disclosure). 2 nye i18n-nøkler. Ingen server-endring (utnytter eksisterende `kanAttestereFirma`-query).
- **Server-side (test-server)**: `deploy-test-cron.sh` fikset med `rm -rf apps/web/.next`-steg før build for å eliminere stale-cache-bug som trigget 3 ganger denne uken. Backup: `~/programmering/deploy-test-cron.sh.bak`. Skriptet er ikke i repo.

**2026-05-13 — OrganizationMember-refaktor bunke + ansattrolle-UI:**
- `95500003` — PR O-5a: fjern `User.organizationId`-fallbacks i `tilgangskontroll.ts` + 8 routes via `resolverOrgFraInput`/`krevBrukersOrg`-hjelpere (netto −484 linjer)
- `54d917d9` — PR O-5b: fjern `User.organizationId`/`ansattnummer`-lesinger i gruppe/medlem/admin/timer-routes (Kat. B + C)
- `fe1d703d` — Bundle: PR O-5b-fix (11 resterende treff) + PR O-5c schema-drop (`User.organizationId`/`ansattnummer`/`avdelingId` + `OrganizationRole`-tabell). Migration `20260513210000_o5c_drop_user_org_fields` applied 22:36:32. `email @unique` globalt.
- `3fa34c57` — ansattrolle-UI: settFirmaAdmin-mutation erstatter endreRolle, ansattRolle-dropdown + firma_admin-checkbox i invitér/rediger-modal, Stilling/Tilgang-kolonner i firma/ansatte-tabellen. Backfill-script `backfill-firma-admin-roller.ts`.

**2026-05-12 — Timer-modul arkitektur-redesign (T.1–T.6) bunke:**
- `bba971ba` — PR 1B: NOT NULL på rad-tabeller + drop `DailySheet.projectId` + ny unique `(userId, dato)`
- `6431873c` — PR 2A: API timer-routes refaktor (dagsseddel/rapport/vareforbruk, 45 → 0 TS-feil)
- `8478d4a7` — PR 2B: Web timer-modaler sender projectId via `useParams` (46 → 0 TS-feil)
- `0700b8ed` — PR 2C min: Mobil defensiv null-guard mot `serverSedel.projectId` null

**2026-05-11 — Timer-arkitektur-forarbeid:**
- `862c70c3` — PR 1A: Schema-additive + backfill (alle kolonner nullable, T.1–T.6 første steg)
- `c7dee528` — `deploy.sh` inkluderer alle 4 db-pakker (db + db-maskin + db-timer + db-varelager)
- `1d819ff4` — fase-0-beslutninger.md § T (T.1–T.6) tilføyd

**2026-05-07 — 4 deploys:**
- `9e264bfa` — Rolle-dropdown outside-click-fix (mousedown→click)
- `f27a63dc` — «Velg fra firma»-flyt for prosjektmedlemmer
- `620a85c7` — Modul-piller i admin/firmaer + Varelager-bug-fix
- `a3765a97` — Admin-impersonering (1t-utløp, audit-banner)

**2026-05-06 — 13 deploys (UX-runde 1+2 + Steg 4b + integrasjoner):**
- `8a184fc8` — HovedSidebar skjult i firma-kontekst + Tilbake-lenke
- `207a223c` — Fakturering-gating + U5 forkastet
- `878e90ec` — Integrasjonsadmin AES-256-GCM + Brreg-autofyll + reginn-rename
- `da00d55d` — B2 onboarding-checkpoint-bar modul-utvidelse
- `2f22c503` — B1 ProsjektVelger Alle/Mine prosjekter scope
- `31cff7da` — U2 CSV/Excel-eksport på timer-rapport
- `e4f594fa` — Mine timer flyttet til HovedSidebar + global scrollbar-fix
- `c551063f` — U1 Timer-rapport firmanivå + React#310-fix
- `1781a17a` — U7 fritekst utstyrstype med datalist-forslag
- `c2da3135` — U3+B3 sidebar tekst-labels + modul-fargedesign
- `3dd4371b` — Heatwork-seed + U6 maskin firma-kontekst-fix
- `37a1fe89` — Steg 4b Sesjon 3 (Vareforbruk-import-flyt + A.Markussen seed)
- `09b4d1ae` — Steg 4b Sesjon 2 (Vareforbruk-routes + UI + Varelager-toggle)

**2026-05-05 — 6 deploys:**
- `0245b265` — admin/prosjekter respekterer FirmaVelger
- `de044be4` — Steg 1e (OrganizationModule erstatter har_*_modul-flagg)
- `66c2e982` — kom-i-gang redirect for sitedoc_admin + opprettTestprosjekt bug-fix
- `d62ffa6c` — Faggruppe full CRUD (to sider konsolidert til én)
- `2e32b867` — Hvem har ballen-badge på sjekkliste/oppgave-detalj
- `5674df71` — P1 Fase 2 (auto-reset prosjekt ved firma-bytte)

**2026-05-04 — 5 deploys:**
- `e2729849` — Blokk C (admin/firmaer erKunde-filter + Timer-kolonne)
- `12717426` — Blokk A (ProsjektVelger filtreres på valgt firma for sitedoc_admin)
- `dbf78bca` — Blokk B (klikkbare prosjektrader på firma/prosjekter)
- `82b2b4c7` / `e3717a8c` — Header-fix (FirmaVelger først, redirect til firma-admin)

**2026-05-03 — 8 deploys:**
- `da6b34a5` — Steg 4a (ECO-flytt på attestering + leder-detaljside)
- `33a2b9b4` — Steg 3 (maskin-import med firma-kontekst og drag-drop UI)
- `a1463561` — Steg 2 (firma-admin-sider komplett — moduler/innstillinger/nytt-prosjekt)
- `73dcbd1a` — Steg 1d (drop ProjectModule.active)
- `87fb7292` — Steg 1c (OrganizationModule auto-sync)
- `045a49b7` — Steg 1b (firma-kontekst Lag 1+2+3)
- `c91d953c` — Steg 1a (Organization.erKunde)
- `1f2c0da2` — SmartDok maskin-import (test-deploy + dag-3-fix før prod-merge)

---

## Develop-only merges (mobil — venter på Expo Go / EAS Build)

**2026-05-14 — T7-3-bunken (mobil timer-redesign — IKKE i prod ennå):**
Server-route-utvidelser (rad-nivå projectId i `syncBatch` + `hentEndringerSiden`) deployes til test ved auto-deploy ved merge til develop. Mobil-endringer rulles ut via Expo Go (utvikler-enhet) eller EAS Build → TestFlight / Play Store (release) — ikke `./deploy.sh`.
- `fc087b65` (merge `22a97402`) — **T7-3a** arbeidstid-seksjon + summerings-banner på mobil. Speil av T7-1a (web). JS-only-endring; ingen DB-migrasjon, ingen sync- eller server-endring. apps/mobile typecheck 12 = 12 baseline.
- `65bf48cb` (merge `cd64c51a`) — **T7-3b1** prosjekt per rad: lokal SQLite-skjema (ALTER + backfill + nye `prosjekt_local`-tabell), sync push/pull med per-rad projectId, ny `prosjektKatalog.ts`-service. Server-`syncBatch`/`hentEndringerSiden` utvidet med per-rad-projectId + ny auth-sjekk per unike rad-projectId. Ingen UI-endringer. Lokal migrasjon fullt-additiv + idempotent; pre-T7-3b1-mobiler kjører videre via kompat-shim.
- `1717fd79` (merge `3e34ec71`) — **T7-3b2** prosjekt-velger per rad i timer/tillegg/maskin-modaler + ProsjektGruppe-visning i [id].tsx + geo-forslag (`expo-location` + Haversine, 500m radius) i ny.tsx. Ny `ProsjektVelger.tsx`. 1 ny i18n-nøkkel (`handling.sok` — rettet pre-eksisterende manglende-nøkkel-bug). Ingen server/skjema-endring.

---

## A.Markussen AS — onboarding-status (prod, verifisert 2026-05-07)

**Org-id:** `4488fe17-7490-409f-9c1c-2827f257c54d`

**Brukere (1):** Florian Aschwanden (`8e3c7f17-...`) — `role=company_admin`, `email=florian@amarkussen.no`. Satt via SQL UPDATE 2026-05-07 (rolle-dropdown var blokkert av `mousedown`-bug — fikset i samme dags deploy `9e264bfa`).

**Prosjekter (1):** «998 Instinniforbotn» (`SD-20260506-0008`)
- Medlemmer: Florian (member) + Kenneth Myrhaug (admin)

**Aktive firmamoduler (3):** `timer`, `maskin`, `varelager` — alle status=`aktiv`

**Datatilstand:**
- 7 vare-kategorier (Grus/pukk/jord 36 varer, Naturstein 8, Diverse 7, Rør 2, Betongstein 2, Forbruk 1, Deponiavgift 1) = 57 varer total
- 2 pris-rader (Matjord m3=100,00, Samfengt grus m3=80,00)
- 127 Equipment-rader (kjøretøy + anleggsmaskin + småutstyr fra SmartDok-import 2026-05-03)
- 5 Heatwork-utleieobjekt (`erUtleieobjekt=true`, `utleieEnhet=doegn`): 7626/7628/7630/7632/7634

**Klar for produksjon:** Florian kan logge inn, se prosjektet, registrere timer + dagsseddel, registrere vareforbruk, og opprette nye prosjekter for A.Markussen som company_admin.

---

## Åpne oppgaver

| Oppgave | Eier | Notat |
|---|---|---|
| Roter eksponert test-nøkkel `1dcd...4fe4` | Kenneth | `SITEDOC_INTEGRATION_KEY` på sitedoc_test ble eksponert i chat-logg under feilsøking 2026-05-07. Generer ny: `openssl rand -hex 32`, oppdater i `~/programmering/sitedoc-test/ecosystem.config.js` (BÅDE web + api), `pm2 reload --update-env` |
| Audit-log-utvidelse for impersonering | Backlog | MVP bruker `console.log` for start/stopp. Per-mutation logging utsatt — krever `Activity`-tabell-utvidelse med `actorId` + `subjectId` |
| Ekstra Heatwork HW-vifte-Equipment | Kenneth | Per Steg 4b § 13: 6 Heatwork-rader skulle opprettes; 5 er ferdig (7626-7634), HW-vifte gjenstår |
| Reginn MREG-integrasjon | Backlog | UI-tile fjernet, type-whitelist `reginn` reservert. API-dokumentasjon mangler — MEF-dialog. Ref. N2.2.3 i oppryddings-plan |
| U5 byggeplass selvstendig flyt | Forkastet 2026-05-06 | Byggeplass-data (geofence, GPS, §15) er prosjekt-bundne. Selvstendig firma-byggeplass = orphan. UX-agenda fullt lukket |
| 7632 + 7634 type-felt rettet manuelt | OK 2026-05-06 | SmartDok-importen ga `type="Anleggsmaskin"` for disse to. Kenneth rettet til `Heatwork 3600/MY35` i UI etter U6-fix-deploy. Beholdes som notat for fremtidig SmartDok-mapping |

---

## Sammendrag

| Status | Antall |
|---|---:|
| ✅ Verifisert mot kode | 6 |
| ⚠️ Drift identifisert | 4 |
| 🔄 Under arbeid | 11 |
| ❌ Ikke screenet | 21 |
| ✔️ Ferdig brukt (lukket) | 3 |
| 📦 Arkivert | 6 |
| **Totalt** | **51** |

---

## ✅ Verifisert mot kode

| Fil | Sist verifisert | Kommentar |
|---|---|---|
| arkitektur.md | 2026-04-27 | **Sannhetskilde:** Fundament |
| arkitektur-syntese.md | 2026-05-01 | **Sannhetskilde:** Anker for Fase 0-koding (sammen med fase-0-beslutninger.md). 3A komplett. § 5 Fase 0.5: A.30 byggeplassId-NULL = A1 vedtatt. § 6.1.1 Cross-modul-tilgang via service-lag |
| dokumentflyt.md | 2026-04-27 | **Sannhetskilde:** Fundament. § 2.3 HMS-tabell utvidet med firma-HMS-ansvarlig-lese-tilgang (per A.27) |
| fase-0-beslutninger.md | 2026-05-12 | **Sannhetskilde:** Anker for Fase 0/0.5-koding. § E KOMPLETT på prod (alle 13 § E-steg). A.4-overstyring oppdatert 2026-05-05 (peker til Steg 1e). **§ T (T.1–T.6) tilføyd 2026-05-11 (`1d819ff4`)** — Timer-modul arkitektur-redesign, deployet prod 2026-05-12 (PR 1A–2C) |
| terminologi.md | 2026-04-27 | **Sannhetskilde:** Fundament |
| SITEDOC-CLAUDE-VEILEDER.md | 2026-05-03 | **Meta-fil:** Sesjonsoppstart-veileder for Opus |

## ⚠️ Drift identifisert (Bunke 3A.1, 2026-04-28)

| Fil | Sist verifisert | Drift-omfang |
|---|---|---|
| forretningslogikk.md | 2026-04-28 | Byggeplan-rekkefølge motsigelse mot arkitektur-syntese, Godkjenning-status, lestAv-mekanikk for gruppe-mottaker |
| mobil.md | 2026-04-28 | 5 faggruppe-forekomster + 3 ulike Provider-tre-rekkefølger |
| okonomi.md | 2026-04-28 | 4 faggruppe-forekomster + FtdNotaComment mangler i tabell + ECO/Godkjenning-kobling mangler |
| web.md | 2026-04-28 | 21 faggruppe-forekomster + feil ruter (`/entrepriser` → `/faggrupper`) + feil API-navn (`hentMineEntrepriser` → `hentMineFaggrupper`). Drift økt etter UX-runde + Vareforbruk-modul: nye sider `/dashbord/firma/varelager`, `/dashbord/[prosjektId]/vareforbruk`, `/dashbord/firma/timer/rapport`, `/dashbord/firma/innstillinger/integrasjoner`, `/dashbord/admin/integrasjoner` mangler i web.md |

## 🔄 Under arbeid

| Fil | Sist verifisert | Kommentar |
|---|---|---|
| onboarding-veileder.md | ikke aktuelt | Idé-stadium, planlagt ~1 måned frem (post-Fase 0). Etablert 2026-04-28 |
| mannskap.md | 2026-04-28 | **Vy-beskrivelse i PSI-konteksten** etter 1D-presisering. Datamodell forkastet (Mannskapsmedlem dupliserer User per memory). Endelig datamodell designes Fase 4 (PSI-utvidelse) |
| oppryddings-plan-2026-04-28.md | 2026-04-30 | **Arbeidsanker:** Aktiv anker. P1.1+P1.2+P1.3+P1.4+P1.5+P1.6+P1.7+P4.3+P4.4+C.15+SCREENING-29-1+SCREENING-29-3 lukket. N2.2.3+N2.2.4 omformulert (avventer ekstern API-tilgang). 3A komplett |
| timer-funn-fra-screening-2026-04-27.md | 2026-04-28 | **Arbeidsanker:** Midlertidig, slettes etter Timer/Maskin-revurdering |
| dagsseddel-design.md | 2026-05-02 | **Arbeidsanker:** Aktivitet flyttet til `SheetTimer.aktivitetId` (NOT NULL) per rad — implementert i Runde 2.5/C9 deployet til prod 2026-05-02 |
| domene-arbeidsflyt.md | 2026-05-03 | **Arbeidsanker:** Styrende dokument. Steg 1a-1e ✅ prod, Steg 2 ✅ prod, Steg 3 ✅ prod, Steg 4a ✅ prod, Steg 4b (Vareforbruk) ✅ prod 2026-05-06. Tre åpne spørsmål gjenstår |
| navigasjon-arkitektur-analyse-2026-05-03.md | 2026-05-03 | **Arbeidsanker:** Tiltak #1-#7 i prioritert rekkefølge fullført. Header-fix + Blokk A/B/C deployet 2026-05-04. Faggruppe-konsolidering 2026-05-05. P1 Fase 1+2 lukket. P2 (admin/firmaer erKunde) lukket. Klikkbare prosjektrader lukket |
| STATUS-AKTUELT.md | 2026-05-12 | **Arbeidsanker:** Aktiv statusrapport. § Timer-modul revisjon (kartlegging 2026-05-11) + § Implementasjonsstatus PR 1A→2C tilført. Hele PR 1A–2C-bunken merket DEPLOYET TIL PROD 2026-05-12 |
| prosjektoppsett-veileder.md | 2026-05-02 | **Arbeidsanker:** UX-funn 2026-05-02 (4 × 404). Faggruppe-side-konsolidering deployet 2026-05-05 lukker første tiltak. Nye UX-fix i UX-runde 1+2 lukker resten. Skal re-verifiseres mot ny prod-tilstand |
| admin-navigasjon-analyse-2026-05-03.md | 2026-05-03 | **Arbeidsanker:** Komplett kartlegging av admin-navigasjon. P1 Fase 1+2 lukket via Blokk A (`12717426`) + auto-reset (`5674df71`). P2 admin/firmaer erKunde-filter lukket via Blokk C (`e2729849`). Klikkbare prosjektrader lukket via Blokk B (`dbf78bca`). 4 åpne beslutninger gjenstår |
| steg-4b-plan.md | 2026-05-05 | **Arbeidsanker:** 5-faset Vareforbruk-plan. Sesjon 1 (Fase 1+2) + Sesjon 2 (Fase 3+4) + Sesjon 3 (Fase 5 import) deployet til prod 2026-05-06. A.Markussen seedet (7 kategorier + 57 varer + 5 Heatwork-Equipment). HW-vifte gjenstår manuelt |

## ✔️ Ferdig brukt (lukket — innhold dekt av prod)

| Fil | Lukket | Kommentar |
|---|---|---|
| ux-arkitektur-agenda.md | 2026-05-06 | KOMPLETT LUKKET. 3 vedtatte beslutninger (B1+B2+B3) deployet. 6 åpne oppgaver løst (U1+U2+U3+U6+U7). U4 erstattet av B3, U5 forkastet 2026-05-06. Beholdes som historikk; ikke aktiv anker |
| smartdok-undersokelse.md | 2026-05-03 | **Sannhetskilde:** SmartDok UI-research 2026-04-26 brukt som basis for SmartDok-import 2026-05-03 (`1f2c0da2`) + Heatwork-utleie-Equipment-utvidelse 2026-05-06. Beholdes som referanse for fremtidig SmartDok-cutover |
| timer-input-katalog.md | 2026-05-02 | Timer-input-spec brukt for Runde 1A (lønnsarter/aktiviteter/tillegg) deployet til prod 2026-05-01. Beholdes som referanse |

## ❌ Ikke screenet

| Fil | Sist verifisert | Kommentar |
|---|---|---|
| adaptiv-sok-plan.md | — | Skal drøftes (per CLAUDE.md) |
| aktivitetsfeed.md | 2026-05-01 | **Planlagt fase** (etter Maskin Fase 1 + Timer Fase 3). Activity-tabell finnes i prod (E.1 `13a746a7`), ingen produsent-kode skrevet ennå |
| ai-integrasjon.md | — | — |
| ai-sok.md | — | — |
| api.md | — | Drift mtp UX-runde + Vareforbruk-modul: nye routere `vareKategori`/`vare`/`vareforbruk`/`vareImport`/`firmaIntegrasjon`/`timer.rapport` ikke dokumentert |
| bibliotek.md | — | Peker til kontrollplan.md (konsolidert) |
| byggeplass-strategi.md | — | Planlagt fase. Fase 0.5 §§ 1-3 + § 5 implementert 2026-05-01. ByggeplassMedlemskap utsatt til Fase 4 (Mannskap) |
| db-naming-audit-2026-04-25.md | — | Datert audit 2026-04-25 |
| db-opprydning.md | — | **Arbeidsanker:** Markert AKTIV |
| deploy-detaljer.md | — | Operasjonell deploy-info. Lærdom om SITEDOC_INTEGRATION_KEY må stå i BÅDE web- og api-ecosystem-blokker tilføyd 2026-05-07 |
| hjelpetekster.md | — | Konvensjon for ?-ikon + sidestatus-tabell |
| infrastruktur.md | — | — |
| kontrollplan.md | — | — |
| maskin.md | 2026-05-01 | Blokk A+B+C+C1+C2 + parser-verifikasjon. Prod-deploy 2026-05-01. **Steg 3 deployet 2026-05-03** (`33a2b9b4`) — sitedoc_admin med firma-kontekst kan importere SmartDok-Excel. **U6-fix 2026-05-06** (`3dd4371b`) — equipment-router gates trygt på sitedoc_admin firma-kontekst. **Equipment-utleie-utvidelse 2026-05-06** (`b7127475`) — `erUtleieobjekt`/`utleieprisPerDogn`/`utleieprisPerTime`/`utleieEnhet` |
| migrering-reporttemplate.md | — | Ikke implementert |
| planlegger.md | — | Planlagt fase |
| shared-pakker.md | — | — |
| smartdok-undersokelse-2026-04-25.md | — | Arkivert v1 |
| timer.md | 2026-05-12 | Runde 1A+1B+1C (`c1122c2e`) + Runde 2 C1-C8 (`1cce62f3`) + Runde 2.5/C9 + 2.6 + 2.7 (`de33aefc`/`03d8c63a`/`05b3bddb`) + attestering-rename (`8aa792b2`) deployet til prod 2026-05-02. **Steg 4a** (ECO-flytt på attestering, `da6b34a5`) deployet 2026-05-03. **U1** (leder-timer-rapport, `c551063f`) + **U2** (CSV/Excel-eksport, `31cff7da`) deployet 2026-05-06. **T.1–T.6 arkitektur-redesign** (PR 1A `862c70c3` + PR 1B `bba971ba` + PR 2A `6431873c` + PR 2B `8478d4a7` + PR 2C min `0700b8ed`) deployet prod 2026-05-12: `DailySheet.projectId` droppet, projectId/byggeplassId/fraTid/tilTid/attestert*-felter på rad-nivå, `OrganizationSetting.tidsrundingMinutter` (T.5). Schema-tabeller og indekser oppdatert. Åpen oppgave: PR 2C full (mobil Drizzle-omskriving) |
| varsling.md | — | — |

## 📦 Arkivert

| Fil | Arkivert | Kommentar |
|---|---|---|
| arkitektur-oppsummering-2026-04-25.md | 2026-04-28 | Datert arkitektur-snapshot → [docs/arkiv/](../arkiv/). Innhold dekt av arkitektur-syntese.md |
| arkitektur-qa-runde-2-2026-04-25.md | 2026-04-28 | Opus QA-runde 2 → [docs/arkiv/](../arkiv/). Beslutninger konsolidert til fase-0-beslutninger.md |
| audit-data-2026-04-25.md | 2026-04-28 | Read-only audit av dev-DB → [docs/arkiv/](../arkiv/). Åpne audit-spørsmål til db-opprydning.md |
| entreprise-faggruppe-rapport.md | (eldre) | Faggruppe-rename-rapport → [docs/arkiv/](../arkiv/). Faggruppe-rename ferdig på prod (kun alias-rydding gjenstår) |
| faggruppe-rename-plan.md | (eldre) | Faggruppe-rename-plan → [docs/arkiv/](../arkiv/). Plan utført; faggruppe-CRUD-konsolidering deployet 2026-05-05 |
| infrastruktur-moduler.md | (eldre) | Modul-infrastruktur-spec → [docs/arkiv/](../arkiv/). Innhold dekt av arkitektur-syntese.md § 6 + service-lag-mønster |

---

## Forklaring av status-koder

- **✅ Verifisert mot kode** — Innhold sammenlignet mot Prisma-schema/API-routere/UI på datert kjøring. Drift rettet eller ikke funnet. + Kode-kvalitet vurdert. Behandles som pålitelig.
- **⚠️ Drift identifisert** — Innhold sammenlignet mot kode på datert kjøring. Avvik funnet og dokumentert, men ennå ikke rettet. Behandles som upålitelig på drift-punktene; resten kan brukes med varsomhet.
- **🔄 Under arbeid** — Aktiv arbeidsfil hvor innholdet endres aktivt og status-spørsmålet ikke er meningsfylt før arbeidet er ferdig. Skal slettes eller flyttes til ✅/⚠️/✔️/📦 når arbeidet er ferdig.
- **✔️ Ferdig brukt** — Plan/spec som er fullført og innhold dekt av prod-kode. Beholdes som referanse, ikke aktiv anker. Hvis filen ikke har historisk verdi → arkiver.
- **❌ Ikke screenet** — Aldri verifisert mot kode i en planlagt screening-runde. Innhold kan stemme — eller ikke. Behandles som upålitelig inntil det motsatte er bevist.
- **📦 Arkivert** — Filen er flyttet til `docs/arkiv/` etter at innholdet er overført til aktive sannhetskilder. Hjemløse beslutninger fanget før arkivering. Beholdes for historikk, ikke aktiv referanse.

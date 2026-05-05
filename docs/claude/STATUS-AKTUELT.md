---
name: STATUS-AKTUELT
description: Løpende statusrapport for pågående arbeid, pauset arbeid og planlagte faser. Oppdateres ved hver vesentlig fremdrift.
sist_verifisert_mot_kode: 2026-05-02
---

# SiteDoc — aktuell status

Detaljert løpende statusrapport. CLAUDE.md har kort sammendrag øverst med
peker hit. Beslutningsgrunnlag og arkitektur ligger i
[fase-0-beslutninger.md](fase-0-beslutninger.md) og
[arkitektur-syntese.md](arkitektur-syntese.md).

## Pågående arbeid

**FirmaVelger-kontekst på `kom-i-gang` IMPLEMENTERT på develop 2026-05-05.** Lukker en regresjon som ble identifisert under faggruppe-konsolideringssesjonen: `prosjekt.opprettTestprosjekt`-mutationen ignorerte FirmaVelger-kontekst og brukte alltid innlogget brukers `organizationId`. Sitedoc_admin (Kenneth, org=Kenneths testmiljø) som hadde valgt A.Markussen i FirmaVelger og klikket «Start gratis prøveperiode» på `/dashbord/kom-i-gang` fikk prosjektet opprettet på Kenneths testmiljø, ikke A.Markussen. Steg 1b/2d-mønsteret (organizationId-input + sitedoc_admin-autorisering) fanget alle `/dashbord/firma/*`-rutene + `prosjekt.opprett`, men `opprettTestprosjekt` ble glemt fordi den ligger i kom-i-gang-flyten utenfor firma-tre-strukturen.

**Strategi: redirect + fix.** Ikke to flyter på samme side («kom-i-gang» er konseptuelt for nye brukere, ikke superadmin som onboarder kunder; «prøveperiode»-framing er semantisk feil for betalende kunde). I stedet redirectes sitedoc_admin bort, og selve mutationen fixes som forsvar i dybden.

**Endringer:**
- **Server (`apps/api/src/routes/prosjekt.ts`):** `opprettTestprosjekt` får valgfri `organizationId: z.string().uuid().optional()`-input. Speiler `prosjekt.opprett`-autorisering (linje 127-141): sitedoc_admin → enhver org, vanlig bruker → kun egen org, ellers FORBIDDEN. Fallback til `bruker.organizationId` når input ikke gitt. `Project.primaryOrganizationId` + `ProjectOrganization` + `ProjectModule`-rader bruker nå `valgtOrgId` i stedet for `bruker.organizationId`.
- **Klient (`apps/web/src/app/dashbord/kom-i-gang/page.tsx`):** Importerer `useFirma`. Ny `useEffect` lytter på `erSitedocAdmin`, `valgtFirma`, `firmaLaster`. Sitedoc_admin med valgt firma → `router.replace("/dashbord/nytt-prosjekt")` (siden har info-banner for sitedoc_admin fra Steg 2d). Sitedoc_admin uten valgt firma → `router.replace("/dashbord/admin/firmaer")` (kan velge eksisterende eller opprette nytt — «Opprett firma»-knapp finnes allerede). Vanlig bruker / company_admin: ingen redirect. Prøveperiode-mutation sender nå `valgtFirma?.id` som organizationId — defensivt, gjelder også sjeldne tilfeller der vanlig bruker har flere orger.

**Hva endringen IKKE dekker (separate oppgaver):**
- `eksternKostObjekt.ts:22-28` (`hentBrukerOrgId`-helper) faller fortsatt tilbake til `bruker.organizationId`. Read-only ECO-katalog-list — sitedoc_admin med valgt firma ser fortsatt egen ECO-liste, ikke valgt firmas. Mindre alvorlig (ingen skriving). Tas i egen runde hvis det blir aktuelt.
- Slå sammen `kom-i-gang` og `nytt-prosjekt` til én smart side — strukturell endring, ut av scope.
- Onboarding-veileder + prosjektoppsett-veileder (planlagt post-Fase 0) — ikke berørt.

**Verifisering:** `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (33.1s). Ingen DB-migrasjon, ingen i18n.

**Auto-deployes til test via cron** etter push. Klar for verifisering. Claude verifiserer som **Tore SiteDocAdmin** på test: (1) velg Byggeleder i FirmaVelger, gå til `/dashbord/kom-i-gang` → forventet auto-redirect til `/dashbord/nytt-prosjekt`; (2) fjern firma-valg via DevTools `localStorage.removeItem("sitedoc-valgt-firma")`, refresh `/dashbord/kom-i-gang` → forventet redirect til `/dashbord/admin/firmaer`; (3) som **Per Prosjektadmin** (vanlig bruker): `/dashbord/kom-i-gang` viser fortsatt feature-kort + prøveperiode-knapp, klikk oppretter prosjekt på Per Prosjektadmins firma (Byggeleder).

**Faggruppe-side-konsolidering IMPLEMENTERT på develop 2026-05-05.** Lukker Tiltak 2 i [navigasjon-arkitektur-analyse-2026-05-03.md](navigasjon-arkitektur-analyse-2026-05-03.md) og er forutsetning for selvstendig A.Markussen-onboarding (per [STATUS-AKTUELT.md § Onboarding-veileder](STATUS-AKTUELT.md)). De to nesten-identiske sidene er erstattet med én konsolidert side.

**Funn under verifisering FØR koding:** Statusrapporten beskrev legacy-siden `/dashbord/prosjekter/[id]/faggrupper` som «full CRUD», men kode-verifisering viste at den kun hadde **opprett**-Modal — ingen rediger eller slett i UI. Server-routeren (`apps/api/src/routes/faggruppe.ts`) har full CRUD inkludert `oppdater` og `slett` (sistnevnte med pen feilmelding ved tilknyttede sjekklister/oppgaver). Konsolideringen krevde derfor å bygge rediger og slett som ikke fantes i UI fra før — ikke ren sammenslåing.

**Endringer:**
- **Klient (`apps/web/src/app/dashbord/[prosjektId]/faggrupper/page.tsx`):** Erstattet read-only tabell + «Administrer faggrupper»-lenke med full CRUD: «Ny faggruppe»-header-knapp, rediger-/slett-ikoner per rad i ny handlinger-kolonne. Tre modaler — `OpprettFaggruppeModal` (firmanavn + org.nr), `RedigerFaggruppeModal` (samme felter, prefylt, lokal id-tracking for state-reset ved bytte av rad), `SlettFaggruppeDialog` (ekte modal per CLAUDE.md UI-regel, viser server-feilmelding hvis koblinger blokkerer slett). Alle felter har `t()` for i18n.
- **Slettet:** `apps/web/src/app/dashbord/prosjekter/[id]/faggrupper/page.tsx` (hard delete — ingen redirect-stub, web-URL-er trenger ikke API-bakoverkompat).
- **Nav-rens (`apps/web/src/app/dashbord/prosjekter/[id]/layout.tsx`):** Fjernet «Faggrupper»-fanen fra tab-nav-arrayet. Fanene Oversikt/Maler/Sjekklister/Oppgaver beholdt — opprydding av hele legacy-`prosjekter/[id]`-strukturen er separat oppgave.
- **Kort-href (`apps/web/src/app/dashbord/prosjekter/[id]/page.tsx`):** Faggrupper-oversiktskortet peker nå til `/dashbord/${id}/faggrupper` (ny rute) i stedet for `${basePath}/faggrupper` (slettet).
- **i18n:** 1 ny nøkkel `faggrupper.bekreftSlett` (nb+en — «Slett faggruppen «{{navn}}»? Dette kan ikke angres.»). Gjenbrukte `faggrupper.{nyFaggruppe,redigerFaggruppe,slettFaggruppe,ingenFaggrupper,ingenFaggrupperBeskrivelse,firma,organisasjonsnummer}` + `handling.{opprett,lagre,slett,avbryt,rediger}` + `dashbord.medlemmer` + `nav.{sjekklister,oppgaver}`.

**Hva konsolideringen IKKE dekker (separate oppgaver):**
- Rediger ansvarlig/farge/partner — Kenneth bekreftet at disse tas i egen runde (ut av scope)
- Soft-delete (deaktiver) — server har det, UI bruker hard delete (Kenneths beslutning, server returnerer pen feilmelding ved koblinger)
- Hele `dashbord/prosjekter/[id]/*`-strukturen — kun Faggrupper-fanen fjernet, andre faner og selve oversiktssiden står igjen
- i18n-nøkkel `faggrupper.administrerBeskrivelse` (gammel hjelpetekst på read-only-siden) — er ikke i bruk lenger, kunne fjernes som opprydding

**Verifisering:** `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (31.7s) — ny rute `/dashbord/[prosjektId]/faggrupper` (3.1 kB) kompilert, legacy `/dashbord/prosjekter/[id]/faggrupper` borte fra build-output. Ingen DB-migrasjon, ingen server-endring (router har full CRUD fra før).

**Auto-deployes til test via cron** etter push. Klar for verifisering. Claude verifiserer som **Per Prosjektadmin** på test: (1) opprett ny faggruppe «Test AS» med org.nr → vises i tabell, (2) rediger til «Test AS Endret» → oppdatert i tabell, (3) prøv slette en faggruppe med tilknyttet sjekkliste → får pen feilmelding fra server («Kan ikke slette ... fordi den har X sjekklister tilknyttet»), (4) slett en faggruppe uten koblinger → forsvinner, (5) verifiser at `/dashbord/prosjekter/[prosjektId]/faggrupper` returnerer 404, (6) verifiser at Faggrupper-fanen er borte fra `/dashbord/prosjekter/[prosjektId]`-tab-nav.

**«Hvem har ballen»-badge på dokument-detaljsider IMPLEMENTERT på develop 2026-05-05.** Lukker funn fra STATUS-AKTUELT.md (2026-05-02): «Inne på dokumentet vises kun status — ingen «Venter på X»». Listene hadde badge fra før — kun detalj-sidene manglet. Server: `sjekkliste.hentMedId` + `oppgave.hentMedId` får `recipientGroup: { select: { id, name } }` på toppnivå (var inkludert i `transfers`-relasjonen, men ikke direkte på dokumentet). Klient: badge ved siden av `<StatusBadge />` i header på `[prosjektId]/sjekklister/[sjekklisteId]/page.tsx` og `[prosjektId]/oppgaver/[oppgaveId]/page.tsx`. Synlig kun når status ∈ {sent, received, in_progress} OG `recipientGroup?.name` finnes — speiler liste-vyenes logikk eksakt. Bruker eksisterende i18n-nøkkel `tabell.venterPaa` (allerede i nb+en, ingen ny nøkkel). Sjekkliste-detalj-siden manglet `useTranslation`-import — lagt til. Oppgave-detalj-siden hadde det fra før.

**Hva «Hvem har ballen»-badge IKKE dekker:**
- `recipientUserId`-tilfellet (transfer sendt til konkret person, ikke gruppe). Speiler listene som også kun viser gruppe. Person-tilfellet kan tas senere hvis det blir etterspurt.
- `<FlytIndikator>`-komponenten på detalj-sidene viser allerede flyten — badge er supplement, ikke erstatning.

**Verifisering:** `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (27.3s). Ingen DB-migrasjon, ingen ny i18n.

**Auto-deployes til test via cron.** Klar for verifisering. Claude verifiserer på test som **Per Prosjektadmin**: åpne en sjekkliste/oppgave med status=sent eller received → forventet «Venter på: [gruppenavn]»-badge ved siden av status-pill i header.

**P1 Fase 2 (auto-reset av prosjekt ved firma-bytte) DEPLOYET TIL PROD 2026-05-05** (`5674df71` merge, `26cc0326` impl). HTTP/2 200 verifisert. Sitedoc_admin med valgt firma og aktivt prosjekt fra annet firma (eller standalone) får automatisk reset + redirect til `/dashbord`. Type-utvidelse: `Prosjekt`-interface i klient-konteksten får `primaryOrganizationId: string | null`. Lukker P1 fullt ut sammen med Blokk A.

**P1 Fase 2 (auto-reset av prosjekt ved firma-bytte) IMPLEMENTERT på develop 2026-05-05.** Lukker P1 fullt ut sammen med Blokk A. Femte tiltak fra [admin-navigasjon-analyse-2026-05-03.md](admin-navigasjon-analyse-2026-05-03.md) (tabell-rad #5).

**Atferd per scenario:**
| Scenario | Før | Etter | Atferd |
|---|---|---|---|
| A | Byggeleder + Byggeleder-prosjekt aktivt | Annet firma | **Reset** + redirect til `/dashbord` |
| B | Byggeleder + Byggeleder-prosjekt aktivt | Byggeleder (idempotent) | Ingen reset |
| C | Ingen firma + Byggeleder-prosjekt aktivt | Byggeleder | Ingen reset |
| D | Ingen firma + A.Markussen-prosjekt aktivt | Byggeleder | **Reset** + redirect |
| E | Byggeleder + Byggeleder-prosjekt aktivt | Fjerner firma-valg (null) | Ingen reset |
| F | Standalone-prosjekt aktivt | Et firma valgt | **Reset** + redirect |

**Endring:** `apps/web/src/kontekst/prosjekt-kontekst.tsx`:
- `Prosjekt`-interface utvidet med `primaryOrganizationId: string | null`. Server returnerer feltet uendret (`prosjekt.hentMedId` bruker `findUniqueOrThrow` uten select-klausul, alle toppnivå-felter inkludert) — ingen server-endring.
- Ny `useEffect` lytter på `valgtFirma`, `valgtProsjekt`, `lasterValgt`. Vakt-rekkefølge: `if (!valgtFirma) return` (ingen begrensning ved null-firma) → `if (lasterValgt) return` (vent på data) → `if (!valgtProsjekt) return` → `if (matched) return`. Ved konflikt: `setLagretProsjektId(null) + localStorage.removeItem(STORAGE_KEY) + router.push("/dashbord")`.

**Hva P1 Fase 2 IKKE dekker:**
- URL-deeplink: hvis sitedoc_admin lim-er en `/dashbord/[prosjektId]/...`-URL og prosjektet ikke matcher valgt firma, vil URL-en dominere over localStorage. Reset trigges først når `hentMedId` returnerer prosjektet og useEffect kjører — kort flicker mulig.
- Auto-velg første prosjekt etter reset: brukeren havner på `/dashbord` (ikke automatisk-redirect). Auto-redirect-logikk i `dashbord/page.tsx` håndterer 1-prosjekt-case.
- Auto-reset ved tilgangstap (separat fra firma-bytte-flow).

**Verifisering:** `pnpm build --filter @sitedoc/web` grønt (27.9s). Ingen DB-migrasjon, ingen i18n, ingen server-endring.

**Auto-deployes til test via cron** etter push. Klar for verifisering. Claude verifiserer som **Tore SiteDocAdmin**: (1) scenario A — velg Byggeleder, åpne et Byggeleder-prosjekt, bytt til annet firma → forventet redirect til `/dashbord`; (2) scenario B — bytte Byggeleder→Byggeleder via FirmaVelger → ingen reset; (3) scenario E — fjern firma-valg via DevTools `localStorage.removeItem("sitedoc-valgt-firma")` → ingen reset.

**Auto-deploy-cron implementert 2026-05-05** (`b4a920b1` på develop). Polling-cron `*/2 * * * *` på serveren erstatter manuell SSH-deploy. Script: `~/programmering/deploy-test-cron.sh`. Logg: `~/programmering/logs/deploy-test.log`. Verifisert end-to-end: push `76a2b4c8` → cron 01:14:00 → deploy fullført 01:14:12 (FULL TURBO 437ms build). Idempotent: kjører kun ved diff mellom HEAD og origin/develop. Funnet under undersøkelse: Tidligere «auto-deploy-hook» nevnt i SITEDOC-CLAUDE-VEILEDER.md var dokumentasjons-drift — ingen mekanisme har eksistert til nå (verifisert ved sjekk av lokale + server git-hooks, GitHub Actions, PM2-prosesser, crontab og systemd). Cloudflare Access via tunneled SSH gjorde GitHub Actions-veien mer kompleks enn polling-cron — derfor cron-løsningen.

**Blokk C (P2 — admin/firmaer erKunde-filter + Timer-kolonne) DEPLOYET TIL PROD 2026-05-04** (`e2729849` merge, `261a0c8e` impl). Tredje del av [admin-navigasjon-analyse-2026-05-03.md](admin-navigasjon-analyse-2026-05-03.md) (tiltak #3 i prioritert tiltak-rekkefølge). Lukker P2-funnet: skall-firmaer blandes ikke lenger med kunde-firmaer i admin-vyen, og Timer-modul-status er synlig på linje med Maskin.

**Endringer:**
- **Server (`apps/api/src/routes/admin.ts`):** `hentAlleOrganisasjoner` får `where: { erKunde: true }` på `findMany`. Ingen klient-endring kreves for filteret. Test-DB: filteret skjuler 4 skall-firmaer (Byggherre, Tømrer Hansen, Elektrikker Hansen, Hovedentreprenør) og viser kun Byggeleder. Prod-DB: viser A.Markussen, HRP AS og Kenneths testmiljø — 0 skall-firmaer å filtrere ut.
- **Klient (`apps/web/src/app/dashbord/admin/firmaer/page.tsx`):**
  - Type `OrganisasjonRad` utvidet med `harTimerModul: boolean`.
  - `Clock`-ikon importert fra lucide-react.
  - Tabell-header: ny `<th>Timer</th>` plassert mellom Integrasjoner og Maskin (matcher rekkefølgen i `firma/moduler`).
  - `FirmaRad`-celle for Timer: speiler Maskin-celle-stilen (Clock-ikon + grønn «Ja» når aktivert, grå «Nei» ellers).
  - Slide-over-detaljpanel: ny Timer-modul-status-seksjon FØR Maskin-modul-status-seksjonen (samme rekkefølge og stil — `Clock`-ikon, Aktivert/Ikke aktivert, peker til `/dashbord/firma/moduler` for endring).
- Ingen ny i18n (eksisterende kolonne-overskrifter på siden er hardkodet i samme stil — i18n-konvertering er separat opprydningsoppgave).

**Hva Blokk C IKKE dekker:**
- Skall-firma-toggle eller debug-vy: skall-firmaer er nå fullstendig usynlige fra admin-vyen. Hvis sitedoc_admin trenger å se dem (debug, opprydning) må de gå via psql.
- Abonnement-status / fakturaoversikt (P5 — egen design-runde, ~1-2 dager).
- Klikk-til-firma-admin (klikke firma → se firmaets prosjekter): slide-over viser allerede prosjekter, men ingen direkte snarvei til `/dashbord/firma/*`-administrasjon. Separat oppgave.
- i18n-konvertering av admin-vyen: hele siden har hardkodet norsk tekst. Ikke i scope for Blokk C.

**Verifisering:** `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (34.8s). Ingen DB-migrasjon, ingen i18n.

**Klar for test-deploy.** Stopper og rapporterer per Kenneths instruks. Claude verifiserer som **Tore SiteDocAdmin** på `/dashbord/admin/firmaer`: (1) listen viser kun Byggeleder (skall-firmaer skjult), (2) Timer-kolonne synlig mellom Integrasjoner og Maskin, (3) Byggeleder viser Ja for både Timer og Maskin (har_timer_modul=true, har_maskin_modul=true), (4) klikk på Byggeleder-rad åpner slide-over med både Timer-modul-seksjon og Maskin-modul-seksjon.

**Blokk A (P1 Fase 1 — prosjektliste filtreres på valgt firma) DEPLOYET TIL PROD 2026-05-04** (`12717426` merge, `51d5e3ee` impl). Andre del av [admin-navigasjon-analyse-2026-05-03.md](admin-navigasjon-analyse-2026-05-03.md) (tiltak #2). HTTP/2 200 verifisert mot sitedoc.no. Sitedoc_admin med valgt firma i FirmaVelger ser nå kun prosjekter med matchende `primaryOrganizationId`. Server: `prosjekt.hentMine`+`hentAlle` tar valgfri `organizationId`. Klient: 4 callsites migrert (prosjekt-kontekst, dashbord, prosjekter-listing, timer/mine). Tom-state for sitedoc_admin med valgt firma og 0 prosjekter får firmaspesifikk tekst (1 ny i18n-nøkkel `dashbord.ingenProsjekterForFirmaBeskrivelse` nb+en). Bakfyll test-DB: 2 prosjekter satt til Byggeleder. Vanlig bruker / company_admin uberørt — `members.some.userId`-filter beholder isolasjon. Auto-reset av aktivt prosjekt ved firma-bytte er P1 Fase 2 (utsatt).

**Klikkbare prosjektrader på `/dashbord/firma/prosjekter` DEPLOYET TIL PROD 2026-05-04** (`dbf78bca` merge, `59338895` impl). Blokk B fra [admin-navigasjon-analyse-2026-05-03.md](admin-navigasjon-analyse-2026-05-03.md) (tiltak #7 — quick-win før Blokk A). HTTP/2 200 verifisert mot sitedoc.no. Hele tabellraden navigerer til `/dashbord/[id]` ved klikk; `<Link>` på prosjektnavnet beholdt for cmd/ctrl+click + tastatur-fokus. `onClick` hopper over hvis target er innenfor `<a>`-tag. 1 fil endret (7 linjer).

**Header-fix per rolle DEPLOYET TIL PROD 2026-05-04** (`e3717a8c` merge, `f78113c5` impl). HTTP/2 200 verifisert mot sitedoc.no. Toppbar-rekkefølge per Kenneths rolle-spec av 2026-05-04 (etter korreksjonen 2026-05-03 om at Prosjekt er firmamodul, ikke toppnivå-entitet, dokumentert i [admin-navigasjon-analyse-2026-05-03.md](admin-navigasjon-analyse-2026-05-03.md)).

**Endringer per rolle:**
| Rolle | Header (venstre → høyre) |
|---|---|
| sitedoc_admin | SiteDoc \| **FirmaVelger** \| Prosjekt \| (Byggeplass) \| Admin-knapp |
| company_admin | SiteDoc \| **Firma-fast-link** \| Prosjekt \| (Byggeplass) |
| user | SiteDoc \| Prosjekt \| (Byggeplass) — ingen firma-element |

**Tre filer endret (ingen schema, ingen RBAC, ingen auth):**
- `apps/web/src/kontekst/firma-kontekst.tsx`: utvidet med `erCompanyAdmin: boolean` (utledet fra eksisterende `minBruker.role`-data, ingen ny query). Brukes av Toppbar for å skille company_admin fra vanlig bruker.
- `apps/web/src/components/layout/FirmaVelger.tsx`: `router.push("/dashbord/firma")` lagt til etter `velgFirma()` slik at sitedoc_admin lander direkte i firma-admin-flyten ved firma-valg.
- `apps/web/src/components/layout/Toppbar.tsx`: JSX-omarrangering — firma-element flyttet FORAN ProsjektVelger for sitedoc_admin og company_admin. Vanlig bruker får ingen firma-link i toppbar lenger (tidligere fikk alle med `organizationId`-tilknytning fast firma-link via `organisasjon`-fallback). Duplisert `erSiteDocAdmin`-sjekk fra `trpc.admin.erAdmin` fjernet — `erSitedocAdmin` fra `useFirma()` er eneste kilde. `organisasjon.hentMin` enables nå kun for `erCompanyAdmin`.

**Test-deploy:** Manuell deploy nødvendig (auto-deploy-hooken trigget ikke — tredje gang i denne sesjonen, bør undersøkes separat).

**Hva header-fix IKKE løser (fortsatt åpne planlagte oppgaver):**
- Filtrering av prosjektliste på `primaryOrganizationId = valgtFirma.id` (P1 Fase 1, ~3-4t)
- Auto-reset av aktivt prosjekt ved firma-bytte (P1 Fase 2, ~2-3t)
- Bakfyll test-DB `primary_organization_id` (5 min, blokkerende for P1)
- admin/firmaer: `erKunde`-filter + Timer-kolonne (P2, ~2t)
- Admin-navigasjon redesign + abonnement-modell (P4+P5, ~1-2 dager)

Header-fix dekker rekkefølge-signalet og redirect-friksjonen, men det reelle hierarki-håndhevet (firma → prosjekter under firma) krever P1-arbeidet som står på vent.

**Cache-invalidering verifisert 2026-05-04:** `apps/web/src/app/dashbord/firma/innstillinger/page.tsx:38-44` invaliderer allerede `hentMedId` + `hentMin` + `hentTilgjengelige` ved oppdater-mutation. Ingen kode-endring nødvendig — sidebar-tittel og FirmaVelger oppdateres korrekt etter firma-info-endring.

**Steg 4a (ECO-flytt på attestering) DEPLOYET TIL PROD 2026-05-03** (`da6b34a5` merge, `f98fa7a5` impl). HTTP/2 200 verifisert mot sitedoc.no. Test-deploy krevde manuell trigger (auto-deploy-hooken trigget ikke — andre gang etter Steg 1a, bør undersøkes separat). Test-verifisert på test.sitedoc.no som Per Prosjektadmin: leder-detaljsiden åpner sedlen, ECO-velger inline på timer-rader, action-bar med Returner/Attester fungerer. Beslutning fra Kenneth/Claude før koding: scope er kun ECO-flytt (samme prosjekt), ikke cross-prosjekt. 4b (Vareforbruk) utsettes til etter Steg 1e (OrganizationModule). 4c (Godkjenning UI) starter nå.

**Endringer:**
- **Server (`apps/api/src/routes/timer/dagsseddel.ts`):**
  - Ny `flyttTimerRadEco({ timerRadId, externalCostObjectId: string | null })`-mutation. Gates med `krevProsjektLeder(ctxUserId, sheet.projectId)`. Status-vakt: kun `sent` tillates (returned er hos ansatten, accepted er låst av snapshot, draft har aldri vært innom leder). ECO-validering hvis ikke null: `slettetVed=null`, `organizationId === sheet.organizationId`, `projectId === sheet.projectId`, `status="aktiv"`, `timerregistreringApen=true`. Activity-log (best-effort try/catch) skriver `target_type=sheet_timer`, `action=timer.eco-flyttet`, payload `{sheetId, fraEcoId, tilEcoId}` — ikke-blokkerende ved feil siden selve flyttingen allerede er committed.
  - Ny `hentForAttestering({id})`-query. Autoriserer på `krevProsjektLeder` i stedet for `hentEgenDagsseddel` (som krever eierskap eller sitedoc_admin/company_admin med matchende org). Beriker med ansatt-info fra kjernen-DB. Løser eksisterende svakhet der Per Prosjektadmin ikke kunne åpne ansattens detaljside fra attestering-tabellen.
- **Klient (`apps/web/src/app/dashbord/[prosjektId]/timer/attestering/[id]/page.tsx`):** Ny dedikert leder-detaljside. Header med dato, prosjektnavn, ansatt-info og StatusBadge. 4 seksjoner: Detaljer (read-only), Timer-rader (ECO-felt redigerbart inline via `<select>` + fjern-X-knapp, øvrige felter read-only), Tillegg (read-only, vises kun hvis rader finnes), Maskin (read-only, vises kun hvis rader finnes). Action-bar nederst med Returner-knapp (åpner kommentar-modal) + Attester-knapp. ReturnerDialog gjenbruker eksisterende returner-mutation fra Runde 1C. Ikke-sent-sedler viser fallback-melding «Sedlen kan ikke endres ({{status}})».
- **Klient (`apps/web/src/app/dashbord/[prosjektId]/timer/attestering/page.tsx`):** Chevron-lenken i tabellraden navigerer nå til `/timer/attestering/${rad.id}` (ny leder-rute) i stedet for `/timer/${rad.id}` (ansattens detaljside). Tidligere lenke ga FORBIDDEN for Per Prosjektadmin (User.role="user" + ProjectMember.role="admin") siden ansattens `hentMedId` kun aksepterer eierskap eller sitedoc_admin/company_admin.
- **i18n:** 5 nye nøkler under `timer.attestering.flyttEco.{etikett,ingenEco,fjernEco}` + `timer.attestering.tilbake` + `timer.attestering.detalj.ikkeRedigerbar` i nb+en.

**Hva 4a IKKE dekker:**
- Cross-prosjekt-flytt (avklart utenfor scope — krever DailySheet-rekonstruksjon pga `(userId, projectId, dato)` UNIQUE).
- Endring av lønnsart/timer/aktivitet/beskrivelse/klokkeslett — er ansattens domene, returneres ved behov.
- Bulk-flytt (én rad om gangen — ingen multi-select).
- Mobil leder-attestering (kun web — Runde 2-godkjent scope).
- Auto-revert ved attestering — snapshot-pattern (A.7) låser uansett.

**Verifisering:** `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (34.5s) — ny rute `/dashbord/[prosjektId]/timer/attestering/[id]` (4.71 kB) kompilert. Ingen DB-migrasjon.

**Klar for test-deploy.** Stopper og rapporterer per Kenneths instruks. Etter test-deploy skal Claude verifisere som innlogget Per Prosjektadmin (ke.myrhau@gmail.com): (1) åpne sedel fra Ola Tømrer i `/dashbord/[prosjektId]/timer/attestering/[id]`, (2) bytt ECO på en rad og fjern ECO fra annen, (3) attester sedlen og verifiser via psql at `attestertSnapshot` reflekterer nye ECO-verdiene, (4) som Ola Tømrer (vanlig bruker): bekreft at `/attestering/[id]`-ruten returnerer FORBIDDEN.

**Steg 3 (maskin-import med firma-kontekst) DEPLOYET TIL PROD 2026-05-03** (`33a2b9b4` merge, `e7ddc397` impl). HTTP/2 200 verifisert mot `/dashbord/maskin/import` på sitedoc.no.

**A.Markussen-maskinimport gjennomført på prod 2026-05-03.** Kenneth utførte importen via UI som sitedoc_admin med A.Markussen (`4488fe17-7490-409f-9c1c-2827f257c54d`) valgt i FirmaVelger. Verifisert via psql:
- **Equipment-tellinger:** 124 totalt — 36 kjøretøy + 50 anleggsmaskin + 38 småutstyr (matcher SmartDok-undersøkelsens forventning fra 126-rad Excel: 125 importerbare minus 1 testrad → 124)
- **Registreringsnumre:** 36 (alle kjøretøy har gyldig regnr — matcher prosjektert 36)
- **Eierskap leid:** 11 (9XXX-internnumre per A.Markussen-konvensjon)
- **Vegvesen-kø:** 36 rader prioritet=200 opprettet ved import. Ved verifisering: 2 fullført + 34 ventende. Worker plukker én av gangen via 60s-polling — naturlig spredning over ~34 min for resten.

Steg 1+2+3 fra prioritert byggerekkefølge er nå komplett. Gjenstår: Steg 4 (Dagsseddel-utvidelser) som omfatter 4a Timer-admin (flytt prosjekt↔ECO), 4b Vareforbruk (SheetMaterial-tabell), 4c Godkjenning UI (byggherre-flyt). Steg 3 fra prioritert byggerekkefølge — to deler.

**3a — Koble import til FirmaVelger + erKunde-filter:**
- Server: ny `krevErKundeFirma(organizationId)`-helper i `apps/api/src/trpc/tilgangskontroll.ts` som validerer `Organization.erKunde === true` (NOT_FOUND hvis firma ikke finnes; FORBIDDEN hvis erKunde=false). Brukt i lokal `verifiserFirmaAdmin`-helper i `apps/api/src/routes/maskin/import.ts` slik at både `importerForhandsvisning` og `importerBekreft` blokkerer skall-firma-import. Skall-firmaer (byggherre, UE uten SiteDoc-konto) skal ikke kunne være mål for SmartDok-import siden de ikke bruker maskinregisteret.
- Klient: `useFirma()` brukes allerede (fra Steg 1b Fase B-migrering) — ingen endring i denne delen. La til tom-state hvis sitedoc_admin ikke har valgt firma: `{steg === "opplastning" && !orgId && <div>{t("firma.maskin.import.velgFirma")}</div>}` viser «Velg et kunde-firma fra toppmenyen før du kan importere».

**3b — Fil-upload UI klikkbar drag-and-drop:**
- Konvertert fra ren label til label med drag-and-drop-handlere: `onDragOver` (preventDefault + setDrarOver(true)), `onDragLeave` (setDrarOver(false)), `onDrop` (preventDefault + setDrarOver(false) + handleFilValg(e.dataTransfer.files[0])). Ny `drarOver`-state styrer visuell feedback: ved drag-over endres border til `border-sitedoc-primary` og bakgrunn til `bg-blue-50` (sterkere enn hover-statet). UploadCloud-ikonet farges også blått ved drag.
- Klikk-funksjonalitet beholdt via eksisterende label/input-mønster — klikk hvor som helst i sonen åpner filvelger.
- Validering uendret: `accept=".xlsx"` på input + sjekk på filnavn-extension i `handleFilValg`.

**Hva 3 IKKE dekker:**
- Multi-fil-support (én fil av gangen) — ikke etterspurt.
- Andre import-formater (CSV, andre Excel-strukturer) — kun SmartDok-format støttes per nå.
- Validering at filen faktisk er en SmartDok-eksport — fanges i `parseSmartDokXlsx`-parseren downstream.

**Verifisering:** `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (34.0s).

**Klar for test-deploy.** Stopper og rapporterer per Kenneths instruks. Claude verifiserer (1) at sitedoc_admin uten valgt firma ser tom-state, (2) at drag-and-drop med .xlsx fungerer (visuell feedback + opplasting), (3) at FORBIDDEN returneres hvis sitedoc_admin via DevTools sender et skall-firma-orgId (valgfri).

**Steg 2 (firma-admin-sider) DEPLOYET TIL PROD 2026-05-03** (`a1463561` merge — samlet 2b+2c+2d, 2a var allerede komplett). HTTP/2 200 verifisert mot `/dashbord/firma/moduler`, `/dashbord/firma/innstillinger`, `/dashbord/nytt-prosjekt`. Ingen DB-migrasjoner i Steg 2. Funksjonell verifisering på test før prod-deploy: sitedoc_admin (Tore) opprettet prosjekt for Byggeleder via firma-kontekst → primary_organization_id satt korrekt + 2 ProjectModule-rader (timer + maskin, status=aktiv) auto-opprettet.

**Steg 2d (prosjekt fra firma-kontekst) IMPLEMENTERT på develop 2026-05-03.** Tredje og siste del av Steg 2. Server tar nå valgfri `organizationId` i prosjekt-opprettelsen, klient sender valgtFirma.id, og duplikat-fil slettet.

**Endringer:**
- **Server (`apps/api/src/routes/prosjekt.ts`):** `createProjectSchema` utvidet med `organizationId: z.string().uuid().optional()` i `packages/shared/src/validation/index.ts`. `prosjekt.opprett` autoriserer mot bruker-rolle: sitedoc_admin → tilgang til enhver org; ellers krever input.organizationId === bruker.organizationId, eller FORBIDDEN. Falleback: hvis input.organizationId ikke gitt, bruk bruker.organizationId. Den valgte orgId-en brukes for: (1) `Project.primaryOrganizationId` (manglet før Steg 2d — eksisterende prosjekter hadde ProjectOrganization-rad men ikke primaryOrganizationId), (2) ProjectOrganization-rad, (3) ProjectModule-rader for aktive firmamoduler. `opprettTestprosjekt` setter også `primaryOrganizationId` (samme manglende fix). Stripper `organizationId` fra spread-input til Project-data (det er ikke en kolonne på Project-modellen).
- **Klient (`apps/web/src/app/dashbord/nytt-prosjekt/page.tsx`):** importer `useFirma`, sender `valgtFirma?.id` som `organizationId` i mutation. Info-banner (Building2-ikon + blå bakgrunn) vises kun for sitedoc_admin med valgt kunde-firma («Prosjektet opprettes for [firma-navn]. Bytt firma i toppmenyen for å opprette på vegne av et annet firma.»). For vanlige brukere er banneret skjult — de oppretter alltid for sitt eget firma uten valg.
- **Duplikat-rensing:** `apps/web/src/app/dashbord/prosjekter/nytt/page.tsx` slettet. Var orphan-fil — alle 4 lenker i kodebasen pekte til `/dashbord/nytt-prosjekt`. Forskjellen var redirect (`/dashbord/${id}` vs `/dashbord/prosjekter/${id}`); den slettete pekte til legacy-rute som ikke har full subnavigasjon.
- 1 ny i18n-nøkkel `nyttProsjekt.opprettesFor` (nb+en).

**Hva 2d IKKE dekker:**
- Per-bruker-default-firma (hvilket firma settes som valgt i FirmaVelger ved første pålogging) — ikke scope.
- Validering på server-side at det valgte firmaet faktisk er `erKunde:true` — ikke nødvendig nå siden FirmaVelger allerede filtrerer på `erKunde:true`. Men kan legges til senere som ekstra forsvar.
- Legacy-rute `/dashbord/prosjekter/[id]/*` (som har færre undersider enn `/dashbord/[prosjektId]/*`) er ikke ryddet i scope for 2d — separat opprydningsoppgave.

**Verifisering:** `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (35.0s).

**Klar for test-deploy.** Stopper og rapporterer per Kenneths instruks. Claude verifiserer (1) at sitedoc_admin (Tore) kan velge Byggeleder i FirmaVelger og opprette prosjekt med korrekt primaryOrganizationId, (2) at info-banneret vises, (3) at vanlig bruker (Kari Firmaadmin) opprettelse av prosjekt fungerer som før, (4) at ProjectModule-rader auto-opprettes (Steg 1c-flow gjenbrukes). **Steg 2 komplett etter dette — alle 4 sub-oppgaver dekket** (2a allerede komplett før, 2b+2c+2d nå deployet).

**Steg 2c (OrganizationSetting-UI) IMPLEMENTERT på develop 2026-05-03.** Andre del av Steg 2 fra prioritert byggerekkefølge. Utvider `/dashbord/firma/innstillinger`-siden med 4 nye seksjoner som dekker alle gjenværende OrganizationSetting-felter (kompetanse-policy var allerede dekket fra Fase 0.5).

**Endringer:**
- `apps/web/src/app/dashbord/firma/innstillinger/page.tsx`:
  - Ny `TidssoneSeksjon`-komponent: dropdown med 7 tidssoner (Europe/Oslo default + Stockholm/København/Helsinki/Berlin/London/UTC). Bruker `organisasjon.oppdaterSetting`-mutation. Endring lagres umiddelbart ved valg (ingen separat lagre-knapp).
  - Ny generisk `TilgangPolicySeksjon`-komponent: tar `felt`-prop (timerTilgangDefault | vareforbrukTilgangDefault | maskinbrukTilgangDefault) + tittel/beskrivelse-i18n-nøkler. Renderer 3 radio-knapper med samme verdi-sett: `alle-ansatte` / `kun-prosjektmedlemmer` / `sertifiserte` (matcher Zod-enum i `oppdaterSetting`-mutation). Eliminerer dobling av kode for de tre tilgang-feltene som har identisk UI-mønster.
  - Tre `<TilgangPolicySeksjon>`-instanser instansiert med ulike felt: Timer, Vareforbruk, Maskinbruk. Plassering: under firma-info-skjemaet, mellom Tidssone og Kompetanse-policy.
  - `KompetansePolicySeksjon` (eksisterende fra Fase 0.5) beholdt som siste seksjon — har annen verdi-mengde (`firma_admin`/`bruker_egen`/`alle`) så ikke gjenbrukes via `TilgangPolicySeksjon`.
- 14 nye i18n-nøkler under `firma.innstillinger.tidssone.*` + `firma.innstillinger.tilgang{Timer,Vareforbruk,Maskinbruk}.*` + `firma.innstillinger.tilgangVerdi.{alle-ansatte,kun-prosjektmedlemmer,sertifiserte}.*` i nb+en.

**Hva 2c IKKE dekker:**
- Eksisterende `KompetansePolicySeksjon` har hardkodede norske strenger (etablert i Fase 0.5 § 2). Konvertering til i18n er separat opprydningsoppgave — ikke scope for 2c.
- Per-prosjekt-overstyring av disse defaultene er ikke bygget — de er kun «default ved opprettelse av nytt prosjekt» foreløpig. Faktisk respekt-i-runtime av `timerTilgangDefault`/`vareforbrukTilgangDefault`/`maskinbrukTilgangDefault` på prosjekt-nivå er ikke bygget — det blir senere når Vareforbruk-modul + Maskinbruk-flow kommer.

**Verifisering:** `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (33.7s).

**Klar for test-deploy.** Stopper og rapporterer per Kenneths instruks. Claude verifiserer at alle 5 seksjoner (firma-info + tidssone + 3 tilgang + kompetanse-policy) lastes og at endringer persisteres i OrganizationSetting-tabellen.

**Steg 2b (firmamodul-styring UI) DEPLOYET TIL TEST 2026-05-03** (`25cd7675`). Verifisert som innlogget Kari Firmaadmin: aktivere/deaktivere Timer/Maskin fungerer end-to-end, ProjectModule-rader synkroniserer korrekt, sidebar oppdateres. Klar for prod (avventer 2c+2d før samlet prod-deploy). Første del av Steg 2 fra prioritert byggerekkefølge. Ny dedikert side `/dashbord/firma/moduler` for å aktivere/deaktivere firmamoduler — erstatter den manuelle `UPDATE organizations SET har_*_modul = true`-prosedyren som tidligere var dokumentert i `admin/firmaer/page.tsx`-modal.

**Endringer:**
- Ny fil `apps/web/src/app/dashbord/firma/moduler/page.tsx` — skalerbar konfig-tabell (`MODULER`-array) med 5 moduler: timer + maskin (status: `tilgjengelig`), kompetanse + fremdrift + varelager (status: `kommer-snart`). Bare `tilgjengelig`-moduler har funksjonelle toggles.
- Hver kort: ikon (Lucide), navn, beskrivelse, status-badge («Aktivert» grønn / «Kommer snart» grå), Aktiver/Deaktiver-knapp. Aktivering = direkte mutation (idempotent — `settFirmamodul` håndterer både ny aktivering og reaktivering). Deaktivering = `Modal`-bekreftelse fra `@sitedoc/ui` med advarsel («Modulen settes som arkivert på alle prosjekter firmaet er knyttet til. Data slettes ikke — du kan reaktivere senere.»).
- Bruker `useFirma().valgtFirma.harTimerModul`/`harMaskinModul` for status-visning og `organisasjon.settFirmamodul`-mutation fra Steg 1c. Cache-invalidering på `hentTilgjengelige`/`hentMin`/`hentMedId`.
- `apps/web/src/app/dashbord/firma/layout.tsx` — nytt menyelement «Moduler» (Boxes-ikon) plassert mellom Kompetanse og Timer. Synlig for alle firma-admin-brukere uavhengig av modul-status.
- `apps/web/src/app/dashbord/admin/firmaer/page.tsx` — SQL-instruks i firma-detaljmodal erstattet med peker til ny side («Velg firmaet i FirmaVelger og gå til /dashbord/firma/moduler»). Tabellradens harMaskinModul-visning beholdt uendret (oversikts-info, ikke handling).
- ~22 nye i18n-nøkler under `firma.moduler.*` i nb.json + en.json: tittel/beskrivelse/aktiver/deaktiver/aktivert/kommer-snart/dialog-tekster + per-modul navn/beskrivelse for alle 5 moduler.

**Verifisering:** `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (34.7s).

**Klar for test-deploy.** Stopper og rapporterer per Kenneths instruks. Claude verifiserer (1) at sitedoc_admin (Tore) ser den nye «Moduler»-menyelement etter å ha valgt et kunde-firma, (2) at toggle Timer/Maskin off+on virker end-to-end, (3) at deaktivering syncer ProjectModule-rader til `status="arkivert"`, (4) at sidebaren oppdateres når Timer aktiveres/deaktiveres for valgt firma. 2c (OrganizationSetting-UI med tidssone + 3 tilgang-toggles) + 2d (prosjekt fra firma-kontekst, server+klient) avventer grønt lys.

**Steg 1d (ProjectModule final cleanup, forkortet) DEPLOYET TIL PROD 2026-05-03** (`73dcbd1a` merge, `ec0ce969` impl). Migrasjon `20260503020000_drop_project_module_active` applied på sitedoc + sitedoc_test. DB-schema verifisert begge miljøer: `active`-kolonnen borte fra `project_modules`. HTTP/2 200 web, HTTP/2 204 API. Migrasjon `20260503020000_drop_project_module_active` — `ALTER TABLE project_modules DROP COLUMN IF EXISTS active`. Verifisering før drop: grep `\.active` mot apps/api/apps/web/apps/mobile returnerte 0 ProjectModule-relaterte treff (eneste treff er `Project.status`-enum i prosjekt.ts, ulik modell). Schema-rens: `active Boolean`-feltet fjernet fra `ProjectModule`-modellen, kommentar oppdatert til endelig modell. Unique `(project_id, module_slug)` beholdes — cross-org-unique `(projectId, organizationId, moduleSlug)` flyttet til Steg 1e fordi den kun er meningsfull for firmamoduler (timer/maskin), ikke for prosjektmoduler (oversettelse/PSI/kontrollplan/etc. har 14 av 16 callsites og bør forbli én rad per prosjekt). To-stegs migration-policy A.18 oppfylt: `status`-feltet ble lagt til i `20260501000005` (deployet til prod 2026-05-01); denne migrasjonen er steg 2. `pnpm typecheck` + `pnpm build --filter @sitedoc/web` grønt. Klar for test-deploy.

**Steg 1c (OrganizationModule-overgang) DEPLOYET TIL PROD 2026-05-03** (`87fb7292` merge, `d581e399` Fase A+B + `6921ffea` mini-Fase C). Migrasjon `20260503010000_steg_1c_module_backfill` applied på sitedoc + sitedoc_test. Bakfyll-tellinger: 0 rader på begge DB-er (kunde-firma har 0 prosjekter med primary-rolle ennå — auto-sync hooket aktiveres ved første prosjekt-opprettelse). HTTP/2 200 web, HTTP/2 204 API. Test-verifisert som innlogget Kari Firmaadmin før prod-deploy: nytt prosjekt → 2 ProjectModule-rader auto-opprettet (timer+maskin, status=aktiv, organization_id=Byggeleder). Tredje steg i prioritert byggerekkefølge ferdig.

**Mini-Fase C lukker Steg 1c (kommentar-rens, ikke drop):** Drop av `har_*_modul`-kolonner krever en `OrganizationModule`-tabell — firma uten prosjekter trenger flagget for å onboarde lønnsarter (A.Markussen-flow). Den jobben er utsatt til **Steg 1e** (fremtidig). Kommentarer i `schema.prisma` + `moduleGate.ts` oppdatert til endelig to-nivås-modell. Steg 1d (drop `active Boolean` + ny unique på ProjectModule) er uavhengig og påvirkes ikke.

**Fase A — datamodell + bakfyll (server-side, bakoverkompatibel):**
- Migrasjon `20260503010000_steg_1c_module_backfill` — INSERT ProjectModule(slug=timer/maskin, organizationId, status="aktiv") for alle prosjekter der primary_organization har flagget aktivert. Idempotent via `ON CONFLICT (project_id, module_slug) DO NOTHING`. Forhåndsverifisert mot test-DB (Byggeleder: 0 prosjekter med primary-rolle) og prod-DB (A.Markussen: 0 prosjekter) — migrasjonen er ren no-op safety-net nå, og blir aktiv først når kunde-firma kobles til sitt første prosjekt (via Fase B-hooks).
- Service-utvidelse: `erTimerAktivert/krevTimerAktivert` + `erMaskinAktivert/krevMaskinAktivert` tar valgfri `projectId`-param. Uten projectId: kun firma-bredt flagg (bakoverkompatibel — alle eksisterende callsites uendret). Med projectId: krever både firma-flagg OG `ProjectModule.status="aktiv"` for `(projectId, slug, organizationId)`. Error-meldinger differensierer mellom firma-scope og prosjekt-scope.

**Fase B — auto-sync-hooks + klient-migrering:**
- **`prosjekt.opprett`** (`apps/api/src/routes/prosjekt.ts`): refaktorert fra direkte create til `$transaction`. Henter brukerens `organizationId` og firma-flagg (har_timer_modul, har_maskin_modul) før transaction. I transaction: oppretter Project + ProjectOrganization + ProjectModule-rader (createMany med skipDuplicates) for hver aktive firmamodul.
- **`prosjekt.opprettTestprosjekt`**: tilsvarende — etter ProjectOrganization.create i eksisterende transaction, opprettes ProjectModule-rader for aktive firmamoduler.
- **Ny service-helper `apps/api/src/services/firmamodul.ts`** med `syncProjektModulerPaaAktiver(tx, organizationId, slug)` + `syncProjektModulerPaaDeaktiver(tx, organizationId, slug)`. Aktiver-versjonen henter alle prosjekter firmaet er knyttet til (primary OR ProjectOrganization-partner), reaktiverer eksisterende ikke-aktive rader via updateMany, og oppretter nye via createMany med skipDuplicates. Deaktiver-versjonen setter alle aktive rader til status="arkivert" (rader beholdes — historikk bevares).
- **Ny mutation `organisasjon.settFirmamodul({ organizationId, slug: "timer"|"maskin", aktiver: boolean })`**. Polymorf — dekker timer/maskin × aktiver/deaktiver. Setter har_*_modul-flagg + syncer ProjectModule i samme `$transaction`. Gates med `verifiserFirmaAdmin` (sitedoc_admin + firmaets company_admin). UI-knapp ikke bygget ennå — Kenneth/sitedoc_admin kan kalle direkte fra tRPC eller via UI som bygges i Steg 2b (firmamodul-styring under firma-admin).
- **`timer/onboarding.aktiverNivaa1`**: refaktorert til `$transaction` som setter harTimerModul + kaller syncProjektModulerPaaAktiver. Sikrer at ProjectModule-rader genereres når Timer-modul aktiveres for første gang via onboarding-flow (selv uten å bruke settFirmamodul).
- **`timer/onboarding.aktiverTomKatalog`**: tilsvarende refaktor.
- **`HovedSidebar.tsx` migrering**: Timer-elementer (`timer` + `timer-attestering`) i prosjekt-sidebar gates nå på `aktiveModuler.some(m => m.moduleSlug === "timer" && m.status === "aktiv")` (allerede hentet via `trpc.modul.hentForProsjekt`) i stedet for firma-flagg `harTimerModul`. Variabel `harTimerModul` erstattet med `harTimerModulPaaProsjekt`. Maskin-bunnelement (global lenke til `/dashbord/maskin`) beholder `harMaskinModul`-flagget siden bunn-elementet ikke er prosjekt-spesifikk.

**Hva Steg 1c IKKE gjør:**
- Fortsatt cross-org-aktivering på samme prosjekt (UE-firma med Timer-modul på A.Markussens prosjekt) er blokkert av dagens unique `(project_id, module_slug)`. Det åpnes opp i Steg 1d.
- Drop `active Boolean`-kolonne på ProjectModule + endre unique-indeks → Steg 1d (krever CI-grep for `projectId_moduleSlug`).
- Drop `har_timer_modul`/`har_maskin_modul`-kolonner på Organization → Steg 1c Fase C (avventer test-verifisering av Fase B).
- Klient-UI for firmamodul-toggle på `/dashbord/firma/innstillinger` eller egen side → Steg 2b. Mutationen `settFirmamodul` er klar å brukes så snart UI bygges.

**Verifisering:**
- `pnpm --filter @sitedoc/api typecheck` grønt
- `pnpm build --filter @sitedoc/web` grønt (37.2s)

**Klar for test-deploy.** Stopper og rapporterer per Kenneths instruks. Claude verifiserer (1) at sitedoc_admin (Tore) kan opprette prosjekt for A.Markussen-kontekst og at ProjectModule-rader for timer+maskin opprettes automatisk, (2) at Timer-elementene vises i prosjekt-sidebar når modul er aktiv, og (3) at `settFirmamodul`-mutationen fungerer end-to-end (kall via DevTools eller test-script). Etter verifisering: grønt lys for Fase C (drop midlertidige flagg).

**Steg 1b Fase A+B+C DEPLOYET TIL PROD 2026-05-03** (`045a49b7` merge). Hele Steg 1b komplett. Sitedoc_admin kan nå velge et hvilket som helst kunde-firma i FirmaVelger og se/redigere det firmaets data på alle firma-admin-undersider. Eier-firma-rename live i prod. HTTP 200 verifisert. Innlogget verifisering anbefales for å bekrefte A.Markussen-kunde fortsatt fungerer.

**Steg 1b Fase C (firma-kontekst — innstramning + Eier-firma-rename) IMPLEMENTERT på develop 2026-05-03** — tredje og siste del av tre-fasers strategi. Etter denne fasen er fundamentet for global firma-kontekst komplett.

**Endringer:**
- **Server (9 router-filer):** `verifiserFirmaAdmin`-helper forenklet til thin wrapper rundt `autoriserAdminForFirma`. Fallback-grenen til `bruker.organizationId` droppet — orgId er nå PÅKREVD for alle write-mutationer. Filer: organisasjon, avdeling, kompetanse, kompetansetype (kun write-mutations), timer/{onboarding (kun aktiver*), lonnsart/aktivitet/tillegg (kun opprett/oppdater/deaktiver)}, maskin/import.
- **Read-only ruter beholder fallback:** `timer.{lonnsart,aktivitet,tillegg}.list`, `timer.onboarding.status`, `kompetansetype.hentAlle` har fortsatt `hentBrukerOrgId(userId, inputOrgId?)` — disse brukes fra prosjekt-baserte dagsseddel-sider hvor ansatte skal se sitt eget firmas katalog uten å eksplisitt bytte. Beslutningen er bevisst: ansatte (ikke firma-admin) trenger ikke firma-velger.
- **Klient (~30 callsites):** alle `organizationId: orgId` byttet til `organizationId: orgId!` — non-null assertion. Etablert mønster siden `firma/layout.tsx` gates på `valgtFirma` (ingen children rendres uten valgt firma).
- **Lag 3 — rename:** `oppsett.firmainnstillinger` i14n-nøkkel: nb «Firmainnstillinger» → «Eier-firma», en «Company settings» → «Owner company». H1-overskrift på `/dashbord/oppsett/firma` hardkodet rename til «Eier-firma». Foreldrekategorien «Prosjekteier» (linje 75-78 i `oppsett/layout.tsx`) eksisterte allerede — kun subelementets navn endret for å unngå navnkollisjon. Andre 12 språkfiler beholder eksisterende oversettelse (samme mønster som tidligere terminologi-renames per timer-attestering 2026-05-02).
- **Fix:** `oppsett/firma/page.tsx` `lagre()` får early-return ved `!organisasjon` (orgId må være string, ikke `string | undefined`). Fanget av tsc da fallback ble fjernet.

**Verifisering:**
- `pnpm --filter @sitedoc/api typecheck` grønt
- `pnpm build --filter @sitedoc/web` grønt (27.3s)

**Hva Fase C skiller seg fra Fase A/B:**
- Fase A: bakoverkompatibilitet — orgId valgfri, fallback til bruker
- Fase B: klient sender orgId aktivt
- **Fase C: orgId tvinges — sitedoc_admin må bytte firma eksplisitt for å jobbe i kundens kontekst**

**Klar for test-deploy.** Etter verifisering: prod-deploy lukker Steg 1b helt.

**Beslutning under arbeid:** Sub-elementet «Firmainnstillinger» renames til «Eier-firma» i stedet for «Prosjekteier» (Kenneths foreslag) for å unngå kollisjon med eksisterende parent-kategori «Prosjekteier». Klarere navn — beskriver firma-info knyttet til prosjektets eier.

**Steg 1b Fase B (firma-kontekst — klient-migrering) IMPLEMENTERT på develop 2026-05-03** — andre del av tre-fasers strategi. Bygger på Fase A-server-side-helper. Etter denne fasen kan sitedoc_admin velge et hvilket som helst firma i FirmaVelger og faktisk se det firmaets data på alle firma-admin-undersider.

**Endringer (~10 sider migrert):**
- `firma/page.tsx` (oversikt) — byttet fra `organisasjon.hentMin` til `organisasjon.hentMedId({ id: orgId })`. Tre andre queries (`hentProsjekter`, `hentBrukere`, `hentIntegrasjonerStatus`) sender `{ organizationId: orgId }`.
- `firma/avdelinger/page.tsx` — alle queries/mutations i hovedkomponent + `OpprettAvdelingDialog` + `RedigerAvdelingDialog` har `useFirma()` og sender orgId.
- `firma/brukere/page.tsx` — `hentBrukere` + 2 `endreRolle.mutate`-kall sender orgId.
- `firma/innstillinger/page.tsx` — byttet fra `hentMin` til `hentMedId`. `oppdater` invaliderer både `hentMedId`/`hentMin`/`hentTilgjengelige`. `KompetansePolicySeksjon`-underkomponent har egen `useFirma()`.
- `firma/kompetanse/page.tsx` — `MatriseFane` (hentMatrise + hentSetting), `KompetansetyperFane` (hentAlle + oppdater), `OpprettTypeDialog`, `RedigerTypeDialog`, `SlettTypeDialog`, `ImportFraFilDialog` (forhandsvisning + bekreft). AnsattKompetanse-CRUD (opprett/oppdater/slett) UENDRET — bruker `verifiserKompetanseSkriveTilgang` server-side som utleder orgId fra målbruker.
- `firma/prosjekter/page.tsx` — `hentProsjekter` sender orgId.
- `firma/timer/layout.tsx` — `onboarding.status` sender orgId.
- `firma/timer/onboarding/page.tsx` — `status`-query + 3 mutations (aktiverNivaa1/aktiverNivaa2/aktiverTomKatalog) sender orgId.
- `firma/timer/lonnsarter/page.tsx` — list-query + deaktiver/oppdater + Dialog (opprett/oppdater) sender orgId.
- `firma/timer/aktiviteter/page.tsx` — analog.
- `firma/timer/tillegg/page.tsx` — analog.
- `maskin/import/page.tsx` — `importerForhandsvisning` + `importerBekreft` sender orgId.

**Mønster:** `const { valgtFirma } = useFirma(); const orgId = valgtFirma?.id;` + `useQuery({ organizationId: orgId }, { enabled: !!orgId })` for queries og `mutate({ ...args, organizationId: orgId })` for mutations.

**Beskyttelse:** `firma/layout.tsx` returnerer allerede tom-state hvis `!valgtFirma` (etablert i tidligere commit). Undersider rendres derfor aldri uten valgt firma — `enabled: !!orgId` er en ekstra trygging.

**Verifisering:** `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (28.9s, 1 cached).

**Klar for test-deploy.** Stopper og rapporterer før Fase C per Kenneths instruks. Claude verifiserer at sitedoc_admin faktisk kan bytte firma og se annet firmas data.

**Steg 1b Fase A (firma-kontekst — server-helper + valgfri input) IMPLEMENTERT på develop 2026-05-03** — andre steg i prioritert byggerekkefølge fra [domene-arbeidsflyt.md](domene-arbeidsflyt.md). Tre-fasers strategi godkjent av Kenneth: A → B → C med stopp+verifisering mellom hver. Fase A er bakoverkompatibel — alle eksisterende klient-kall fungerer uendret.

**Endringer:**
- Ny `autoriserAdminForFirma(userId, organizationId)`-helper i `apps/api/src/trpc/tilgangskontroll.ts`. Logikk: sitedoc_admin → tilgang til alle firmaer (uavhengig av bruker.organizationId); company_admin med matchende organizationId → tilgang; ellers FORBIDDEN. Skiller seg fra eksisterende `verifiserOrganisasjonTilgang` ved å tillate sitedoc_admin uten matchende org og kreve admin-rolle (ikke bare medlemskap).
- Lokale `verifiserFirmaAdmin`-helpers i 9 router-filer refaktorert til å ta valgfri `inputOrgId`-param. Når gitt: deleger til `autoriserAdminForFirma`. Når ikke gitt: fallback til gammel logikk (`bruker.organizationId`).
- Tilsvarende `hentBrukerOrgId`-helpers (read-only ruter) i kompetansetype, timer/{onboarding,lonnsart,aktivitet,tillegg} fikk samme behandling.
- ~46 endepunkter på tvers av 9 router-filer fikk `organizationId: z.string().uuid().optional()` som input-felt:
  - `organisasjon.ts` (~12): hentMedId/hentProsjekter/hentBrukere/oppdater/leggTilProsjekt/fjernProsjekt/hentIntegrasjonerStatus/endreRolle/tildelOrgRolle/fjernOrgRolle/hentSetting/oppdaterSetting. Lokal `erSiteDocAdmin`-helper fjernet (ubrukt etter konsolidering av oppdater).
  - `avdeling.ts` (4): hentAlle/opprett/oppdater/slett.
  - `kompetanse.ts` (~3 firma-admin-endepunkter): hentMatrise/hentForBruker/importerForhandsvisning/importerBekreft. AnsattKompetanse-CRUD bruker fortsatt `verifiserKompetanseSkriveTilgang` (bruker-mot-bruker-RBAC, ikke firma-admin) — uendret.
  - `kompetansetype.ts` (~5): hentAlle/opprett/oppdater/slett.
  - `timer/onboarding.ts` (4): status/aktiverNivaa1/aktiverNivaa2/aktiverTomKatalog.
  - `timer/lonnsart.ts` (4), `timer/aktivitet.ts` (4), `timer/tillegg.ts` (4): list/opprett/oppdater/deaktiver.
  - `maskin/import.ts` (2): importerForhandsvisning/importerBekreft (via felles `filInputSchema.extend({...})`).
- Verifisering: `pnpm --filter @sitedoc/api typecheck` grønt. `pnpm build --filter @sitedoc/web` grønt (34s).

**Hva Fase A IKKE gjør:**
- Ingen klient-endring — Fase A er rent server-side bakoverkompatibilitet.
- `organizationId` er valgfri overalt — fallback fungerer som før.
- Sitedoc_admin har fortsatt ikke tilgang til andre firmas data uten at klienten begynner å sende `valgtFirma.id`. Det skjer i Fase B.

**Klar for test-deploy.** Stopper og rapporterer før Fase B per Kenneths instruks.

**Steg 1a (Organization.erKunde) DEPLOYET TIL PROD 2026-05-03** (`c91d953c` merge, `b69830e7` impl) — første steg i prioritert byggerekkefølge fra [domene-arbeidsflyt.md](domene-arbeidsflyt.md). Lukker Strategi C i «Organization vs OrganizationPartner — fundamentalt skille mangler». Ny `Organization.erKunde Boolean default false` + migrasjon `20260503000001_add_organization_er_kunde` med backfill. Heuristikk: `er_kunde=true` hvis `har_maskin_modul` OR `har_timer_modul` OR finnes `Project.primary_organization_id` OR finnes `Avdeling`. `organization_settings` og `users` droppet som signaler (auto-upsert ved første hentSetting-kall + testdata-misbruk: rolle-test-brukere lagt på alle skall-firmaer på test). Backfill-resultat (verifisert via psql etter deploy): test-DB Byggeleder=true + 4 skall=false (Byggherre/Tømrer Hansen/Elektrikker Hansen/Hovedentreprenør); prod-DB A.Markussen/HRP AS/Kenneths testmiljø=true + 0 skall. Server: `organisasjon.hentTilgjengelige` filtrerer på `erKunde:true` for sitedoc_admin (company_admin-grenen uendret). `hentMin` returnerer hele Organization (inkl. `erKunde`). Klient: `Firma`-type i `firma-kontekst.tsx` utvidet med `erKunde:boolean`. Test-verifisert som innlogget Tore SiteDocAdmin via Claude (FirmaVelger viser kun Byggeleder). **Merknad:** Auto-deploy-hook etter push til develop triggert ikke — manuell deploy ble kjørt. Bør undersøkes separat.

**Global firma-kontekst (FirmaVelger i Toppbar) DEPLOYET TIL TEST 2026-05-03** (`a2d45c02` + `9175ab84`) — kun `firma/layout.tsx` følger velgeren, undersider krever Lag 1+2+3 (se planlagte oppgaver).

**Status 2026-05-02:** **Fase 0 § E KOMPLETT i prod**. **Fase 0.5 KOMPLETT i prod**. **Timer-modul Fase 3 — Runde 1A + 1B + 1C DEPLOYET TIL PROD**. **Runde 2 (mobil + offline-sync) C1–C8 KOMPLETT på develop** (merge `1cce62f3` 2026-05-02 sent kveld). C5 visuelt verifisert på iOS Simulator + fysisk mobil etter første test-deploy. **Runde 2 + 2.5 / C9 deployet til prod 2026-05-02** (`de33aefc`). **Maskin terminologi-rename «pensjonert» → «utgaatt» DEPLOYET TIL PROD 2026-05-02** (`03d8c63a` — migrasjon `20260502120000_rename_pensjonert_til_utgaatt` applied på sitedoc + sitedoc_test). **Runde 2.6 mobil maskin-cache DEPLOYET TIL PROD 2026-05-02** (`03d8c63a`). **Runde 2.7 «Mine timer» + DagstotalBanner + UkeTotalBanner + web ukesoppsummering DEPLOYET TIL PROD 2026-05-02** (`05b3bddb`) — ny `/dashbord/timer/mine` (web, 5-perioder + 4 oppsummerings-kort + per aktivitet/status), ny `/timer/mine` (mobil, 3-perioder + 2 pills + aktivitet-aggregering), DagstotalBanner i mobil ny+detalj, web uke-totalsum, sidebar/Mer-tab-link. Ingen DB-migrasjon, ingen server-endring (gjenbruker `timer.dagsseddel.list`). Mobil får funksjonalitet ved neste EAS Build. Se [dagsseddel-design.md](dagsseddel-design.md) + [fase-0-beslutninger.md C.18](fase-0-beslutninger.md).

**Rolle-arkitektur-avklaring DEPLOYET TIL PROD 2026-05-02** (`6f6d3d68`) — `ProjectMember.kanAttestere Boolean` lagt til som kapabilitets-felt. Erstatter mye-omtalt `project_manager`-rolle som kun var i bruk i `dagsseddel.ts` (2 referanser, ingen rader i DB). Backfill: alle `role="admin"` får `kanAttestere=true` ved migrering — verifisert på test-DB (Per Prosjektadmin har `kanAttestere=true`, Ola Tømrer har `false`). CLAUDE.md rolletabell renset for `worker`/`field_user`/`project_manager` (fantasi-verdier som aldri eksisterte i kode/DB). Migrasjon `20260502160000_add_kan_attestere` applied på sitedoc + sitedoc_test. UI: sub-pill «✓ Attestering» under rolle-cellen i prosjekt-medlem-admin (`/dashbord/oppsett/brukere`) + ny `medlem.settKanAttestere`-mutation. Esc-fiks for redigeringsmodus inkludert. Lærdom: `prisma generate` MÅ kjøres FØR `migrate deploy` på server — `pnpm install --frozen-lockfile` regenererer ikke klient-typene.

**Timer-attestering rename DEPLOYET TIL PROD 2026-05-02** (`8aa792b2`) — terminologi-rens for å gjennomføre CLAUDE.md regelen «Attestering ≠ Godkjenning» (vedtatt 2026-04-26). Full sweep:
- **URL:** `/dashbord/[prosjektId]/timer/godkjenning` → `/timer/attestering`. Redirect-stub i gammel rute peker til ny via `redirect()` fra `next/navigation`. Lenker fra utsiden fungerer.
- **tRPC:** `kanGodkjenne` → `kanAttestere`, `hentTilGodkjenning` → `hentTilAttestering`. Gamle prosedyrer beholdes som `@deprecated` alias i 1 uke (fjernes etter 2026-05-09) per CLAUDE.md API-bakoverkompatibilitet-regel.
- **Sidebar/hooks/navigasjon-kontekst:** `id: "timer-godkjenning"` → `"timer-attestering"`, `nav.timerGodkjenning` → `nav.timerAttestering`, useAktivSeksjon-spesialfall, navigasjon-kontekst-type.
- **Mobil:** `sendTilGodkjenning()` → `sendTilAttestering()` + i18n-nøkkel `timer.sendTilGodkjenning` → `timer.sendTilAttestering`.
- **i18n:** 16 nøkler renamet i nb.json + en.json (`timer.godkjenning.*` → `timer.attestering.*`). Norske VERDIER oppdatert: «Godkjenning» → «Attestering», «Godkjenn timer» → «Attester timer», «Send til godkjenning» → «Send til attestering» m.fl. Engelske verdier beholdt («Approval»/«Approve» dekker begge konsepter på engelsk). Ny `status.tilAttestering` lagt til i alle 14 språk (samme verdi som `status.tilGodkjenning` for ikke-nb språk siden distinksjonen er norsk-spesifikk).
- **Verifisert:** `pnpm build --filter @sitedoc/web` grønt; `tsc --noEmit` grønt for api+web (kun pre-eksisterende vitest-typing). Mobile-tsc har bare pre-eksisterende feil ikke relatert til rename.

Status `status.tilGodkjenning` er bevisst beholdt — brukes for sjekkliste/oppgave-flyt og kontrollplan-status (intern aksept ≠ Godkjenning-dokumenttype). **Innlogget bruker-verifisering på test gjenstår** per CLAUDE.md regelen — curl HTTP 200 bekrefter kun server-svar, ikke at sidebar-element/URL-redirect/«Send til attestering»-knapp faktisk virker.

**Fase 0.5-fremdrift (revidert scope etter kode-verifisering 2026-05-01):**
- § 1 Avdeling-tabell + User.avdelingId ✅ (`a90daabd`) — `Avdeling`-modell i `packages/db`, `User.avdelingId String?` med SetNull, migrasjon `20260501000015_add_avdeling`
- § 2 Kompetansetype + AnsattKompetanse + RBAC ✅ — Kompetansetype + AnsattKompetanse-tabeller (per A.28), OrganizationSetting utvidet med `kompetanseRegistreringTilgang` (firma_admin | bruker_egen | alle, default firma_admin), 7-kategori-seed i `packages/shared/src/types/index.ts` (`KOMPETANSE_KATEGORIER` + `KOMPETANSE_REGISTRERING_TILGANG` + `KOMPETANSE_IMPORT_KILDER`), migrasjon `20260501000016_add_kompetanse`. `kompetanse.*` tRPC-rute + UI bygges senere (Fase 0.5 § 6 eller separat). Varsling-integrasjon (90/30/7 dager) bygges separat når varsling-modul er klar.
- § 3 ProjectGroupByggeplass m2m + drop building_ids ✅ — `ProjectGroupByggeplass`-tabell (m2m groupId × byggeplassId, Cascade på begge), drop `ProjectGroup.byggeplassIder` (verifisert dødt felt — kun skrevet i `gruppe.ts:495-503`, aldri lest), refaktor `gruppe.oppdaterByggeplasser`-mutation til `prisma.$transaction([deleteMany, createMany])` mot koblingstabell, semantikk: tom array = alle byggeplasser. Migrasjon `20260501000017_add_project_group_byggeplass`. Prinsipp C-verifisering ferdig (C1 vedtatt).
- § 4 Drop `ProjectGroup.byggeplassIder` ✅ — slått sammen med § 3 (samme migrasjon)
- § 5 Slette-policy for byggeplass ✅ — API: ny `byggeplass.hentSletteSammendrag` (returnerer telleresult per modell, splittet bevares/slettes per cascade-policy fra schema), oppdatert `byggeplass.slett` med `navnBekreftelse`-input (case-insensitive match per Kenneth) + `verifiserAdmin` (strammet fra `verifiserProsjektmedlem`) + TRPCError FORBIDDEN ved mismatch. UI: ny `SletteLokasjonDialog` i `apps/web/src/app/dashbord/oppsett/lokasjoner/page.tsx` (erstatter `confirm()`-prompt) — viser bevares/slettes-seksjoner, tekstinput med navn-bekreftelse, slett-knapp disabled til match. i18n: 17 nye nøkler (nb + en). Cascade-valg utsatt til senere — kun SetNull-default i første versjon. Ingen schema-endringer

**Fase 0.5 KOMPLETT** — deployet til prod 2026-05-01 (merge develop `9fed74a5` → main `f0a515cd`). 3 nye migrasjoner applied (`20260501000015_add_avdeling`, `20260501000016_add_kompetanse`, `20260501000017_add_project_group_byggeplass`).

**Etter-Fase-0.5-arbeid (på develop):**
- Avdeling-UI implementert: ny tRPC-router `avdeling.*` (hentAlle/opprett/oppdater/slett, alle gated med verifiserFirmaAdmin) i `apps/api/src/routes/avdeling.ts`. Slett blokkeres med CONFLICT hvis brukere er tilknyttet. Ny side `/dashbord/firma/avdelinger` med tabell (navn/kode/aktiv-toggle/antall brukere) + opprett/rediger-modaler. Menyelement i firma-layout. 16 nye i18n-nøkler (`firma.avdelinger.*`). Deployet til prod 2026-05-01 (`2799a4d1`).
- Kompetanse-UI Runde 1: ny tRPC-router `kompetansetype.*` (full CRUD, gated firma-admin) + `kompetanse.hentMatrise` + `kompetanse.hentForBruker` (read-only). Ny `organisasjon.hentSetting` + `organisasjon.oppdaterSetting` (upsert, dekker alle 5 OrganizationSetting-felter). Ny `kompetanseStatus()`-utils i shared (gyldig/varsel/utløpt med 90-dagers terskel). Ny side `/dashbord/firma/kompetanse` med to faner: Matrise (read-only, fargemarkering, filter på kategori/avdeling/ansatt-søk) + Kompetansetyper (full CRUD med modal-dialoger). Settings-toggle for `kompetanseRegistreringTilgang` (firma_admin/bruker_egen/alle) i innstillinger-siden. Menyelement «Kompetanse» (Award-ikon) i firma-layout. ~37 nye i18n-nøkler (`firma.kompetanse.*`). Deployet til prod 2026-05-01 (`0965ddf2`).
- Kompetanse-UI Runde 2.5 (develop): CSV/Excel-import. Ny dependency `csv-parse@6.2.1` i `apps/api`. To nye tRPC-mutations (`importerForhandsvisning` + `importerBekreft`) med SHA-256 filHash-validering for å garantere konsistens mellom forhåndsvisning og bekreft. Atomisk-policy ved ukjente ansattnumre (avviser hele importen). Auto-opprett av kompetansetyper (default på). Kolonne-aliaser + DD.MM.YYYY norsk dato + ISO-dato + Excel-dato-serial. ImportFraFilDialog i UI med 4-stegs flyt (opplastning → forhåndsvisning → bekreft → resultat). Hjelpefunksjoner i `apps/api/src/utils/kompetanseImport.ts` (parseCsvFil + parseXlsxFil + beregnFilHash). 30 nye i18n-nøkler (`firma.kompetanse.import.*`). Klar for test-deploy.
- Kompetanse-UI Runde 2: AnsattKompetanse-CRUD via celle-klikk i matrisen. Ny `verifiserKompetanseSkriveTilgang(ctxUserId, malUserId)` i `tilgangskontroll.ts` (Alt A — sitedoc_admin og company_admin bypasser policy; ikke-admin følger `kompetanseRegistreringTilgang`-policy med fallback til `firma_admin` hvis OrganizationSetting mangler). 3 nye mutations i `kompetanse.ts` (opprett/oppdater/slett). UI utvidet: celle-klikk åpner ny `AnsattKompetanseDialog` (read-only header med bruker+type, redigerbare felter for utstedt/utløp/utsteder/sertifikat-nr/notat, klient-validering for utløp<utstedt). Slett via sub-modal (per CLAUDE.md slett-bekreftelse-regel — ikke confirm()). Klikk-tilstand styrt av lokal `kanSkriveKompetanse()` som speiler server-RBAC (UI-bekvemmelighet, server er sannhetskilden). 18 nye i18n-nøkler (`firma.kompetanse.dialog.*`). Klar for test-deploy. **Runde 2.5 utsatt:** CSV/Excel-import (krever `csv-parse`-install).

**Verifiserings-funn 2026-05-01 (mot kode):**
- ❌ `ByggeplassMedlemskap` UTSATT TIL FASE 4 (Mannskap-modul) — eneste forbrukere er innsjekk/utsjekk/geofence/§15-liste, alle Fase 4
- ❌ `EquipmentAnsvarlig.avdelingId` strøket — tabellen finnes ikke i db-maskin (Equipment har direkte `ansvarligUserId`)
- ✅ Prinsipp B (ingen tvungen byggeplass) bekreftet matcher kode 1:1 (kun Kontrollplan krever byggeplass — modul-policy, ikke prosjekt-blokker)
- ✅ Prinsipp C (koblingstabell vs jsonb) bekreftet trygg — `building_ids` skrives i `gruppe.ts:495-503` men leses ALDRI noe sted

**Fase 0 § E (deployet til prod 2026-05-01):** Alle 13 § E-steg implementert (E.9 hoppet per § E). § E-fremdrift: E.1 Activity (`13a746a7`), E.2 OrganizationSetting (`4a155c28`), E.3 ProjectOrganization-rename (`1bff8672`), E.4 primaryOrganizationId (`137eed6f`), E.5 ProjectModule (`d9bfafc4`), E.6 OrganizationPartner (`22a772b6`), E.7 OrganizationTemplate (`7709ea32`), E.8 BibliotekMal + C.17 (`29311756`), E.10 ProjectMember.periodeSlutt (`5b8beef6`), E.11 ExternalCostObject (`9c9dd682`), E.12 Godkjenning (`0622fc35`), E.13 User-utvidelse + B.7 (`37d49872`), E.14 OrganizationRole. Timer/Maskin-revurdering utsatt til etter Fase 0.5-deploy.

**Anker for Fase 0-koding:**
- [fase-0-beslutninger.md](fase-0-beslutninger.md) — **PRIMÆR ANKER** (23 vedtatte + 0 åpne BLOKKERE + 12 anbefalte utvidelser + 13-stegs migrerings-rekkefølge + B.7-utvidelse for multi-identifikator-auth)
- [arkitektur.md](arkitektur.md), [terminologi.md](terminologi.md), [dokumentflyt.md](dokumentflyt.md) — verifiserte fundament-filer (drift mot kode rettet 2026-04-27)
- [smartdok-undersokelse.md](smartdok-undersokelse.md) — empirisk grunnlag fra A.Markussen (UI-research 2026-04-26)
- [arkitektur-syntese.md](arkitektur-syntese.md) — helhetlig produktarkitektur (loan-pattern, modul-arkitektur)
- [timer.md](timer.md) — krever refaktor (enterpriseId → organizationId, Underprosjekt-modell erstattet av ExternalCostObject). **Verifiseres i Timer-revurdering**
- [maskin.md](maskin.md) — krever justering for fase-0-beslutninger (særlig EquipmentAnsvarlig). **Verifiseres i Maskin-revurdering**

**Sentrale arkitektur-funn (oppdatert 2026-04-27 etter komplett verifisering):**
- `ProjectModule` eksisterer (linje 752 i schema, brukt 30+ steder) — utvides med `organizationId` + `status` (3-nivå per A.17), ikke ny tabell
- `Activity` (sentral audit-tabell) finnes ikke — bygges i Fase 0 som første steg
- `OrganizationProject` har eksisterende felter (`id`/`organizationId`/`projectId`/`createdAt` + relasjoner) — renames til `ProjectOrganization` og utvides med `rolle`-felt (NOT blank m:n)
- `date-fns-tz` er ikke installert — krevet for tidssone-håndtering (lukkes implisitt av B.6)
- Cache-invalidation-mønster er ad-hoc (30 kall, ingen sentral policy) — definres i Fase 0, fylles i Fase 3
- Underprosjekt = `ExternalCostObject` (UI-term «Underprosjekt», Prisma-modell `ExternalCostObject` per A.1)
- **Lønnsart-katalog er datadrevet, tre-nivå** (16 lovpålagte + 25 bransje-relevante + kundens egne) — detaljer i [timer.md](timer.md)
- **Avdeling-tabell** bygges i Fase 0.5 (sammen med Byggeplass), ikke Fase 0 (per C.11)
- **Seed-mekanisme** (event-hook `onOrganizationCreated`) etableres tomt i Fase 0; innhold registreres i Fase 3
- **B.7 — Org-bytte-mekanikk:** Modell A (én User per person×firma) vedtatt. `User` får composite `@@unique([email, organizationId])` + `@@unique([phone, organizationId])` (forberedende for fremtidig multi-identifikator-auth). `ProjectMember.userId` cascade endres `Cascade → SetNull`
- **B.6 — Timestamptz-håndtering:** Selektiv migrasjon (medium scope) — 11 felter får `@db.Timestamptz` (timer/audit/godkjenning/PsiSignatur/frist-felter/Invitation), resten av schema beholder `timestamp(3)`

**Maskin-modul (`feature/maskin-db`):** under bygging. **Midlertidig modul-gating implementert 2026-04-30** via `Organization.harMaskinModul`-flagg (default `false`). HovedSidebar skjuler maskin-ikonet for firma uten flagget; eksisterende firma-isolering i maskin-rutene (`verifiserOrganisasjonTilgang`) hindrer cross-tenant-lekkasje. Aktivering per firma: `UPDATE organizations SET har_maskin_modul = true WHERE id = '<id>';`. Erstattes av full `OrganizationModule` + `modulProcedure('maskin')`-gating i Fase 0 per A.4 — den midlertidige kolonnen droppes da.

**Maskin Blokk A + B implementert (2026-05-01) på `develop`:**
- **Blokk A (schema-reconciliation, `de3fb1d0`):** EquipmentAnsvarlig-tabell (m:n for tilleggsansvarlige per A.6 hybrid) + 15 nye Equipment-felt (5 felles: internNavn, eierskap, eksportKode, harSporingsenhet, aarsmodell + 10 materialiserte Vegvesen-kolonner). Migrasjon `20260501131546_blokk_a_schema_reconciliation` deployet til test 2026-05-01.
- **Blokk B (Vegvesen-integrasjon):** Service-lag i `apps/api/src/services/maskin/` (vegvesen-api, vegvesen, vegvesen-worker, moduleGate, equipment) per cross-modul-konvensjon (arkitektur-syntese § 6.1.1). 3 nye tRPC-endepunkter: `hentFraVegvesenForhandsvisning` (synkron mutation, 409 ved duplikat), `opprettMedVegvesen` (Variant A — klient sender bekreftet vegvesenData, server validerer kjennemerke-match), `oppdaterFraVegvesen` (admin-only, kø-basert). VegvesenKo-worker: 60s polling-løkke + 5min watchdog + 15min pause ved 429 + 5 retries. Klient-UI: Vegvesen-flyt aktivert i `nytt/page.tsx` med forhåndsvisning-panel + «fortsett uten Vegvesen-data»-fallback + eierskap-velger (eid/leid/leasing/lant) + årsmodell-felt + kallenavn. Felles `normaliserRegnummer()` i `packages/shared/src/utils/regnummer.ts` brukes i klient-input, Zod-validering og server-sammenligning. ~36 nye i18n-nøkler.
- **Blokk C1 (read-only detaljside + filter-bar + statusendring):** Filter-bar i listevisning med chip-buttons (kategori med count, status, ansvarlig-dropdown, fritekstsøk, vis-pensjonerte-toggle). Klikk på rad navigerer til ny detaljside `/dashbord/maskin/[id]`. Detaljside har 8 seksjoner read-only (generelt, anskaffelse, ansvarlig, kjøretøy-info, EU-kontroll med trafikklys-banner, anleggsmaskin-info, småutstyr-info, notater) + statusendring-modal med pensjonertGrunn-velger og advarsel + Vegvesen-oppdater-knapp (admin-only, polling 10s mot vegvesenKo.hentStatus). Nye API-endepunkter: `equipment.list` med sok-filter, `equipment.antallPerKategori`, `equipment.hentMuligeAnsvarlige`, `bruker.hentMin`. ~50 nye i18n-nøkler.
- **Blokk C2 (modal-redigering + ansvarlig-CRUD):** Detaljside utvidet med rediger-knapper på 5 seksjoner (Generelt, Anskaffelse, Kjøretøy-info, Anleggsmaskin-info, Småutstyr-info) som åpner én generisk `RedigerModal`-komponent. Ansvarlig-seksjonen erstattet med full CRUD: hovedansvarlig kan endres (UserPicker), tilleggsansvarlige listes med periode-start + (×)-fjern-knapp, (+)-knapp åpner LeggTilAnsvarlig-modal. Server-side: ny `verifiserMaskinAnsvarligSkriveTilgang(ctxUserId, equipmentId)` i tilgangskontroll.ts — sitedoc_admin/company_admin/primær-ansvarlig kan endre ansvarlig-felter (per A.6 hybrid). Ny `ansvarlig`-router (`maskin.ansvarlig.list/tilfoy/fjern`) med soft-delete (periodeSlutt = now), cross-org-blokkering, conflict-sjekk. `equipment.oppdater` utvidet med 30+ redigerbare felt (alle Generelt/Anskaffelse/manuelle Kjøretøy-info/Anleggsmaskin-info/Småutstyr-info). Vegvesen-felter overskrives av oppdaterFraVegvesen-flyten — ikke manuelt. ~18 nye i18n-nøkler. **Lukker forutsetning for SmartDok-import.**
- **Type-fix (`77d7bd67`, 2026-05-01):** Build feilet på test for C2 — `Input`-komponenten i RedigerModal returnerer `string | null` via onChange, men `RedigerInputs.type`-feltet er `string | undefined` (påkrevd-felt i `equipment.oppdater`-schema, kan ikke settes null). Lokal `tsc --noEmit` fanget ikke dette fordi local config er mindre strikt enn Next.js-build. Fix: erstattet `<Input v={inn.type}>` med inline `<input>` for type-feltet i Generelt-modalen. **Lærdom for fremtidige bugs:** Next.js-build kjører strengere tsc enn lokal — verifiser alltid med `pnpm build --filter @sitedoc/web` lokalt før test-deploy hvis nye felter med komplekse Optional-typer introduseres.

**Timer-modul Fase 3 STARTET 2026-05-01 (Infrastruktur-commit, på `feature/maskin-db`):**
- **packages/db-timer/-pakke opprettet:** 7 Runde-1-tabeller i postgres-schema `timer` (`lonnsarter`, `aktiviteter`, `tillegg`, `expense_categories`, `daily_sheets`, `sheet_timer`, `sheet_tillegg`). Egen Prisma-klient (`.prisma/timer-client`), cross-package-FK som svake String-felt (samme mønster som db-maskin). Init-migrasjon `20260501200000_init`.
- **Kjernen-utvidelse:** `Organization.harTimerModul Boolean default false` (midlertidig modul-flagg, samme mønster som `harMaskinModul`). `OrganizationSetting` utvidet med 4 felt: `dagsnorm Decimal default 7.5`, `overtidsmatTerskel Decimal default 9.0`, `tillattSelvAttestering Boolean default true`, `timerLockEtterDager Int? null` (Variant A — null = ingen alders-grense, status styrer låsing). Migrasjon `20260501200000_add_timer_modul_og_settings`.
- **Service-lag:** `apps/api/src/services/timer/moduleGate.ts` (`erTimerAktivert` + `krevTimerAktivert` + `TimerModulIkkeAktivertError`). `apps/api/src/services/seed/index.ts` (5 stub-funksjoner for Runde 1A: `seedLonnsartNivaa1/2`, `seedAktiviteter`, `seedTillegg`, `seedExpenseCategories` + samlet `seedTimerForOrganization`).
- **Workspace-deps:** `@sitedoc/db-timer` lagt til i `apps/api/package.json` + `apps/web/package.json`. Krever `pnpm install` før `prisma generate`.
- **Migrasjons-SQL skrevet manuelt** (ikke kjørt mot lokal-DB ennå). Kenneth kjører `pnpm install` + `pnpm --filter @sitedoc/db-timer exec prisma generate` + `pnpm --filter @sitedoc/db-timer exec prisma migrate deploy` + tilsvarende for `@sitedoc/db` mot test før prod.
- **Ikke i denne commit-en:** prototype-sletting (Runde 1B), modulProcedure i tRPC-base, dagsseddel-flyt, leder-attestering, mobil/offline, eksport-adaptere.

**Timer-modul Fase 3 — Runde 1A IMPLEMENTERT 2026-05-01 (`feature/timer-1a`):**
- **tRPC-router `timer.*`:** ny mappe `apps/api/src/routes/timer/` med `onboarding.ts` (status/aktiverNivaa1/aktiverNivaa2/aktiverTomKatalog), `lonnsart.ts` (list/opprett/oppdater/deaktiver), `aktivitet.ts` (analog), `tillegg.ts` (analog), `index.ts`. Registrert i `appRouter`. `prismaTimer` lagt i tRPC-context. RBAC: `verifiserFirmaAdmin` for skrive-mutations, alle ansatte i firma kan lese.
- **Seed-funksjoner med faktisk innhold:** `seedLonnsartNivaa1` (16: Fastlønn, Timelønn, Overtid 50%/100%, sykemelding/permittering/feriepenger osv. per AML/Folketrygdloven/Ferieloven). `seedLonnsartNivaa2` (25: Velferdspermisjon, Reise 7,5–15/15–30/30–45/45–60 km, Diett-pakke, Skifttillegg, Lærling-pakke, Innleid arbeidskraft, Fakturerbar tid m.fl.). `seedAktiviteter` (3: Anleggsarbeid, Maskintimer, Garanti/reklamasjon). `seedTillegg` (3: Overtidsmat, Smusstilleg, Beredskap-vakt). `seedExpenseCategories` (5: Drivstoff, Parkering, Diett, Verktøy, Annet). Alle idempotente — re-kjøring overskriver ikke.
- **Web-sider:** `/dashbord/firma/timer/{onboarding,lonnsarter,aktiviteter,tillegg}/page.tsx` + felles `layout.tsx` (sub-nav) + `page.tsx` (redirect). Onboarding-side har 3 scenarioer (Aktiver Nivå 1, Nivå 1+2, tom katalog). CRUD-tabeller med opprett/rediger-modal og deaktiver/reaktiver-toggle (soft-delete via Restrict-FK på SheetTimer/SheetTillegg/DailySheet). Sidebar-element «Timer» (Clock-ikon) i firma-layout, gates på `harTimerModul`.
- **i18n:** ~85 nye nøkler under `firma.timer.*` (nb+en) + 3 generiske (`ja`, `nei`, `handling.handlinger`).
- **Verifisert:** Lokal `pnpm build --filter @sitedoc/web` grønt — alle 5 timer-ruter kompilert. tRPC-typer eksponert via `appRouter`. Klar for test-deploy.

**Timer-modul Fase 3 — Runde 1B (dagsseddel-flyt) IMPLEMENTERT 2026-05-01 (`feature/timer-1b`):**
- **Slettet prototype:** `apps/web/src/app/dashbord/[prosjektId]/timer/page.tsx` (914 linjer hardkodet demodata) — erstattet av reell implementasjon.
- **tRPC-router `timer.dagsseddel.*`:** ny fil `apps/api/src/routes/timer/dagsseddel.ts` med 12 endepunkter: `list` (filter på projectId/userId/periode/status, kun egne sedler hvis ikke admin), `hentMedId` (full join inkl. timer-rader/tillegg-rader/aktivitet/prosjekt), `opprett` (idempotent via `clientUuid`), `oppdater` (header-felt), `tilfoy/oppdater/fjernTimerRad`, `tilfoy/oppdater/fjernTilleggRad`, `send` (draft → sent, krever ≥1 timer-rad), `slett` (kun draft).
- **Status-livssyklus enforcing:** `draft`/`returned` redigerbar, `sent`/`accepted` låst. `OrganizationSetting.timerLockEtterDager` sjekkes kun for `draft` (null = ingen alders-grense). Cross-org-blokkering via `verifiserProsjektmedlem` på opprett, eierskaps-sjekk via `hentEgenDagsseddel` på alle muteringer.
- **Web-sider under `/dashbord/[prosjektId]/timer/`:** `page.tsx` (liste-side med ISO-uke-velger, status-filter, status-badge), `ny/page.tsx` (opprett-skjema med dato/aktivitet/klokkeslett/pause/beskrivelse, default-aktivitet «Anleggsarbeid» hvis seedet, stabil clientUuid for idempotens), `[id]/page.tsx` (detaljside med 4 seksjoner: header-redigering, timer-rader-CRUD, tillegg-rader-CRUD, send/slett-handlinger). `status-badge.tsx` som delt komponent (Next.js page.tsx kan ikke ha named exports).
- **HovedSidebar Timer-gating:** Timer-element gates på `harTimerModul` (samme mønster som maskin). `kreverFirmaModul: "maskin" | "timer"` utvidet i `SidebarElement`-interface.
- **i18n:** ~50 nye nøkler under `timer.*` (nb+en) — felter, status-typer, kolonneoverskrifter, dialog-titler, feilmeldinger.
- **Verifisert:** `pnpm build --filter @sitedoc/web` grønt — 3 nye `/[prosjektId]/timer/*`-ruter + 5 fra Runde 1A. Type-fix: TS2589 «Type instantiation excessively deep» rettet ved å eksplisitt typee `onError: (e: { message: string })` på alle useMutation-callbacks i detaljsiden (per CLAUDE.md-regel — pre-eksisterende lærdom).
- **Deployet til prod 2026-05-01** (`c1122c2e`). Ingen nye DB-migrasjoner — kun kode.

**Timer-modul Fase 3 — Runde 1C (leder-attestering) IMPLEMENTERT 2026-05-01 (`feature/timer-1c`):**
- **tRPC-router-utvidelse:** 4 nye endepunkter i `dagsseddel.ts`: `hentTilGodkjenning({projectId})` (alle innsendte for prosjektet, beriket med ansatt-info), `kanGodkjenne({projectId})` (boolean — sidebar-gating), `returner({id, kommentar})` (sent → returned, krever ikke-tom kommentar), `attester({id})` (sent → accepted med pris-snapshot per rad og DailySheet.attestertAvUserId/attestertVed). Lokal helper `erProsjektLeder` + `krevProsjektLeder` — sjekker `ProjectMember.role ∈ {admin, project_manager}` eller `sitedoc_admin`/`company_admin` med matchende org.
- **Snapshot-pattern (Fase 0 A.7):** Ved attester kopieres katalog-data inn i `SheetTimer.attestertSnapshot` + `SheetTillegg.attestertSnapshot` JSON-felt: `{lonnsartId/tilleggId, kode, navn, type, prisMotKunde, internkostnad, sats, satsEnhet, attestertVed}`. Decimal-felt serialiseres som strings (toString()) for å bevare presisjon. Atomisk via `prismaTimer.$transaction([...])` — alle rader + status-overgang i én commit.
- **Web-side `/dashbord/[prosjektId]/timer/godkjenning/page.tsx`:** Leder-vy med tabell over innsendte sedler (dato/ansatt/aktivitet/totaltimer/rader-count). Tre actions per rad: åpne (chevron til detaljside), returner (RotateCcw-ikon, åpner kommentar-modal), attester (Check-ikon, direkte mutation). Returner-modal har påkrevd kommentar (min 1 tegn). `kanGodkjenne`-sjekk gir tydelig «ingen tilgang»-melding for ikke-ledere.
- **Detaljside-utvidelse (`[id]/page.tsx`):** To nye banner-seksjoner: returned-banner med leder-kommentar (amber, viser hva som må rettes), accepted-banner med attestert-tidspunkt (grønn). `lederKommentar`-feltet (allerede i schema) brukes som tilbakemeldingskanalen. Ansatt kan redigere returned-sedler og sende på nytt (samme send-mutation, status går returned → sent).
- **Sidebar-utvidelse:** Nytt seksjons-element «timer-godkjenning» (CheckCircle2-ikon) i `Seksjon`-typen + seksjonMap. HovedSidebar gates på `harTimerModul && kanGodkjenne` — usynlig for ikke-ledere. URL-mønster `/dashbord/[prosjektId]/timer/godkjenning` håndteres av useAktivSeksjon (spesialfall etter prosjektId-deler).
- **i18n:** ~17 nye nøkler under `timer.godkjenning.*` + `timer.detalj.{returnertTittel,returnertHjelp,attestertTittel}` + `nav.timerGodkjenning` (nb+en).
- **Verifisert:** `pnpm build --filter @sitedoc/web` grønt — ny ruten `/dashbord/[prosjektId]/timer/godkjenning` + alle eksisterende kompilert. tsc grønt for api+web (kun pre-eksisterende vitest-typing). Klar for test-deploy.

**Timer-modul Fase 3 — Runde 2 (mobil + offline-sync) C1–C5 IMPLEMENTERT 2026-05-01 (`feature/timer-2`, IKKE merget til develop):**
- **Godkjent scope:** kun timer-rader + tillegg-rader (ikke utlegg/maskin), kun ansatts egne sedler på mobil (leder-attestering kun på web), server-wins ved konflikt med tydelig banner.
- **C1 (`8a3c8a9a`) — Drizzle-skjema:** 6 nye SQLite-tabeller i `apps/mobile/src/db/schema.ts`: `dagsseddel_local` (id = clientUuid, sync-atom for hele sedlen), `sheet_timer_local`, `sheet_tillegg_local` (skrive-tabeller med syncStatus pending/synced/conflict) + `lonnsart_local`, `aktivitet_local`, `tillegg_local` (read-only katalog-cache). Idempotente CREATE TABLE IF NOT EXISTS i `migreringer.ts`. Decimal-felt fra Postgres serialiseres som tekst for presisjon, timestamps Unix ms.
- **C2 (`4c89e498`) — Server-side sync-endepunkter:** To nye i `apps/api/src/routes/timer/dagsseddel.ts`: `hentEndringerSiden` (query — pull alle sedler endret etter ISO timestamp, full pull begrenset til siste 90 dager, returnerer sedler med rader serialisert), `syncBatch` (mutation — Array<{clientUuid, ...rader}>, maks 100, per-seddel `prismaTimer.$transaction`, uavhengig resultat per seddel: `ok`/`conflict`/`feilet`, ingen rollback på tvers, klient kan ikke sette status=accepted, rader erstattes via deleteMany+createMany).
- **C3 (`e8f15f1e`) — Sync-motor:** Ny `apps/mobile/src/services/timerSync.ts` med `syncTimer(klient, userId)` som orkestrerer push (pending → server) + pull (siden → server), batches av 100 sedler. Ny `apps/mobile/src/providers/TimerSyncProvider.tsx` etter SpraakProvider — eksponerer `pendingAntall/conflictAntall/sistSynkronisert/syncerNa/sisteFeil` + `triggerSync()`. Auto-trigger ved login + nett-gjenkomst, 30s interval mens app er aktiv + online. Server-wins: conflict overskriver lokal med serverData.
- **C4 (`27598e7a`) — Katalog-cache:** Ny `apps/mobile/src/services/timerKatalog.ts` med `refreshKatalog(klient)` (full nedlasting fra `timer.{lonnsart,aktivitet,tillegg}.list`, atomisk overskriving per type) + synkrone lese-funksjoner (`hentLonnsarterLokalt`/`hentAktiviteterLokalt`/`hentTilleggLokalt`/`finnLonnsartLokalt`/etc.) for offline-trygge UI-velgere. Provider trigger katalog-refresh sammen med syncTimer ved login.
- **C5 (`d2a81fa7`) — UI-liste:** Ny `apps/mobile/app/timer/_layout.tsx` + `index.tsx` (liste over mine dagssedler les fra dagsseddel_local, sortert dato desc, pull-to-refresh, refocus-rerender, FAB → /timer/ny). Ny `TimerStatusMerkelapp.tsx` (status-badge utkast/sendt/returnert/attestert + sync-status-badge) + `TimerSyncStatusBar.tsx` (tynn statusbar: offline/syncerNa/pending/conflict/synced med farger + manuell trigger). Mer-tab utvidet med Timer-rad + badge for pending/conflict.
- **Pre-eksisterende kjent issue:** Mobil tsc har 9 pre-eksisterende feil (oppgave/sjekkliste/PSI/3D/hjem-tab) som ikke er knyttet til timer-2 — Metro bundler kjører uavhengig av tsc. Trpc-import-feil i rapportobjekter ble fikset på develop (`f062c5f2`) før timer-2 — fix vil komme inn naturlig ved senere develop-merge.
- **C5 visuelt verifisert 2026-05-02** på iOS Simulator + fysisk mobil etter test-deploy (`0342b883`). Liste-side viste eksisterende sedler synket fra prod-DB, sync-statusbar fungerer, Mer-tab Timer-rad navigerer korrekt.
- **C6 (`90c73991`) — Opprett-skjema + detaljside:** `apps/mobile/app/timer/ny.tsx` (DateTimePicker + prosjekt-velger via `trpc.prosjekt.hentMine` + aktivitet-velger fra lokal cache med default `Anleggsarbeid` + valgfri beskrivelse → `randomUUID()` clientUuid + insert til `dagsseddel_local` med `syncStatus=pending`). `apps/mobile/app/timer/[id].tsx` (header med dato/aktivitet/status-badge, status-banners for returned/accepted/conflict/pending, timer-rader-seksjon med +/rediger/slett, tillegg-rader-seksjon analog, send-til-attestering-knapp som krever ≥1 timer-rad, slett-knapp med `Alert.alert`-bekreftelse — kun draft). 4 modaler (TimerRadModal, TilleggRadModal, LonnsartVelgerModal, TilleggVelgerModal) inline i [id].tsx leser fra lokal cache med søk når > 7 elementer. Alle endringer markerer `syncStatus=pending` + `sistEndretLokalt` + trigger sync via `TimerSyncProvider`.
- **C7 — i18n + docs:** ~50 nye nøkler under `timer.*` i nb.json + en.json (sync.*, status.utkast/sendt/returnert/attestert, felt.*, tilfoy.*, rediger.*, ingenLonnsarter/Tillegg/TimerRader/TilleggRader, feil.*, bekreftSlett*, sendTilGodkjenning, slettDagsseddel m.fl.). Total: 155 timer-nøkler per språk. CLAUDE.md + STATUS.md + timer.md oppdatert med Runde 2-fremdrift.
- **C8 (`af91dff3`) — Underprosjekt-velger:** Ny `eksternKostObjekt`-router (server) med `list({ projectId? })` for aktive ECO-er filtert på `status="aktiv" + timerregistreringApen=true`. Ny `external_cost_object_local`-tabell + idempotent migrering. `timerKatalog.refreshKatalog` henter ECO-er via Promise.all med catch-fallback (ikke-kritisk hvis router mangler). UnderprosjektVelgerModal i TimerRadModal (filtrerer på prosjekt + søk når > 7). TimerRadVis viser ECO-etikett (proAdmId + kortNavn) under lønnsart. Fjern-X-knapp ved siden av valgt underprosjekt. ~3 nye i18n-nøkler.
- **Merge til develop:** `1cce62f3` 2026-05-02 sent kveld. Inkluderer også OppgaveModal-fix (`ff313e54` — `trpc.arbeidsforlop` → `dokumentflyt`).
- **Test-deploy + prod-deploy utsatt til neste sesjon.** Server-side krever fersk deploy for at C6–C8 skal fungere fra mobil (syncBatch + hentEndringerSiden + dev-login + eksternKostObjekt-router).

**DB-naming-opprydning — ferdig (parkert):**
- Faggruppe-rename gjennomført på test (2026-04-15/16) og prod (2026-04-16) via tre migreringer (`navnegjennomgang`, `enterprise_rename_dokumentflyt_part`, `faggruppe_rename`). Verifisert i [db-naming-audit-2026-04-25.md](db-naming-audit-2026-04-25.md)
- U.1 (`project_groups.building_ids` jsonb) utsatt til Fase 0.5 — drop koordineres med m2m-koblingstabell
- U.2 (FK-constraint-navn fortsatt på engelsk) parkert som lavt-prioritert kosmetikk — tas naturlig ved neste større migrering
- Lokal-DB er bevisst ikke vedlikeholdt; re-seedes fra test ved behov per § «Primærmiljø»

Status og detaljer: [db-opprydning.md](db-opprydning.md).

## Pauset arbeid

**Timer/Maskin-revurdering** er utsatt til etter Fase 0-fundament er ferdig. timer.md og maskin.md har drift mot fase-0-beslutninger og må justeres før Fase 3 (Timer-modul) og Fase 1-fullføring (Maskin-modul-gateway) — men Fase 0-fundamentet bygges nå uavhengig av denne revurderingen.

## Planlagte oppgaver

**HMS-tilgang for arbeidsgiver på andres prosjekter (juridisk gap, 2026-05-03):**
A.27 gir firma-HMS-ansvarlig innsyn i «firmaets prosjekter» men IKKE i prosjekter
der firmaets ansatte jobber som UE. Arbeidsmiljøloven § 2-1 krever at arbeidsgiver
har HMS-ansvar for egne ansatte uavhengig av arbeidsplass. Løses i HMS-tilgang-runde
(Fase 4 / Mannskap).

**Steg 4c — Godkjenning UI (parkert 2026-05-03):**
Utsatt til etter møte med A.Markussen og/eller ProAdm API-tilgang.
Forutsetninger som mangler:
- Avklart dokumentflyt-mal for endringsmeldinger (krever A.Markussen-input)
- ProAdm API-integrasjon (eller manuell oppsett av mal)
- Domeneavklaring: hvilke felter skal med, hvem godkjenner, hvilken flyt

Modellen (Godkjenning + DocumentTransfer) er implementert i Fase 0 § E.12.
Teknisk grunnlag er på plass — kun domene-avklaring mangler.

**NB:** Når Godkjenning-detaljside bygges (Steg 4c): inkludér «Hvem har ballen»-badge etter samme mønster som sjekkliste/oppgave-detalj (`e82e51c5`). Server: include `recipientGroup` i `godkjenning.hentMedId`. Klient: amber pill ved siden av `<StatusBadge />` i header. Bruker eksisterende i18n-nøkkel `tabell.venterPaa`.

**Header-koordinering: firma-bytte nullstiller ikke prosjekt-kontekst (observert 2026-05-03):**
Når sitedoc_admin bytter aktivt firma via FirmaVelger, beholdes det aktive prosjektet i
ProsjektVelger selv om prosjektet tilhører et annet firma. Prosjektlisten bør:
1. Filtreres på valgt firma (vise kun prosjekter der primaryOrganizationId = valgtFirma.id)
2. Nullstille aktivt prosjekt ved firma-bytte

Kompleksitet: Lav-middels (~2-3t). Ikke blokkerende for pågående arbeid.
Tas som egen oppgave etter Steg 4 er ferdig.

**Arkitektur-planlegging — samlet sesjon nødvendig (2026-05-03):**
Følgende moduler mangler forankring i vedtatt arkitekturplan ([terminologi.md § 0](terminologi.md) tre nivåer: Firma → Firmaadministrasjon → Prosjekter, samt [arkitektur-syntese.md](arkitektur-syntese.md) helhetlig produktarkitektur):
- Timer-modul: bygget uten global firma-kontekst på plass
- Maskin-register: bygget uten global firma-kontekst på plass
- Mannskap/kompetansematrise: ikke planlagt i firma-kontekst
- Organization vs OrganizationPartner: skillet mangler i datamodellen

Før videre koding på noen av disse: hold en dedikert planleggingssesjon med
frisk Opus-kontekst. Les [terminologi.md § 0](terminologi.md) + [arkitektur-syntese.md](arkitektur-syntese.md) som utgangspunkt.
Kartlegg alle koblinger mellom modulene og firma-konteksten.
Prioriter: Strategi A (modul-filter) → firma-kontekst full konvergens → maskin-import.

**Organization vs OrganizationPartner — fundamentalt skille mangler (observert 2026-05-03):** Test-DB inneholder Organization-rader som ikke er reelle kunder (Byggherre, Tømrer Hansen, Elektrikker Hansen, Hovedentreprenør). De ble opprettet som «skall-firmaer» for å representere parter i faggrupper/dokumentflyt. Datamodellen tillater dette uten advarsel — det finnes ingen `type`/`erKunde`-felt på Organization som skiller «firma som bruker SiteDoc» fra «firma som er part i et prosjekt».

**Riktig modell:** `OrganizationPartner` (linje 197-217 i schema.prisma) er det rette stedet for faggruppe-parter. Hvert kunde-firma har sitt eget partner-bibliotek (`OrganizationPartner.organizationId` peker til kunden). `Faggruppe.partnerId` (nullable FK) kobler en faggruppe til en partner-rad. Den eksisterer for nettopp dette formålet, men test-data har misbrukt Organization-tabellen i stedet.

**Heuristikk-signaler for «reelt firma» (i fravær av eksplisitt felt):** users.length > 0 + harMaskinModul/harTimerModul satt + OrganizationSetting eksisterer + primaryProjects.length > 0 + avdelinger/kompetansetyper finnes. Alle disse er null/0 for skall-firmaer.

**Konsekvenser:**
- Firma-velger i Toppbar (etter `9175ab84`) viser skall-firmaer som om de var administrerbare. Klikk på dem fører til tom firma-admin-side.
- Maskin-import er særlig sårbart: hvis sitedoc_admin velger et skall-firma og kjører import, opprettes Equipment-rader under et firma ingen administrerer = datakorruption.
- Prod-DB ser korrekt ut i dag (3 reelle firmaer), men datamodellen forhindrer ikke fremtidig misbruk.

**Mulige strategier (rangert):**
- **A. Filter på modul-flagg** (5 min) — pragmatisk for maskin/timer-velgere. `WHERE har_maskin_modul = true` filtrerer skall-firmaer effektivt for import-flyten.
- **B. Filter på users-count** (30 min) — fanger reelle firmaer mer generelt.
- **C. Nytt felt `Organization.erKunde Boolean`** (2-3t migrasjon + backfill) — eksplisitt skille, riktig langsiktig.
- **D. Migrer skall-firmaer til OrganizationPartner** (6-8t DB-cleanup) — rensker datakorrupsjon, krever audit per rad.

**Anbefalt rekkefølge:** ~~Strategi A umiddelbart for maskin-import-velgeren.~~ ✅ **Strategi C IMPLEMENTERT 2026-05-03** (`Organization.erKunde`-feltet — se «Pågående arbeid» øverst). Strategi A kan nå bygges på erKunde-feltet hvis behov. Strategi D som datakvalitets-prosjekt etter A.Markussen er stabilt.

**Firma-administrasjons-navigasjon — strukturell rydding (observert 2026-05-03):** Etter at global firma-kontekst (`9175ab84`) ble bygd, observerte vi at firma-velger i Toppbar kun virker på `firma/layout.tsx` — ikke på undersidene. Dypere analyse avdekket to ulike «firma»-konsepter i kodebasen:

1. **`/dashbord/oppsett/firma` («Prosjekteiers innstillinger»)** — viser firma som eier det aktive prosjektet via `ProjectOrganization`-tabellen. Per-prosjekt-bundet, henter via `organisasjon.hentForProsjekt(projectId)`. Viser tom-state «Ingen firma — Du er ikke tilknyttet noe firma» når prosjektet mangler `ProjectOrganization`-rad. Skal IKKE følge FirmaVelger.
2. **`/dashbord/firma/*` (firma-admin-seksjon, ~12 sider)** — globale firma-funksjoner: avdelinger, brukere, fakturering, innstillinger, kompetanse, prosjekter, timer-katalog. Skal følge FirmaVelger, men hver underside henter sin egen orgId via `verifiserFirmaAdmin(ctx.userId)` som leser `bruker.organizationId` direkte. Sitedoc_admin uten orgId vil fortsatt feile på undersidene.

**Tre lag som mangler for full konvergens:**
- **Lag 1 (server, ~4-6t):** ~10 ruter må ta `organizationId` som input og bruke ny `autoriserAdminForFirma(userId, orgId)`-helper. Mønster eksisterer i `maskin/import.ts:autoriserImportForFirma`.
- **Lag 2 (klient, ~3-4t):** ~10 sider må sende `useFirma().valgtFirma.id` som input til mutations/queries.
- **Lag 3 (rename, ~30 min):** «Firmainnstillinger» under prosjekt-sidebar er forvirrende navngitt — bør rename til «Prosjekteier» eller «Eier-firma» for å tydeliggjøre at det IKKE er firma-admin.

**Total estimat:** ~10-12 timer. Ikke-blokkerende for vanlig drift; sitedoc_admin (Kenneth) påvirket — ikke A.Markussen-kunder. Prioriter etter Maskin-import-leveransen.

**Onboarding-veileder (prioritert — forutsetning for A.Markussen):** Ny bruker vet ikke rekkefølge eller URL for oppsett etter prosjektopprettelse. Observert 2026-05-02: 4 404-feil ved forsøk på å finne faggruppe-oppsett via intuitive URL-er. Konkret rotårsak: to nesten-identiske faggruppe-sider eksisterer (`/dashbord/[prosjektId]/faggrupper` er **read-only**, mens `/dashbord/prosjekter/[id]/faggrupper` har **full CRUD**) — ingen visuell forskjell, ingen lenke fra read-only-siden til full versjon.

**Runde 1 (a)+(b) DEPLOYET TIL PROD 2026-05-02** (`6ed8b676`):
- ✅ (a) Lenke fra read-only faggrupper-side til CRUD: ny header-knapp «Administrer faggrupper» (Settings-ikon, øverst til høyre) + action-knapp i EmptyState. Begge peker til `/dashbord/prosjekter/${prosjektId}/faggrupper`.
- ✅ (b) Pencil-ikon (alltid synlig, text-gray-300) ved siden av brukernavn i `/dashbord/oppsett/brukere` — klikk på navn eller ikon åpner redigeringsmodus (samme oppførsel som før, men nå oppdagbart).

**SmartDok maskin-import dag 1 på develop 2026-05-03:**
- ✅ `apps/api/src/utils/maskinImport.ts` — parser for SmartDok Excel-eksport. 13 kolonner (Maskin, Internnummer, Reg.nr, Maskinkode, Årsmodell, Lokasjon, Sist endret, Maskinansvarlig 1, Maskinansvarlig 2, Timetall, Km.stand, Notat, Status). SHA-256 fil-hash. Filtrering: «x»-rader = testdata. 0XXX-placeholder → `internNummer=null`. Kategori-mapping verifisert mot A.Markussen 126-rad-fil:
  - Med gyldig regnr → kjøretøy (Vegvesen-oppslag bekrefter)
  - 7000-7599 (uten regnr) → kjøretøy (bilpark)
  - 7600-7699 (uten regnr) → anleggsmaskin (truck, hjullaster, dumper)
  - 7700-7999 (uten regnr) → småutstyr (redskap, GPS, hammer)
  - 9XXX → anleggsmaskin (eierskap=leid)
  - 0XXX-placeholder → utled fra 4-sifret prefiks i navn-feltet
- ✅ `apps/api/src/routes/maskin/import.ts` — to nye tRPC-mutations:
  - `importerForhandsvisning` — parse + matching-rapport (kategori-fordeling, ansvarlig-match mot User.name case-insensitive, duplikat-sjekk på internNummer per org, 25 første rader som forhåndsvisning)
  - `importerBekreft` — atomisk Prisma-transaction: Equipment + EquipmentAnsvarlig (kun rader med Maskinansvarlig 2) + VegvesenKo prio 200. Skip duplikater. Umatcha ansvarlig → `null` + advarsel (ikke blokker per Kenneth's beslutning).
- ✅ Verifisert mot ekte fil: 125 importerbare av 126 (1 testrad filtrert), 36 med regnr, 11 leid, 10 0XXX-null, 15 ansvarlige. Fordeling 37 kjøretøy / 50 anleggsmaskin / 38 småutstyr.
- ✅ Vegvesen-prio 200 = lavere enn 100 (auto) — worker plukker én om gangen via `ORDER BY prioritet ASC, opprettet ASC` i 60s-polling. Naturlig spredning over tid (ingen 429-risiko).
- ✅ Dag 2: klient-UI på develop. Standalone-side `/dashbord/maskin/import` med 4-stegs progress-indikator (Last opp → Forhåndsvis → Bekreft → Resultat). Forhåndsvisning viser kategori-fordeling (kjøretøy/anleggsmaskin/småutstyr), totalsum, antall med regnummer, antall leid, fargemerkede advarsler (valideringsfeil rød / filtrerte testdata grå / duplikater gul / umatcha ansvarlig amber / matcha ansvarlig grønn) + tabell med 25 første rader (radnummer, navn, internnr, regnr, kategori, eierskap, ansvarlig 1+2 med Check/X-ikon for match-status). Bekreft-steg viser sammendrag + advarsel om atomisk operasjon. Resultat-steg viser opprettet-antall, Vegvesen-kø-antall, hoppet-over-liste, umatcha-liste. «Importer fra SmartDok»-knapp lagt til på `/dashbord/maskin`-hovedsiden. 60 nye i18n-nøkler i nb+en (`firma.maskin.import.*` + `maskin.importerFraSmartDok`). Verifisert med `pnpm build --filter @sitedoc/web` 37.6s grønt (Next.js strenge tsc).
- ⏳ Dag 3: test-runde mot test-firma i test-DB FØR prod (per Kenneth's beslutning).

**Dag 3 fix 2026-05-03 — fil-interne duplikater:** Test-runde mot Byggeleder feilet ved bekreft-steg. Rotårsak: SmartDok-fila har internnummer `7084` på to rader (17 og 99). `importerBekreft` filtrerte bare DB-eksisterende internnumre, ikke fil-interne. Andre forekomst brakk `@@unique([organizationId, internNummer])` og rullet tilbake hele transaksjonen. Fix: filtrer begge kategorier FØR `$transaction` — første forekomst importeres, etterfølgende hoppes over med grunn «duplisert i fila». Forhåndsvisning returnerer nå `duplikaterDB` + `duplikaterFilInterne` separat i tillegg til total. Hoppet-over-rapport skiller mellom «finnes allerede i firmaet» og «duplisert i fila». Klar for ny test-runde.

**Runde 1 (c) progress-banner DEPLOYET TIL PROD 2026-05-02** (`098f7586`):
- ✅ Ny tRPC-query `prosjekt.hentOnboardingStatus({ projectId })` returnerer 4 booleans: harDokumentflyt, harBrukergruppe (kategori="brukergrupper"), harMalKobletTilFlyt (DokumentflytMal-rader), harLokasjon (Byggeplass-rader).
- ✅ Banner på prosjekt-dashbord (`/dashbord/[prosjektId]`) plasseres over prosjekt-header og under prøveperiode-banneret. Vises kun for admin (`role ∈ {admin, owner}`) og kun når minst ett steg gjenstår. Hvert steg er en pill med lenke til riktig oppsett-side: Dokumentflyt + Maler → `/dashbord/oppsett/produksjon/kontakter`, Brukergrupper → `/dashbord/oppsett/brukere`, Lokasjoner → `/dashbord/oppsett/lokasjoner`.
- ✅ 5 nye i18n-nøkler under `onboarding.*` i nb+en.
- ✅ Konsolidering av de to faggruppe-sidene IMPLEMENTERT på develop 2026-05-05. `/dashbord/[prosjektId]/faggrupper` har full CRUD (opprett/rediger/slett). Legacy `/dashbord/prosjekter/[id]/faggrupper` slettet, Faggrupper-fane fjernet fra `prosjekter/[id]/layout.tsx`, oversiktskort i `prosjekter/[id]/page.tsx` peker til ny rute.

Blokkerer selvstendig A.Markussen-onboarding. Ankret i [onboarding-veileder.md](onboarding-veileder.md).

**Testbrukere (planlagt — etter Timer er ferdig):** Opprett strukturerte testbrukere i test-DB for systematisk verifisering av tilgangsnivåer:
- **Ola Tømrer** — produksjon-rolle (`ProjectMember.role = "worker"` eller `"field_user"`)
- **Per Prosjektadmin** — `ProjectMember.role = "project_manager"`
- **Kari Firmaadmin** — `User.role = "company_admin"` med `organizationId` satt
- **Tore SiteDocAdmin** — `User.role = "sitedoc_admin"`

Formål: systematisk verifisering av at riktige funksjoner er tilgjengelig per rolle, og at utilgjengelige funksjoner er skjult/blokkert. Eksempel: Timer-attestering skal kun være synlig for Per/Kari/Tore (ikke Ola); Firma-administrasjon skal kun være tilgjengelig for Kari/Tore; Superadmin-flater kun for Tore. Dekker også verifisering av RBAC-helpers (`harProsjektTilgang`, `verifiserOrganisasjonTilgang`, `verifiserSiteDocAdmin`) og sidebar-gating.

### ~~«Hvem har ballen» — mangler synlig indikator (observert 2026-05-02)~~ — LØST 2026-05-05

Listene fikk badge før denne sesjonen (sjekkliste-listen + oppgave-listen viser «Venter på: [gruppenavn]» når status ∈ {sent, received, in_progress}). Dokument-detaljsidene fikk samme badge 2026-05-05 — server utvidet med `recipientGroup`-include på `sjekkliste.hentMedId` + `oppgave.hentMedId`, klient viser badge ved siden av `<StatusBadge />` i header.

### ~~Auto-redirect ved innlogging — mangler (observert 2026-05-02)~~ — LØST

Verifisert 2026-05-05 at logikken er fullt implementert i `apps/web/src/app/dashbord/page.tsx:41-65` (auto-redirect basert på antall prosjekter) + skriving av `lastVisitedProjectId` i `apps/web/src/app/dashbord/[prosjektId]/layout.tsx:26`. Alle scenarier dekket: 0 prosjekter (admin → kom-i-gang, ikke-admin → tom-state), 1 prosjekt → direkte, 2+ → sist besøkte hvis i tilgjengelig liste, 2+ uten sist-besøkt → bli stående med oversikt. Sannsynligvis lagt til samtidig som auto-progress-arbeidet før denne sesjonen — ikke en mangel lenger.

## Kjente bugs

**~~Lokasjon-modal forhåndsvelger ikke når kun ett alternativ finnes (observert 2026-05-02)~~ — LØST.** Verifisert 2026-05-05 at auto-select er implementert i `apps/web/src/components/LokasjonVelger.tsx:66-81` (to useEffect-hooks: én for bygning, én for tegning, begge sjekker `length === 1` og setter valgt verdi). Sannsynligvis lagt til etter den opprinnelige observasjonen. TegningsModal (skjermbilder, ikke samme flyt) auto-velger kun ved `standardTegningId` — bevisst design.

## Planlagte faser

Detaljert plan: [arkitektur-syntese.md §5](arkitektur-syntese.md). Beslutningsgrunnlag: [fase-0-beslutninger.md](fase-0-beslutninger.md).

**Fase 0 — Firma-fundament + tilgangsinfrastruktur:**
- Datamodell (13 migrasjons-steg per § E i fase-0-beslutninger): `Activity`, `OrganizationSetting`, `OrganizationPartner`, `OrganizationTemplate`, `ProjectOrganization` (rename av OrganizationProject + `rolle`), `Project.primaryOrganizationId String?` (nullable), `ProjectModule`-utvidelse (`organizationId` + `status` per A.4/A.17), `Psi.organizationId` + `projectId` nullable + `kontekstType`, `BibliotekMal`-utvidelse (kategori/domene/kobletTilModul/verifisert), `ProjectMember.periodeSlutt` + `userId` cascade SetNull (per B.7), `ExternalCostObject`, `Godkjenning` + `DocumentTransfer.kostnadSnapshot/godkjenningId`, `User`-utvidelse (canLogin, HMS-kort, ansattnummer, nasjonalitet, arbeidstillatelse + composite unique på email + phone per B.7)
- Selektiv Timestamptz på 11 felter per B.6 (timer/audit/godkjenning/PsiSignatur/frist-felter/Invitation)
- Infrastruktur: `prosjektProcedure`, `modulProcedure(slug)` i tRPC
- Refaktor: 9 funksjoner i `tilgangskontroll.ts` for ProjectMember-periode

**Fase 0.5 — Byggeplass + Avdeling-fundament:**
- Tre åpne arkitektur-prinsipper besluttes (NULL-betydning, default-byggeplass, FK vs jsonb) per [byggeplass-strategi.md](byggeplass-strategi.md)
- `ByggeplassMedlemskap` (loan-pattern: User → Byggeplass over tid)
- Drop `building_ids` jsonb fra `project_groups`
- `Avdeling`-tabell i `packages/db` (kjernen) — firma-intern organisatorisk inndeling, separat dimensjon fra byggeplass
- `User.avdelingId` valgfri (ny kolonne)
- Avklaring av seed-mekanismer som registreres her vs i Fase 3

**Fase 1 — Maskin med modul-gateway** (allerede under bygging på `feature/maskin-db` — gates før prod):
- Refaktor maskin-rutene til `modulProcedure('maskin')`
- `EquipmentChecklist` + `EquipmentChecklistTemplate` i `db-maskin`
- Manuell trigger fra maskinregister

**Fase 2 — Mal-promotering:**
- `OrganizationTemplate` + `ReportTemplate.organizationTemplateId`
- UI for «Send til firmabibliotek»

**Fase 3 — Timer-modul** (inkl. Kompetanseregister):
- Lønnsarter, arbeidstidskalender, dagsseddel med byggeplassId fra dag 1
- Underprosjekt (Proadm-import eller SiteDoc Godkjenning)

**Fase 4 — Mannskap/PSI-modul.**

**Fase 5 — Varelager-modul.**

**Fase 6 — Avansert:** DO-kobling, AI-ukeplan.

**Fase 7 — Prosjekthotell-utvidelser (parallelt spor):** Møtemal, Månedsrapport, HMS-statistikk firma-nivå, Street View, auto-trigger maskin-sjekkliste fra service-varsel.

**TODO etter Maskin (Fase 1) + Timer (Fase 3):** [Aktivitetsfeed på dashboard](aktivitetsfeed.md) — bruker eksisterende Activity-tabell, polling via tRPC, konfigurerbar periode (default 10 dager) + hendelsestyper + GDPR-retensjon i OrganizationSetting. Ekstern partner-feed-scope krever egen designrunde.

**Commits på `feature/maskin-db`** venter på merge til develop:
- `a4d7771` — Proadm-detaljer i timer.md
- `89e102c` — Proadm-regel i CLAUDE.md
- DB-opprydning-relaterte audit/doc-commits (2026-04-25)
- Arkitektur-dokumentasjon (2026-04-25/26)


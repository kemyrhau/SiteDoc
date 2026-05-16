---
name: BACKLOG
description: Konsolidert backlog — alt planlagt men ikke ferdig, kategorisert. STATUS-AKTUELT.md eier kun aktivt arbeid (maks 3 PR).
sist_verifisert_mot_kode: 2026-05-16
---

# Backlog

All planlagt-men-ikke-startet eller deprioritert arbeid samles her, slik
at STATUS-AKTUELT.md kan holdes kort (kun aktive PRs). Nye oppgaver
plasseres i riktig kategori. Når en oppgave startes, flyttes den til
STATUS-AKTUELT.md § Pågående arbeid; ferdige PRs flyttes videre til
`historikk-YYYY-MM.md` etter prod-deploy.

Legenda: 🔴 ikke startet · 🟡 delvis · ⏸️ parkert · ❓ trenger avklaring.

## 1. Teknisk gjeld

### MASKIN-TIMER KOBLING — arkitektursvikt (høy prioritet)

Kenneth-avklaring 2026-05-16: Maskintimer er en del av arbeidsdagen,
ikke additivt. `sum(SheetMachine.timer) ≤ sum(SheetTimer.timer)` per sedel.

Nåværende feil: maskin og timer faktureres som to separate summer.
Korrekt: maskin er utstyrsbidrag av samme tidsperiode.

Krever:
1. Server-validering: `maskin.timer ≤ total worker.timer` ved opprett/oppdater
2. UI: vis maskin som underpost av timer-seksjonen, ikke separat
3. Attestering: `splittRad` på maskin bør validere mot timer-totalsum
4. Mobil: samme logikk

Tas i planleggingssesjon — ingen videre koding i mellomtiden.

### Datamodell og migrasjon

- **P-KRITISK-1 — Sentralbiblioteket ikke seedet i prod** 🔴 — se [oppryddings-plan-2026-04-28.md § P-KRITISK-1](oppryddings-plan-2026-04-28.md). Lovpålagt grunnpakke skal auto-seedes ved firma-opprettelse.
- **P-KRITISK-2 — `FtdChangeEvent` og `FtdTnotaChangeLink` mangler i prod** 🔴 — se [oppryddings-plan-2026-04-28.md § P-KRITISK-2](oppryddings-plan-2026-04-28.md).
- **P-KRITISK-3 — `BibliotekMal` mangler 4 fase-0-besluttede felt** 🔴 — `kategori`, `domene`, `kobletTilModul`, `verifisert`. Se [oppryddings-plan-2026-04-28.md § P-KRITISK-3](oppryddings-plan-2026-04-28.md).
- **DB-naming-audit alias-rydding** 🟡 — etter mobil-app-oppdatering kan alias-feltene fjernes. Se [db-naming-audit-2026-04-25.md](db-naming-audit-2026-04-25.md).
- **Cross-package svake FK orphan-deteksjon** 🔴 — `db-maskin` referer til `User.id` via String uten cascade. Backlog-oppgave per [arkitektur-syntese.md § 6.1](arkitektur-syntese.md).
- **Organization vs OrganizationPartner — strategi D (DB-cleanup, 6-8t)** 🔴 — skall-firmaer i test-DB. Strategi C `Organization.erKunde` implementert 2026-05-03. Audit per rad gjenstår.

### Refaktor og rydding

- **40 åpne P-oppgaver i [oppryddings-plan-2026-04-28.md](oppryddings-plan-2026-04-28.md)** 🟡 — P2 faggruppe-rename, P3 drift-detaljer, P4 Kenneth-drøftinger, P5 svakhet-reparering.
- **Firma-administrasjons-navigasjon strukturell rydding (~10-12t)** 🔴 — 3 lag: ~10 ruter trenger `organizationId` som input, ~10 sider må sende `useFirma().valgtFirma.id`, rename av «Firmainnstillinger» → «Prosjekteier». Ikke-blokkerende.
- **Header-koordinering: firma-bytte nullstiller ikke prosjekt** 🔴 — observert 2026-05-03. Kompleksitet lav-middels (~2-3t).
- **Nye integrasjonstester for `tilgangskontroll.ts`** 🔴 — etter O-5c er gammel test-fil slettet (16/22 broken). Integrasjonstester mot test-DB med OrganizationMember-fikstur er planlagt.
- **T7-2b3 audit-log payload utvidelse** 🔴 — før/etter-snapshots per rad i Activity-tabell.
- **Returnert→pending-reset ved `sendTilAttestering`** 🔴 — når arbeider sender returnert sedel på nytt, tilbakestilles ikke `attestertStatus` automatisk.

### Mobil og sync

- **Pre-eksisterende timerSync.ts baseline-feil (linje 308, 334)** 🟡 — `string | null` mot lokal `.notNull()`. Akseptert som baseline, ikke prioritert.

## 2. Halvferdige features

### 3D/IFC/georeferanse

Status og roadmap dokumentert i Claude-memory (`project_3d_status.md`,
`project_3d_roadmap.md`, `project_3d_viewers.md`). 3D/IFC tilhører
separat chat per `feedback_3d_annen_chat`.

- **3D Fase 1 — Web layout-level viewer-persistering** 🔴 — flytt `SammenslattIfcViewer` til prosjekt-layout, vis/skjul basert på rute. Eliminerer re-lasting ved 3D ↔ Tegninger-bytte.
- **3D Fase 2 — Mobil IFC-visning i React Native** 🔴 — WebView med web-vieweren er enklest. Offline-støtte via forhåndslast.
- **3D Fase 3 — Live site-view (AR/3D på byggeplass)** 🔴 — ARKit (iOS) / ARCore (Android). GPS + kompass for grov posisjonering, manuell justering for presisjon.
- **Test absolutt `treDTilTegning`** 🟡 — markør-offset-fixen kan ha løst hele problemet. Ikke testet etter fix.
- **Fjern 3D debug-logging** 🟡 — `tegningTil3D` og `treDTilTegning` logger til console når debug ferdig.
- **Fragment-caching verifisering** 🟡 — sjekk at 2. lasting er raskere.

### Tegning/PDF

- **Split-view pdf.js-migrering** 🔴 — PDF iframe-begrensninger i nåværende implementasjon. Planlagt migrering til pdf.js.

### Timer-relatert

- **Attestering edit-modus bugs (oppdaget 2026-05-16)** 🔴 — to bugs blokkerer prod-deploy av T7-2c-bunken + T7-2d:
  1. Fra-tid viser «0:» i stedet for korrekt tid (f.eks. 07:00). Sannsynlig tidsformat-initialiseringsfeil.
  2. Timer-endring fungerer ikke i edit-modus — input aksepterer ikke ny verdi eller verdien lagres ikke.
  Rootcause ukjent for begge — krever kartlegging neste sesjon i `RedigerTimerRad`/`RedigerMaskinRad` + `AttesteringDetalj_Edit`.
- **T7-3c geo-forslag-utvidelser** ❓ — historikk-baserte forslag (sist brukte prosjekt). Mye av geo-forslag-leveransen kom i T7-3b2. Egen sub-PR eller forkastes.
- **`OrganizationMemberPermission` (modul-tilgang per ansatt)** 🔴 — låst i [fase-0-beslutninger.md](fase-0-beslutninger.md). Designet klart, ikke startet.

### Onboarding og brukerveileder

- **Onboarding-veileder (forutsetning for A.Markussen)** 🟡 — Runde 1 (a)+(b)+(c) deployet til prod 2026-05-02. Resterende: full guidet flyt for ny bruker. Se [onboarding-veileder.md](onboarding-veileder.md).
- **Prosjektoppsett-veileder** 🟡 — steg-for-steg ny bruker etter prosjektopprettelse. Se [prosjektoppsett-veileder.md](prosjektoppsett-veileder.md).
- **Testbrukere i test-DB** 🔴 — Ola Tømrer (worker), Per Prosjektadmin, Kari Firmaadmin, Tore SiteDocAdmin. Planlagt etter Timer er ferdig.

### Søk og mobil

- **Adaptivt søk for sjekklister/oppgaver/HMS/RUH** 🔴 — krever kode-utforskning. Se [adaptiv-sok-plan.md](adaptiv-sok-plan.md).
- **Dokumentflyt mobil** 🔴 — finner ikke arbeidsforløp (bruker-basert vs entreprise-basert matching).
- **Oppgave-mobil rettighetsoppfølger** 🔴 — `apps/mobile/app/oppgave/[id].tsx` mangler `rettighetInput`, samme bug som sjekkliste-fix 2026-05-08.

## 3. Fremtidige faser

Detaljert plan: [arkitektur-syntese.md § 5](arkitektur-syntese.md).
Beslutningsgrunnlag: [fase-0-beslutninger.md](fase-0-beslutninger.md).
Aktiv Fase: 0 (firma-fundament) er i hovedsak ferdig — gjenstående §-E-steg dokumentert der.

### Fase 0.5 — Byggeplass + Avdeling-fundament

- To åpne arkitektur-prinsipper besluttes (default-byggeplass, FK vs jsonb) per [byggeplass-strategi.md](byggeplass-strategi.md). NULL = «hele prosjektet» allerede vedtatt (A.30).
- `ByggeplassMedlemskap` (loan-pattern: User → Byggeplass over tid)
- Drop `building_ids` jsonb fra `project_groups` — erstattes av m2m-koblingstabell
- `Avdeling`-tabell i `packages/db` (kjernen)
- `User.avdelingId` valgfri
- Forbered byggeplassId-felt på fremtidige Timer/Mannskap/Varelager-modeller

### Fase 1 — Maskin med modul-gateway (under bygging)

- Refaktor maskin-rutene til `modulProcedure('maskin')` — må gjøres før prod-deploy
- `EquipmentChecklist` + `EquipmentChecklistTemplate` i `db-maskin`
- UI for maskin-sjekkliste på maskin-detalj-side
- Manuell trigger fra maskinregister (auto-trigger fra service-varsel utsettes til Fase 7)

### Fase 2 — Mal-promotering

- `OrganizationTemplate` + `ReportTemplate.organizationTemplateId`
- UI for «Send til firmabibliotek»
- «Start fra firma-mal»-valg ved opprettelse

### Fase 3 — Timer-modul (inkluderer Kompetanseregister)

- Lønnsarter, arbeidstidskalender (delvis startet via T9-bunken), dagsseddel med byggeplassId fra dag 1
- Underprosjekt (Proadm-import eller SiteDoc Godkjenning)
- Steg 4c — Godkjenning UI (parkert 2026-05-03, venter på A.Markussen-input / ProAdm API)

### Fase 4 — PSI-utvidelse + mannskaps-vy

- Innsjekk/utsjekk-mekanikk
- Mannskaps-vy aggregerer PSI-tilstedeværelses-data per byggeplass
- §15-liste-eksport, HMS-kort-validering, geofence-innsjekk
- `eksternSystem`-felt på Psi
- 12t auto-utsjekk
- **HMS-tilgang for arbeidsgiver på andres prosjekter (juridisk gap A.27)** — løses her per [fase-0-beslutninger.md](fase-0-beslutninger.md).

### Fase 5 — Varelager-modul

- Goods, GoodsCategory, GoodsLocation
- Vareforbruk på dagsseddel (kobler til Timer-modul)
- Saldo-håndtering
- Strekkode-skanning (mobil)

### Fase 6 — Avansert

- DO-kobling (Kompetanse ↔ Equipment-validering)
- AI-ukeplan (Timer + Mannskap + Maskin)
- Strekkode-skanning utvidelser

### Fase 7 — Prosjekthotell-utvidelser (parallelt spor)

- Møtemal (ny dokumenttype)
- Månedsrapport (auto-aggregering)
- HMS-statistikk på firma-nivå
- Street View for byggeplass (eget prosjekt)
- Auto-trigger maskin-sjekkliste fra service-varsel (forutsetter Varsling-modul)

### Etter Fase 1 + Fase 3

- **Aktivitetsfeed på dashboard** — bruker eksisterende Activity-tabell, polling via tRPC, konfigurerbar periode (default 10 dager) + hendelsestyper + GDPR-retensjon i `OrganizationSetting`. Ekstern partner-feed-scope krever egen designrunde. Se [aktivitetsfeed.md](aktivitetsfeed.md).

### Tverrgående

- **Superadmin-oversikt over firma-moduler** 🔴 — fakturerings-orientert. Egen feature-sesjon.
- **Import-modul (HR-data)** 🔴 — datainfrastruktur, mater Timer med ansattnummer, hmsKortNr osv.
- **AI-integrasjon** 🔴 — Copilot plugin, MCP server, innebygd assistent. Se [ai-integrasjon.md](ai-integrasjon.md).
- **Fremdriftsplanlegger** 🔴 — ressursplanlegging, kompetanse, bemanning, forslag-motor. Etter timer+maskin+HR. Se [planlegger.md](planlegger.md).
- **AI-drevet ukeplan** 🔴 — utvidelse av planlegger Fase 4.
- **Dokumentsøk + OCR plan** 🟡 — OCR-fallback, dokumentasjon per post (splitting).
- **NS 3420 kontrollmaler** 🔴 — auto-genererte sjekklistemaler fra NS 3420 via OCR/søkemotor.
- **Cross-prosjekt-deling** ❓ — UE med eget prosjekt deler sjekklister til hovedentreprenør. Flere tilnærminger drøftes.

## 4. Kundeønsker ikke startet (A.Markussen)

Liste mottatt 2026-05-06. Se også [STATUS-AKTUELT.md § Kundeønsker](STATUS-AKTUELT.md).

- **#1 Sjekkliste for service koblet til timetall og status** 🟡 — DB-feltet `nesteServiceTimer` finnes i `packages/db-maskin/prisma/schema.prisma:188`. Mangler UI på maskin-detaljside + serviceintervall-konfigurasjon + sjekkliste med automatisk oppdatering.
- **#5 Registrering av HMS-gruppe på brukere** ⏸️ — parkert.
- **#7 Rettighetsmatrise med rolle-styring (Prosjektleder + Bas)** 🔴 — ny rolle-modell + matrise-UI. Eksisterende roller dekker ikke `Prosjektleder`/`Bas` som DB-roller.
- **#9 Justeringer på SJA (signatur/lesetilgang/deltaker)** 🔴 — utvidet sjekkliste-mekanikk: re-signaturforespørsel, auto-lesetilgang for prosjektmedlemmer, selv-påmelding som deltaker.
- **#10 «Flere personer»-feltet på SJA — definere hvem som er valgbare** 🔴 — felt-konfigurasjon for å begrense valgbare personer per SJA-mal.
- **#11 Pushvarsel/SMS til ansattliste** 🔴 — ny varslingstjeneste (SMS-leverandør-integrasjon), målgruppe-velger, kostnadsavklaring.

## Vedlikehold

Når en oppgave startes: flytt linje til [STATUS-AKTUELT.md § Pågående
arbeid](STATUS-AKTUELT.md). Når oppgaven er prod-deployet: flytt videre
til `historikk-YYYY-MM.md`. Se også [DOC-MAP.md](DOC-MAP.md) og
[CLAUDE.md § Dokumentasjons-regler](../../CLAUDE.md).

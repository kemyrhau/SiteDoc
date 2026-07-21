---
name: redesign-masterplan
status: 🟢 STYRENDE — fabels hoveddokument. Levende; oppdateres ved hver større endring
eier: fabel (innhold + rekkefølge) · cowork (kode-gate + statusavstemming) · Kenneth (vedtak)
sist_verifisert_mot_kode: 2026-07-21
---

# REDESIGN-MASTERPLAN — SiteDoc (fabel, opprettet 2026-07-12)

> Styringsdokument for hele redesignet. Arbeidsmåte: helhetlig plan her → kodeverifisert nå-rapport per del → detaljert delplan → utførelse (DoD i FABEL-RAMMEVERK.md). Status per sak lever i verifiseringsloggene — denne filen peker, kopierer aldri.

## ⚠️ Hvor filene faktisk ligger (cowork 2026-07-21)

Masterplanen refererer stier fra **to ulike steder**. Denne tabellen er kartet — uten den jakter man filer som ikke finnes i repoet.

| Referanse i planen | Faktisk plassering | Tilgjengelig for |
|---|---|---|
| `delplaner/*.md` | **Repo:** `docs/claude/delplaner/` | alle |
| `STATUS-AKTUELT (repo)` | **Repo:** `docs/claude/STATUS-AKTUELT.md` | alle |
| `verifisering/*-verifiseringslogg.md` | **Kun fabels designprosjekt** — ikke i repoet | fabel |
| `*.dc.html` (beslutningskart/mockup) | **Delvis:** `docs/redesign/` har noen; nyere ligger i designprosjektet | varierer — sjekk før relay |
| `design_handoff_navigasjon_redesign/K-BESLUTNINGER.md` | **Repo:** `docs/redesign/K-BESLUTNINGER.md` *(stien i planen er utdatert)* | alle |
| `FABEL-RAMMEVERK.md` | Fabels designprosjekt | fabel |

**Konsekvens for relay:** en Opus som får en ordre som viser til en `verifisering/`-logg eller en `.dc.html`, **kan ikke lese den**. Kenneth må relaye innholdet. Cowork flagger dette i hver ordre der det gjelder.

## Målestokk

Alle deler måles mot de tre hensiktene (enkelhet / selvforklarende navigasjon / timeføring med få klikk) + pilotfrist ~sept 2026 (50 ansatte, mobil viktigst).

## Del-oversikt

| # | Del | Status | Kilde/logg |
|---|-----|--------|------------|
| 1 | Navigasjon + innstillinger-hub (steg ii–vii + restanse) | ✅ Lukket, i prod bak flagg | STATUS-AKTUELT (repo) |
| 2 | K13 søkedekning | ✅ Lukket | `verifisering/K13-verifiseringslogg.md` |
| 3 | Generalprøve-funn F1–F5 | ✅ LUKKET 2026-07-12 — allerede-landet på develop, designgodkjent; ingen merge (stale serie) | `verifisering/F1-F5-verifiseringslogg.md` |
| 4 | Kunderunde (steg viii) | ⏸ UTSATT (Kenneth 2026-07-12, moderert): gjennomføres senere; spørsmålene er gode men skal forbedres/tilpasses først. Gjentest steg 2–6 som gate utgår | `docs/redesign/steg-viii-kunderunde.md` (repo) |
| 5 | Runde 3: slank sidebar + kollapsbare soner + amber=FIRMA | ✅ D3–D2 LUKKET 2026-07-12 — live på test, fabel-designgodkjent. Gjenstår: D5 konto-lagring (cowork DDL-gate) | `verifisering/del5-sidebar-verifiseringslogg.md` |
| G | Geofence timer+PSI (ny sak 2026-07-15) | Vedtatt: (1) per-rad GPS-indikator på byggeplasser — **BYGGET + fabel-designgatet 2026-07-15** (redesign f1a5318d, 🔴 LIVE ikke bak flagg — Kenneth-vedtatt); (2) ÉN geofence dekker timer OG PSI (aldri to koordinatfelt). **PARKERT til egen redesign-sesjon:** PSI-håndhevingsnivå (Av/C/B/A, firma-policy, server-autoritativ, fail-open offline/uten-geofence) — grunnlagsdok `docs/claude/psi-geofence-handhevning-utredning.md` (repo, 6af205a8). Sesjonens scope (Kenneth): prosjekt- vs firma-innstillinger helhetlig. Beslutningskart: `Geofence Beslutning.dc.html` | — |
| F | Finnbarhets-revisjon (Kenneth-funn 2026-07-14) | **LUKKET 2026-07-15** — søkemotor (skrivefeil-toleranse + synonymlag, 14/14 test), begreps-fikser, NATIVE sidemeny på hub, georeferanse+Dokumentflyt-søkeord. Kenneths brukertest GRØNN. Sidebar falsk-aktiv-fiks (`7f75c654`) | STATUS-AKTUELT (repo) |
| 6 | Timeføring (web + mobil) | **DoD LUKKET 2026-07-13** (design-sign-off F-g/F-b; forseglet develop `cd3efcb5`). Egne saker etter DoD: F-e-interaktiv, P4a, prod-deploy spor b | `verifisering/del6-timeforing-verifiseringslogg.md` |
| 6b | Sjekklister/Oppgaver/HMS/Kontrollplan | **Fase 1 LUKKET 2026-07-16**, deployet prod 2026-07-20. Delplan `delplaner/del6b-delplan.md` (4 faser + fase M) | `verifisering/del6b-verifiseringslogg.md` |
| 7 | Seddel-statusfarger (avvist per rad, mobil↔web-konsistens, «Konflikt»-tilstand) | Fase C-funn mottatt fra cowork; designes ETTER F4-reconciliation | README § K12/K13-koordinering |
| 8 | Dokumentflyt-redesign (begreper, medlemsliste, per-person-rettigheter) | Eget tema — krever dyp nå-rapport først | README § To nøkkelkomponenter |
| 9 | Modul-oppsettswizard (generalisering av timer-onboarding) | Prinsipper vedtatt, fremtidig spor | README § Designprinsipp: wizard |
| 10 | K11 admin-redesign (abonnement/drill-down, Fakturering F20) | Egen fase ETTER kunderettet nav | K-BESLUTNINGER K11 |
| K14 | Søk-utvidelse: admin-flater i søkeregisteret + alias/synonymer per treff | KØ (Kenneth 2026-07-13: ingen hast) — tas med del 10/K11 | — |
| G2 | Georeferanse-panel v2 + tillegg A | ✅ **LUKKET 2026-07-15** — `e91f10c4` i prod, Kenneth-verifisert | `verifisering/georef-panel-verifiseringslogg.md` |
| N3 | Dokumentflyt-synlighet datamodell | ✅ **LUKKET 2026-07-20** — del 1+2 merget, **deployet prod 2026-07-20**. Tre utrutede saker er nå alle lukket eller vedtatt: G1-mutere → sak 1 ✅ · opprett→usynlig → sak 2 ✅ · HMS-synlighet-regel → åpen sak | `verifisering/N3-verifiseringslogg.md` |
| A-3b | Perspektiv-avhengige statusetiketter | **AKTIV** — Fase A lukket (fabel-designgate 2026-07-20), Fase B pågår | `delplaner/A3b-ordre.md` + `a3b-perspektiv-tabell.md` |
| P1 | Nivåsignal firma vs. prosjekt (prod-funn 2026-07-21) | Vedtatt 2026-07-21 (1c + klikkbar chip-snarvei, K5 bevart). **Ordre i repo:** `delplaner/p1-nivasignal-ordre.md`. Ledd 1 (nå-rapport) klar for relay | `verifisering/p1-nivasignal-verifiseringslogg.md` (opprettes) |
| P2 | Inndata-validering status-handlinger (prod-funn 2026-07-21) | Kenneth-vedtatt 2026-07-21 (`delplaner/p2-inndata-validering-vedtak.md`); ordre skrives etter A-3b (cowork-sekvensert) | — |
| K15 | Vedlegg på tillegg-registrering (foto/skann/opplasting) | Ny sak (Kenneth 2026-07-13); krever nå-sjekk: finnes gjenbrukbar opplastings-infra i dagsseddel-domenet? Prioritet ikke satt | — |

## Flate-inventar — alle websider, gruppert

> Nav-redesignet (del 1–2) ga alle sider ny **inngang** (hub/søk/sidebar). Selve **sidene** er i hovedsak uredesignet — dette inventaret styrer rekkefølgen på side-redesignet.

| Gruppe | Flater | Side-status | Del |
|---|---|---|---|
| Timer arbeidsflater | registrering, dagsseddel, attestering, Mine timer, timer-rapport (web + mobil) | Urørt; Fase C-funn påpeker svakheter | **6+7** |
| Innstillinger/oppsett | hub + 14 oppsett- og 10 firma-sider bak hub-kortene | Inngang ny (hub); sidene selv urørte | etter 6 |
| Dokumentflyt-klyngen | dokumentflyt-konfig, faggrupper, kontakter, mapper/mappeoppsett | Kontakter ny (K6); resten urørt | **8** |
| Dokumenter/oversettelse | mapper-tabell, oversettelsespanel, dokumentleser | Redesignet (2b/2c) ✅ | 1 |
| Sjekklister/Oppgaver/HMS | lister, utfylling, maler, kontrollplan | Fase 1 gjort; resten urørt | **6b** |
| Tegninger/3D | tegninger, 3d-visning, tegning-3d, punktskyer | Mobil-tab redesignet (2a); web-konsolidering venter K4 | K4 |
| Maskin/Varelager | register, vedlikehold, import | Urørt | wizard-sporet (9) |
| Firma-flater | oversikt, prosjekter, ansatte, kompetanse, HMS-dashbord, kalender | Urørt (kun ny sidebar-sone) | runde 3 (5) |
| PSI/Mannskap | psi, mannskap, psi-maler | Bygges av develop-sporet — redesignet eier kun nav-plassering | — |
| Admin (sitedoc_admin) | firmaer, prosjekter, tillatelser, testsider | Urørt, ut av scope | **10** (K11) |

Restanser fra anker-dokumentet som IKKE er tatt (sjekkes mot kode før de køes): rename Firmainnstillinger→Prosjekteier · Box→Mapper-rename · HMS-avvik modul-avklaring · Maskin-plassering · testsider ut av prod.

## Rekkefølge

1. **Del 5 runde 3 sidebar** — kollapsbare soner + tre-trinns minimering + amber=FIRMA
2. **Del 6 timeføring (web + mobil)** — nå-rapport først. Omfang: smårusk, ikke omlegging
3. **Del 6b Sjekklister/Oppgaver/HMS** — rett etter timer (Kenneth-vedtak 2026-07-12)
4. **Del 7 seddel-statusfarger** — etter F4-reconciliation
5. **Del 8 dokumentflyt** — egen dyp sesjon
6. **Del 9, 10** — deretter

## Aktiv kø (cowork-sekvensert 2026-07-21)

**Bindingen er `generate.ts`, ikke sidene.** A-3b Fase B eier i18n-generatoren + `packages/ui/src/status-badge.tsx`. Per [parallell-arbeid-lock.md](../claude/parallell-arbeid-lock.md) regel 9 kan ingen annen økt kjøre generatoren samtidig.

| Rekkefølge | Sak | Begrunnelse |
|---|---|---|
| Nå | **A-3b Fase B** | Eier generatoren + status-badge |
| Nå (parallelt) | **P1 ledd 1** — nå-rapport | Ren måling, null kode, null i18n |
| Etter A-3b | **P2** inndata-validering | Overlapper A-3b Del 2s handlingsmeny-flater |
| Etter A-3b | **P1 ledd 2** — koding | Trenger generatoren fri |

## Åpne saker fra tilgangs-sløyfen (cowork, ikke redesign)

`sak1b-mutasjoner-rollestyring.md` · `lesekvittering.md` (venter Kenneth-beslutning) · `hms-synlighet-regel.md` · `deploy-separasjon.md` · `lint-typecheck-gjeld.md`

## Vedtak som binder designet

- **Amber = FIRMA** (inkl. Maskin, Kompetanse, Ansatte), **blå = PROSJEKT** — låst, kodet i del 5, og videreført i P1s chip-grammatikk
- **Sidebar = arbeidsflater, konfig = hub-kort (K5)** — P1s chip er snarvei, ikke ny strukturkilde
- K-beslutninger: [K-BESLUTNINGER.md](K-BESLUTNINGER.md)
- **Statusfarge-grammatikk (A-3b, fabel-gatet 2026-07-20):** `warning`/amber = din tur · `primary`/blå = underveis, ballen hos andre · `success` = fullført positivt

---

## Cowork-avstemming 2026-07-21 — hva som var utdatert

Ført her fremfor å redigere fabels tabell stille, slik at endringene er sporbare:

| Påstand i planen | Faktisk | Rettet i tabellen |
|---|---|---|
| N3 «ikke prod-deployet» | Deployet prod 2026-07-20 | ✅ |
| N3s tre utrutede saker «rutet til fabel» | To av tre er bygget og verifisert (sak 1, sak 2); kun HMS-synlighet-regel er åpen | ✅ |
| Del 6b fase 1 «delplan vedtatt» | Fase 1 lukket 2026-07-16, deployet prod 2026-07-20 | ✅ |
| A-3b manglet helt fra del-oversikten | Aktiv sak siden 2026-07-18 | ✅ lagt til |
| `design_handoff_navigasjon_redesign/K-BESLUTNINGER.md` | Ligger i `docs/redesign/K-BESLUTNINGER.md` | ✅ |
| «Neste konkrete steg» (2026-07-15) | Alle seks punkter er utført eller overtatt av nyere kø | ✅ erstattet av § Aktiv kø |

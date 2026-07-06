---
name: redesign-paritetssjekkliste
description: Funksjonsparitets-sjekkliste for navigasjons-/innstillingsredesign (redesign/navigasjon). Akseptkriterium = ingen funksjon mistes. Hver rad krysses av under feature-flagg-testing (nyNavigasjon).
status: aktiv
sist_verifisert_mot_kode: 2026-07-05
---

# Paritetssjekkliste — navigasjons- og innstillingsredesign

**Formål:** Akseptkriteriet for redesignet er funksjonsparitet — *alle* funksjoner i
dagens UI skal ivaretas. Denne lista er selve akseptkriteriet. Hver rad: dagens funksjon
→ ny inngang → verifisert gammel-vs-ny via `nyNavigasjon`-flagget.

**Kilder:** `navigasjon-arkitektur-analyse-2026-05-03.md` (🟢 ANKER, tiltak-tabell A–E),
`ux-arkitektur-agenda.md`, `admin-navigasjon-analyse-2026-05-03.md`,
`domene-arbeidsflyt.md` (🟢 STYRENDE) — **verifisert mot faktiske ruter i
`apps/web/src/app/` og `apps/mobile/app/` per 2026-07-05** (anker-dokumentene er fra
2026-05-03; se § Kode-diff-noter for ruter som er kommet til etterpå).

**K-beslutninger innarbeidet (Kenneth via K-BESLUTNINGER.md, 2026-07-05):** K1/K2/K4/K5/K6/K10
**vedtatt** og inn i lista under · K3/K7/K8/K11 **utsatt** (utenfor redesign-scope, blokkerer
ikke plassering) · K9 **avventer rapport** (eneste gjenstående plasserings-blokker). Se
§ Beslutninger for detalj.

**Legende — «Ny inngang»:**
`1a` = Innstillinger-hub-kort · `sidebar-P` = ny sidebar PROSJEKT-sone ·
`sidebar-F` = ny sidebar FIRMA-sone · `søk` = globalt Ctrl+K-søketreff ·
`chip` = kontekst-chip (firma/prosjekt-velger) · `2a` = mobil-tab (v2) ·
`2b` = oversettelsespanel · `2c` = mobil dokumentleser.

**Kolonner:** Funksjon · Dagens inngang · Ny inngang · Gating som må overleve ·
Redirect? · Verifisert (tom — fylles under flagg-test).

---

## ⚠️ Kode-diff-noter (punkt 4+6 fra klarsignal — det viktigste)

Ruter/funksjoner som finnes i kode men IKKE i 2026-05-03-ankeret. Disse kan lett mistes
i et redesign som bare leser ankeret:

| Rute/funksjon | Status | Merknad |
|---|---|---|
| `/dashbord/[prosjektId]/mannskap` | PSI Fase A, develop 2026-07-05 | §15-innsjekk/utsjekk-vy, gated `kreverModul="psi"`. **Re-homes av redesign** (se PSI-rad). |
| `/dashbord/[prosjektId]/vareforbruk` | Live | Varelager prosjektmodul, gated `kreverFirmaModul="varelager"` (via ProjectModule). |
| `/dashbord/[prosjektId]/dokumentleser` + `/dokumenter/[dokumentId]/les` | Live | Reader View (blokkbasert, språkvelger, sammenlign-panel) → mobil-parallell = 2c. |
| `/dashbord/[prosjektId]/modeller` · `/punktskyer` | Live | 3D/punktsky-ruter — **ikke i HovedSidebar**, nås kontekstuelt. Del av 3D-konsolidering (åpen beslutning K4). |
| `/dashbord/firma/hms` | Deployet 2026-05-29 (`526db462`) | Firma-HMS-dashbord, gated `kreverHmsTilgang`. Ankeret hadde den som «MANGLER». |
| `/dashbord/firma/kalender` | Live | Ikke i ankeret. |
| `/dashbord/firma/oppmotesteder` | Live | Ikke i ankeret. |
| `/dashbord/firma/ansatte` | Live | Ankeret kalte den `/dashbord/firma/brukere` — **faktisk rute er `ansatte`** (terminologi-avvik, se K10). |
| `/dashbord/firma/moduler` | Live | Firmamodul-toggle (aktiveFirmamoduler). Ikke i ankeret. |
| `/dashbord/firma/timer/rapport` · `/attestering` · `/attestering/[id]` | develop (U1/U2 2026-05-07) | Leder-timer-rapport + firma-attestering. |
| `/dashbord/firma/varelager` · `/import` | Live | Ankeret hadde varelager som «MANGLER (Fase 5)». |
| `/dashbord/firma/innstillinger/integrasjoner` · `/dashbord/admin/integrasjoner` | Live | Integrasjons-sider (Proadm/SmartDok m.m.). |
| `/dashbord/kom-i-gang` | Live | Onboarding/kom-i-gang-side. |
| `/dashbord/prosjekter/[id]/*` (maler, oppgaver, sjekklister) | Live | **Parallelt prosjekt-rutetre** ved siden av `/dashbord/[prosjektId]/*`. Mulig duplikat/legacy — se K9. |
| `/dashbord/timer/mine` · `/ny` · `/[id]` | Live | Global «Mine timer»-arbeidsflate (utenfor prosjekt-kontekst). Plassering åpen (K2). |
| `/psi/[prosjektId]` (web) · `apps/mobile/app/psi/[psiId]` | Live | Offentlig/QR-PSI-utfylling — utenfor sidebar-nav, må ikke mistes. |
| `apps/mobile/app/live-view.tsx` | Live | Mobil live-view (AR/kamera-relatert) — ikke nevnt i 2a-designspec. Må ikke mistes (K4). |

---

## Seksjon P — Prosjektmoduler (ny sidebar PROSJEKT-sone / 1a PROSJEKT-hub)

| # | Funksjon | Dagens inngang | Ny inngang | Gating som må overleve | Redirect? | Verifisert |
|---|---|---|---|---|---|---|
| P1 | Dashbord (prosjekt) | sidebar `dashbord` / `/dashbord/[pid]` | sidebar-P | `kreverProsjekt=false` | Nei | |
| P2 | Sjekklister (liste) | sidebar / `/[pid]/sjekklister` | sidebar-P + søk | `kreverGruppemodul="sjekklister"` (admin/registrator-bypass) | Nei | |
| P3 | Sjekkliste-detalj + utfylling | `/[pid]/sjekklister/[id]` | (fra P2) | samme som P2 | Nei | |
| P4 | Sjekkliste skriv-ut / `utskrift/sjekkliste/[id]` | knapp i P3 | (bevares) | samme | Nei | |
| P5 | Oppgaver (liste) | sidebar / `/[pid]/oppgaver` | sidebar-P + søk | `kreverGruppemodul="oppgaver"` | Nei | |
| P6 | Oppgave-detalj + `utskrift/oppgave/[id]` | `/[pid]/oppgaver/[id]` | (fra P5) | samme | Nei | |
| P7 | HMS-avvik (RUH/SJA) | sidebar `hms` / `/[pid]/hms` | sidebar-P + søk | `kreverModul="hms-avvik"` | Nei | |
| P8 | Tegninger (2D-liste/visning) | sidebar / `/[pid]/tegninger` | sidebar-P + 2a Tegninger-tab | `kreverGruppemodul="tegninger"` | Nei | |
| P9 | 3D-visning (IFC/punktsky) | sidebar `3d-visning` | **K4: «Tegninger» → toggle 3D** (nav-konsolidert) | `kreverIfc` + `kreverGruppemodul="3d"` | Nei | |
| P10 | Tegning+3D (split) | sidebar `tegning-3d` | **K4: «Tegninger» → toggle 2D+3D** | `kreverIfc` | Nei | |
| P11 | Modeller (IFC-modell-liste) | `/[pid]/modeller` (ikke i sidebar) | **K4: underinngang under «Tegninger»** | (avled fra tegning-fileType) | Nei | |
| P12 | Punktskyer | `/[pid]/punktskyer` (ikke i sidebar) | **K4: underinngang under «Tegninger»** | — | Nei | |
| P13 | Bilder | sidebar / `/[pid]/bilder` | sidebar-P | `kreverProsjekt` | Nei | |
| P14 | Mapper — dokumentliste | sidebar `mapper` / `/[pid]/mapper` | sidebar-P + 2a Dokumenter-tab | `kreverProsjekt` | Nei | |
| P15 | Mapper — embedding/AI-status per dok | i mapper-tabell | (bevares i 2b-tabell) | `kreverProsjekt` | Nei | |
| P16 | Mapper — oversettelsesstatus per dok | i mapper-tabell (chips) | 2b oversettelsespanel + statuskolonne | `kreverProsjekt` | Nei | |
| P17 | Mapper — språkavvik-bekreft (`bekreftSpraakMut`) | 3-valgs varsel i dok-liste | 2b: ett-klikk «Bekreft» + «Behold» | `kreverProsjekt` | Nei | |
| P18 | Mapper — «Les»-knapp → Reader | knapp per rad | 2b «Les» → 2c mobil | `kreverProsjekt` | Nei | |
| P19 | Dokumentleser (Reader View + språkvelger + sammenlign) | `/[pid]/dokumentleser`, `/dokumenter/[id]/les` | 2c (mobil) / bevares (web) | `kreverProsjekt` | Nei | |
| P20 | Kontrollplan | sidebar / `/[pid]/kontrollplan` | sidebar-P + søk | `kreverModul="kontrollplan"` | Nei | |
| P21 | Økonomi (kontrakt/nota/avvik/dokumentsøk) | sidebar / `/[pid]/okonomi` | sidebar-P + søk | `kreverModul="okonomi"` | Nei | |
| P22 | Dokumentsøk (AI hybrid) | sidebar `sok` / `/[pid]/sok` | sidebar-P + søk | `kreverProsjekt` | Nei | |
| P23 | PSI (personlig gjennomføring / utfylling) | sidebar `psi` / `/[pid]/psi` | sidebar-P | `kreverModul="psi"` | Nei | |
| P24 | Mannskap (§15-innsjekk/utsjekk-vy) | sidebar `mannskap` / `/[pid]/mannskap` | **sidebar-P (redesign re-homes)** | `kreverModul="psi"` | Nei | |
| P25 | Timer (dagsseddel, registrering) | sidebar `timer` / `/[pid]/timer`(+`/ny`,`/[id]`) | sidebar-P | `kreverFirmaModul="timer"` (via ProjectModule på prosjekt) | Nei | |
| P26 | Timer-attestering (leder) | sidebar `timer-attestering` / `/[pid]/timer/attestering`(+`/[id]`) | sidebar-P | `kreverFirmaModul="timer"` + `kreverTimerLeder` (kanAttestere) | Nei | |
| P27 | Timer-godkjenning (legacy alias) | `/[pid]/timer/godkjenning` | redirect → attestering | (behold ≥1 uke, slett etter mobil-oppdatering) | **Ja** | |
| P28 | Vareforbruk | sidebar `vareforbruk` / `/[pid]/vareforbruk` | sidebar-P | `kreverFirmaModul="varelager"` (via ProjectModule) | Nei | |
| P29 | Maler (bibliotekvalg for prosjekt) | `/[pid]/maler`(+`/[malId]`); mobilmeny «maler» | 1a PROSJEKT «Maler» + søk | `kreverProsjekt` | Nei | |
| P30 | Faggrupper (liste/CRUD, alltid-på) | `/[pid]/faggrupper` | 1a PROSJEKT «Medlemmer › Faggrupper» | `kreverProsjekt` | Nei | |
| P31 | **Kontakter (NY lesevisning, K6-splitt)** — prosjektkontakter: faggrupper + folk m/ tlf/e-post, klikk-for-å-ringe på mobil | — (ny; data = samme query som dokumentflyt-siden) | **sidebar-P** (bygget: `/dashbord/[prosjektId]/kontakter`, read-only, gruppert per faggruppe, tel:/mailto:, søk) + søk + mobil Mer-tab | `kreverProsjekt` | Nei | |

## Seksjon O — Prosjekt-oppsett (`/dashbord/oppsett/*`) → 1a PROSJEKT-hub

| # | Funksjon | Dagens inngang | Ny inngang | Gating som må overleve | Redirect? | Verifisert |
|---|---|---|---|---|---|---|
| O1 | Prosjektmedlemmer (ProjectMember) | oppsett-sidebar `brukere` / `/oppsett/brukere` | 1a «Medlemmer › Medlemmer» | `kreverProsjekt` | **Ja** (fra `/oppsett/brukere`) | |
| O2 | Lokasjoner / Byggeplasser (CRUD, geofence) | oppsett-sidebar / `/oppsett/byggeplasser` | 1a «Prosjektoppsett › Byggeplasser» | `kreverProsjekt` | **Ja** | |
| O3 | Produksjon (parent-node) | oppsett-sidebar `produksjon` | 1a «Maler»/«Dokumentflyt»-kort | `tillatelse="manage_field"` + `kreverProsjekt` | — | |
| O4 | Dokumentflyt-konfig | `/oppsett/produksjon/dokumentflyt` | 1a «Dokumentflyt › Dokumentflyt» | `manage_field` | **Ja** | |
| O5 | Kontakter-ruten (flyt-parter) — **K6: rename alt gjort, nå redirect** til `…/dokumentflyt` | `/oppsett/produksjon/kontakter` | redirect → O4 (flyt-konfig forblir innstilling); personkatalog-visningen flyttet til P31 | `manage_field` | **Ja** (allerede) | |
| O6 | Oppgavemaler (+`/[id]`) | `/oppsett/produksjon/oppgavemaler` | 1a «Maler › Oppgavemaler» | `manage_field` | **Ja** | |
| O7 | Sjekklistemaler (+`/[id]`) | `/oppsett/produksjon/sjekklistemaler` | 1a «Maler › Sjekklistemaler» | `manage_field` | **Ja** | |
| O8 | Modul av/på (ProjectModule-toggle) | `/oppsett/produksjon/moduler` | 1a «Moduler» | `manage_field` | **Ja** | |
| O9 | Mappeoppsett («Box») | `/oppsett/produksjon/box` | **1a «Prosjektoppsett › Mappeoppsett»** (bygget) | `manage_field` (sublink-gated) | **Ja** (rename box→mapper, tiltak 4) | |
| O10 | PSI-mal-oppsett | `/oppsett/produksjon/psi` (skjult hvis PSI av) | **1a «Maler › PSI-mal»** (bygget) | `manage_field` + PSI-modul aktiv (`modul.hentForProsjekt`) | **Ja** | |
| O11 | AI-søk-config | oppsett-sidebar `ai-sok` / `/oppsett/ai-sok` | 1a «Søk og AI › AI-søk» | `kreverProsjekt` | **Ja** | |
| O12 | Prosjekteier / «Firmainnstillinger» (read-only) | `/oppsett/firma` (Prosjekteier-barn) | 1a «Prosjektoppsett › Eier-firma» (lenke til firma) | `harFirmaTilgang` | **Ja** | |
| O13 | Generelle prosjekt-innstillinger | `/oppsett/prosjektoppsett` | 1a «Prosjektoppsett › Generelt» | — | **Ja** | |

## Seksjon F — Firma-administrasjon (`/dashbord/firma/*`) → 1a FIRMA-hub / sidebar-F

Hele firma-sidebaren gates på `kanAdministrereFirma && valgtFirma` (company_admin / sitedoc_admin).

| # | Funksjon | Dagens inngang | Ny inngang | Gating som må overleve | Redirect? | Verifisert |
|---|---|---|---|---|---|---|
| F1 | Firma-oversikt | firma-sidebar `Oversikt` / `/firma` | 1a FIRMA-header | company_admin/sitedoc_admin | Nei | |
| F2 | Prosjekter (firmaets liste) | firma-sidebar / `/firma/prosjekter` | 1a «Firmaprofil»/chip-liste | do. | Nei | |
| F3 | Ansatte (firma-brukere) | firma-sidebar / `/firma/ansatte` | 1a «Ansatte og roller › Ansatte» (K10 — ikke hardkod «ansatt = bruker») | do. | Nei | |
| F4 | Avdelinger | firma-sidebar / `/firma/avdelinger` | 1a «Ansatte og roller › Avdelinger» | do. | Nei | |
| F5 | Oppmøtesteder | firma-sidebar / `/firma/oppmotesteder` | 1a «Prosjektoppsett»-nær / FIRMA | do. | Nei | |
| F6 | Kompetanse (matrise) | firma-sidebar / `/firma/kompetanse` | 1a «Kompetanse › Matrise» | do. | Nei | |
| F7 | Kompetanse-import | i kompetanse-siden | 1a «Kompetanse › Import» | do. | Nei | |
| F8 | Firma-HMS-dashbord | firma-sidebar `HMS` / `/firma/hms` | 1a «HMS › Dashbord» | `kreverHmsTilgang` (harHmsTilgang / `hms_ansvarlig`) | Nei | |
| F9 | HMS-varsling | (del av HMS) | 1a «HMS › Varsling» | do. | Nei | |
| F10 | Firma-moduler (aktiveFirmamoduler-toggle) | firma-sidebar `Moduler` / `/firma/moduler` | 1a «Moduler (firma)» | company_admin/sitedoc_admin | Nei | |
| F11 | Timer-katalog: Lønnsarter | firma-sidebar `Timer` / `/firma/timer/lonnsarter` | 1a «Timer › Lønnsarter» | `kreverFirmaModul="timer"` | Nei | |
| F12 | Timer-katalog: Aktiviteter | `/firma/timer/aktiviteter` | 1a «Timer › Aktiviteter» | do. | Nei | |
| F13 | Timer-katalog: Tillegg | `/firma/timer/tillegg` | 1a «Timer › Tillegg» | do. | Nei | |
| F14 | Timer-onboarding | `/firma/timer/onboarding` | 1a «Timer › Oppsett» | do. | Nei | |
| F15 | Timer-rapport (firma-aggregat + eksport CSV/XLSX) | firma-sidebar `Timer-rapport` / `/firma/timer/rapport` | 1a «Timer › Rapport» | do. | Nei | |
| F16 | Timer-attestering (firma-nivå) | `/firma/timer/attestering`(+`/[id]`) | 1a «Timer › Attestering» | do. | Nei | |
| F17 | Kalender | firma-sidebar `Kalender` / `/firma/kalender` | 1a FIRMA «Kalender» | company_admin/sitedoc_admin | Nei | |
| F18 | Varelager (katalog) | firma-sidebar `Varelager` / `/firma/varelager` | 1a «Varelager › Katalog» | `kreverFirmaModul="varelager"` | Nei | |
| F19 | Varelager-import | `/firma/varelager/import` | 1a «Varelager › Import» | do. | Nei | |
| F20 | Fakturering | firma-sidebar `Fakturering` / `/firma/fakturering` | 1a «Firmaprofil › Fakturering» (gated `erSitedocAdmin` — se K12) | `kreverSitedocAdmin` | Nei | |
| F21 | Firma-innstillinger (master: navn/org.nr) | firma-sidebar `Innstillinger` / `/firma/innstillinger` | 1a «Firmaprofil › Firmainfo» | company_admin/sitedoc_admin | Nei | |
| F22 | Integrasjoner (firma) | firma-sidebar / `/firma/innstillinger/integrasjoner` | 1a «Firmaprofil › Integrasjoner» | do. | Nei | |

## Seksjon FM — Firmamodul-arbeidsflater (globale, i dag utenfor `/firma/`)

| # | Funksjon | Dagens inngang | Ny inngang | Gating som må overleve | Redirect? | Verifisert |
|---|---|---|---|---|---|---|
| FM1 | Maskin-register (liste) | sidebar-bunn `maskin` / `/dashbord/maskin` | **K1 (vedtatt): sidebar-F + 1a «Maskin › Register»** — URL `/dashbord/maskin` beholdes | `kreverFirmaModul="maskin"` (aktiveFirmamoduler) | Nei (URL beholdt; ev. flytt senere m/ redirect) | |
| FM2 | Maskin-detalj (EU-kontroll, vedlikehold, Vegvesen) | `/dashbord/maskin/[id]` | (fra FM1) | do. | Nei | |
| FM3 | Maskin — nytt utstyr | `/dashbord/maskin/nytt` | (fra FM1) + `søk` handling | do. + opprett-gating | Nei | |
| FM4 | Maskin — import | `/dashbord/maskin/import` | 1a «Maskin › Import» | do. | Nei | |
| FM5 | «Mine timer» (egen rapport) | sidebar `mine-timer` / `/dashbord/timer/mine`(+`/ny`,`/[id]`) | **K2 (vedtatt): brukermeny (avatar) + søketreff «Min side › Timer»; mobil = Timer-tab** — fjernes fra firma-sidebar. ⏳ **Interim (steg iii):** ligger fortsatt i NavSidebar PROSJEKT-sone m/flagg på — **flyttes til brukermeny i steg iv** | `kreverFirmaModul="timer"` | Nei | |

## Seksjon ADMIN — sitedoc_admin (`/dashbord/admin/*`, utenfor brukerens arkitektur)

| # | Funksjon | Dagens inngang | Ny inngang | Gating som må overleve | Redirect? | Verifisert |
|---|---|---|---|---|---|---|
| A1 | Admin-oversikt | toppbar «Admin» / `/dashbord/admin` | toppbar «Admin» (behold) | `verifiserSiteDocAdmin` | Nei | |
| A2 | Firmaer (alle) | `/dashbord/admin/firmaer` | admin-seksjon | do. | Nei | |
| A3 | Prosjekter (alle) | `/dashbord/admin/prosjekter` | admin-seksjon | do. | Nei | |
| A4 | Integrasjoner (admin) | `/dashbord/admin/integrasjoner` | admin-seksjon | do. | Nei | |
| A5 | Tillatelse-debug | `/dashbord/admin/tillatelser` | admin-seksjon | do. | Nei | |
| A6 | Testsider | `/dashbord/admin/testsider` | **vurder fjernet fra prod-build** | do. | — | |

## Seksjon X — Spesialruter utenfor sidebar-nav (må ikke mistes)

| # | Funksjon | Rute | Ny inngang | Merknad | Verifisert |
|---|---|---|---|---|---|
| X1 | Offentlig/QR-PSI-utfylling (web) | `/psi/[prosjektId]` | uendret (dyplenke/QR) | ikke i nav | |
| X2 | Kom-i-gang / onboarding | `/dashbord/kom-i-gang` | behold + evt. hub-inngang | K8 (pedagogisk lag) | |
| X3 | Nytt prosjekt | `/dashbord/nytt-prosjekt` | chip/«Opprett»-handling i søk | firma påkrevd (CLAUDE.md-regel) | |
| X4 | Prosjektliste (bruker) | `/dashbord/prosjekter`(+`/[id]`) | chip / dashbord | se K9 (duplikat-tre) | |
| X5 | Aksepter invitasjon | `/aksepter-invitasjon` | uendret (e-postlenke) | — | |
| X6 | Innlogging / registrering / personvern | `/logg-inn`, `/registrer`, `/personvern` | uendret | — | |
| X7 | Mobil-viewer (web) | `/mobil-viewer` | uendret | — | |

---

## Seksjon (a) — Toppbar-funksjoner som må overleve (README §3)

Rollebasert rekkefølge per Kenneths spec 2026-05-04 beholdes.

| # | Funksjon | Kilde | Ny inngang | Gating | Verifisert |
|---|---|---|---|---|---|
| T1 | FirmaVelger | `Toppbar.tsx:85` `FirmaVelger` | kontekst-chip (firma-del) | `erSitedocAdmin` | ✓ |
| T2 | Firma-fastlenke → `/dashbord/firma` | `Toppbar.tsx:91` | chip / sidebar-F | `erCompanyAdmin` + organisasjon | ✓ (c3: firma utledes fra prosjektets primaryOrganization når ikke valgt) |
| T3 | ProsjektVelger + scope (Alle/Mine/enkelt, B1) | `ProsjektVelger` | kontekst-chip (prosjekt-del, hierarkisk) | scope kun admin-roller; `prosjektScope` persistert | ✓ |
| T4 | ByggeplassVelger (m/ disabling) | `ByggeplassVelger` | chip / kontekst-linje | `useToppbarFiltre` → `disabled` når `!byggeplassAktiv` | ✓ (uendret) |
| T5 | FirmaKontekstVelger | `Toppbar.tsx:102` | chip i firma-kontekst | `erFirmaKontekst` (`/dashbord/firma*`) | ✓ (chip gjelder også firma-ruter; FirmaKontekstVelger droppes m/flagg på) |
| T6 | SpråkVelger | `Toppbar.tsx:130` `SpraakVelger` | behold i toppbar (uendret) | alle | ✓ |
| T7 | Brukermeny (avatar + logg ut) | `Toppbar.tsx:131-163` | behold i toppbar | innlogget | ✓ |
| T8 | Admin-inngang | `Toppbar.tsx:117` | behold (amber) | `erSitedocAdmin` | ✓ |
| T9 | Hamburger mobilmeny (web-viewport <md) | `Toppbar.tsx:63-68,166-209` | ny mobil-web-meny (paritet) | `kreverProsjekt`-disabling bevares | ⏳ **restanse:** mobil-web-hamburger bruker fortsatt gammel nav m/flagg på — ikke bygget i steg iii |

## Seksjon (b) — Sidebar-gating + modul-fargeaksent som må overleve (README §4)

Kilde: `apps/web/src/components/layout/HovedSidebar.tsx` + `firma/layout.tsx` + `oppsett/layout.tsx`.

| # | Mekanisme | Hvor | Må bevares som | Verifisert |
|---|---|---|---|---|
| G1 | `kreverModul` (ProjectModule aktiv) | HovedSidebar `filtrertHovedelementer` | hms-avvik, kontrollplan, okonomi, psi | ✓ (delt `useSidebarElementer`) |
| G2 | `kreverGruppemodul` (mineModuler; admin/registrator-bypass) | HovedSidebar:270 | sjekklister, oppgaver, tegninger, 3d | ✓ (delt, verbatim) |
| G3 | `kreverFirmaModul` timer/varelager (ProjectModule på prosjekt) | HovedSidebar:273-274 | timer, timer-attestering, vareforbruk — **K7: leses via felles gating-abstraksjonslag** | ✓ gating bevart (K7-abstraksjon fortsatt utsatt) |
| G4 | `kreverFirmaModul="maskin"` (aktiveFirmamoduler) | HovedSidebar bunnelement:347 | maskin — **K7: samme abstraksjonslag** (én endring ved OrganizationModule-overgang) | ✓ gating bevart; Maskin nå i FIRMA-sone (K1) |
| G5 | `kreverIfc` (avledet fra byggeplassens drawings) | HovedSidebar:253-258 | 3d-visning, tegning-3d | ✓ |
| G6 | `kreverTimerLeder` (kanAttestere) | HovedSidebar:276 | timer-attestering | ✓ |
| G7 | `tillatelse` (Permission) | HovedSidebar:264 / oppsett `manage_field` | generisk permission-gate | ✓ |
| G8 | `kreverHmsTilgang` (harHmsTilgang / `hms_ansvarlig`) | firma/layout | firma-HMS | ✓ (FIRMA-sone) |
| G9 | `kreverSitedocAdmin` | firma/layout (Fakturering) | fakturering | ✓ (FIRMA-sone) |
| G10 | Modul-fargeaksent (border-left 3px + farget ikon) | `MODUL_EIERSKAP` + `MODUL_FARGER` (B3) | timer=grønn, maskin=amber, varelager=teal, prosjekt=blå | ✓ |
| G11 | Deaktiverte ikoner uten valgt prosjekt | HovedSidebar:297 `opacity-40 cursor-not-allowed` | alle `kreverProsjekt`-elementer | ✓ |
| G12 | «Aktivt element»-markering (aria-current) | HovedSidebar `aktivSeksjon` | ny sidebar må reprodusere aktiv-tilstand | ✓ (c2: maks én aktiv rad, lengste-prefiks-vinner) |

## Seksjon (c) — Tverrgående standarder (README §5–6, «lette å miste»)

| # | Standard | Referanse | Krav i redesign | Verifisert |
|---|---|---|---|---|
| S1 | Hjelpetekst (?-ikon per side) | `hjelpetekster.md` | alle nye/flyttede sider har ?-ikon | |
| S2 | Toppbar-filtre-standard (`useToppbarFiltre`) | `hooks/useToppbarFiltre.ts` | byggeplass-velger grå/disabled der ikke i bruk | |
| S3 | Filter-standard (`MultiComboks` + `SearchInput`) | `dashbord/firma/hms` | filterpaneler følger standarden | |
| S4 | i18n — ingen hardkodede strenger | CLAUDE.md § Språk | alle nye strenger via `t()` i nb+en | |
| S5 | i18n — 15-språks generering | `generate.ts` | kjøres **kun på redesign-branchen** (frossen sone) | |
| S6 | Sidebar navy-token (`sitedoc-sidebar` #16233f) | README Designtokens | legges i `tailwind.config` (NY) | |

## Seksjon (d) — Mobil: dagens ruter → ny tab-struktur (README 2a)

Ny tab-struktur: **Hjem · Tegninger · Dokumenter · Timer · Mer** (erstatter hjem/boks/lokasjoner/mer).
Behold alle gamle skjermer nåbare til paritet er verifisert.

| # | Funksjon (mobil) | Dagens rute | Ny inngang | Merknad | Verifisert |
|---|---|---|---|---|---|
| M1 | Hjem | `(tabs)/hjem.tsx` | Hjem-tab | inkl. MannskapInnsjekkKort (PSI Fase A) | |
| M2 | MannskapInnsjekkKort (§15 innsjekk/utsjekk) | på hjem | Hjem-tab | online-only, «krever nett» | |
| M3 | Dokumenter/boks (mapper + dok-liste) | `(tabs)/boks.tsx` | **Dokumenter-tab (2a oppgradert)** | brødsmulesti, språkinfo per mappe, statusprikk | |
| M4 | Språkavvik-bekreft (inline) | (i boks) | Dokumenter-tab: «Bekreft og oversett»/«Behold» | ett-klikk | |
| M5 | Lokasjoner | `(tabs)/lokasjoner.tsx` | **flyttes under Tegninger/PSI** — behold nåbar | tab fjernes fra tabbar | |
| M6 | Mer | `(tabs)/mer.tsx` | Mer-tab (+ innstillinger-hub 1c + **Kontakter-inngang, K6**) | | |
| M7 | 3D-visning | `3d-visning.tsx` | Tegninger-tab toggle **3D** | gjenbruk rute | |
| M8 | Tegning+3D (split) | `tegning-3d.tsx` | Tegninger-tab toggle **2D+3D** | gjenbruk rute | |
| M9 | Live-view (AR/kamera) | `live-view.tsx` | **må ikke mistes** (ikke i 2a-spec) | se K4 | |
| M10 | Dokumentleser + språkbytte | `dokument/[id].tsx` | **2c** (språkpille-rad + sammenlign) | ett-trykk språkbytte | |
| M11 | Oppgave (liste + detalj) | `oppgave/index.tsx`, `oppgave/[id].tsx` | fra Hjem/Dokumenter-kontekst | rettighetInput-oppfølger (kjent) | |
| M12 | Sjekkliste (liste + detalj) | `sjekkliste/index.tsx`, `sjekkliste/[id].tsx` | fra Hjem-kontekst | | |
| M13 | PSI-utfylling | `psi/[psiId].tsx` | QR/dyplenke | utenfor tabbar | |
| M14 | Timer (dagsseddel/index) | `timer/index.tsx` | **Timer-tab** | | |
| M15 | Timer — ny | `timer/ny.tsx` | Timer-tab handling | | |
| M16 | Timer — mine | `timer/mine.tsx` | Timer-tab | | |
| M17 | Timer — detalj | `timer/[id].tsx` | fra Timer-tab | | |
| M18 | Timer-attestering (liste + detalj) | `timer/attestering/index.tsx`, `/[id].tsx` | Timer-tab (leder) | leder-gating | |
| M19 | Innlogging (mobil) | `logg-inn.tsx` | uendret | MS-auth (code+PKCE) | |

---

## Beslutninger — K1–K11 (Kenneth via K-BESLUTNINGER.md, 2026-07-05)

**Vedtatt og innarbeidet:** K1, K2, K4, K5, K6, K10. **Utsatt (utenfor redesign-scope,
blokkerer ikke plassering):** K3, K7, K8, K11. **Avventer rapport (eneste gjenstående
plasserings-blokker):** K9.

| # | Beslutning | Vedtak | Rader berørt | Status |
|---|---|---|---|---|
| K1 | Maskin-plassering | **FIRMA-sonen i ny nav; URL `/dashbord/maskin` beholdes** (ev. flytt senere m/ redirect) | FM1–FM4 | ✅ vedtatt |
| K2 | «Mine timer»-plassering | **Brukermeny (avatar) + søketreff «Min side › Timer»; mobil = Timer-tab; fjernes fra firma-sidebar** | FM5, M14–M17 | ✅ vedtatt |
| K3 | HMS-avvik modul vs domain | **UTSATT** — datamodell røres ikke; redesign viser HMS der modulen er på | P7, F8 | 🟡 utsatt |
| K4 | 3D-konsolidering | **Nav-nivå: én «Tegninger»-inngang m/ 2D/3D/2D+3D-toggle; `modeller`/`punktskyer` = underinnganger.** Kodekonsolidering senere sak | P9–P12, M7–M9 | ✅ vedtatt (nav) |
| K5 | Sjekkliste-/oppgavemaler | **Hub-kort «Maler» under PROSJEKT-innstillinger** (ikke i sidebar — sidebar = arbeidsflater) | O6, O7, P29 | ✅ vedtatt |
| K6 | Kontakter/Dokumentflyt | **SPLITT:** «Dokumentflyt» forblir innstilling (hub-kort); NY lesevisning «Kontakter» (personkatalog, klikk-for-å-ringe) i sidebar-P + søk + mobil Mer-tab. Rename alt gjort i kode (kontakter → redirect) | O4, O5, **P31 (ny)**, M6 | ✅ vedtatt |
| K7 | OrganizationModule-overgang | **UTSATT** — redesign leser dagens `har*Modul` via ett felles gating-abstraksjonslag (overgang = én endring senere) | G3, G4 | 🟡 utsatt |
| K8 | Onboarding/pedagogisk lag | **UTSATT** — noter i onboarding-veileder at 1a-huben er naturlig hjem for «Kom i gang» | X2 | 🟡 utsatt |
| K9 | Duplikat prosjekt-rutetre | **UTFØRT 2026-07-05 (Kenneth godkjente sletteplan):** `Toppmeny.tsx` (død kode) + legacy-layout slettet; de 7 legacy-sidene konvertert til server-side redirects → kanonisk `/dashbord/[prosjektId]/*`. **Redirect beholdes til redesignet er ferdig utrullet** (ikke 1-ukes-regelen — den gjelder mobil-API; nettleser-bokmerker lever lenger). Selve redirect-fjerningen = opprydding etter lansering. Se § K9-rapport | X4, P29 | 🟢 utført |
| K10 | Ansatte vs Brukere | **UI-term «Ansatte»; hub-kort «Ansatte og roller».** Ikke hardkod «ansatt = bruker» (HR-Import kan gi ansatte uten konto) | F3, F4 | ✅ vedtatt |
| K11 | Admin-redesign (abonnement/drill-down) | **UT AV SCOPE** — Lag 6 (sitedoc_admin) egen fase etter kunderettet nav | A1–A6 | 🟡 utsatt |
| K12 | Fakturerings-tilgang: `erSitedocAdmin` (dagens firma-layout) vs company_admin (1a-design) | Hub gater Fakturering-chip på `erSitedocAdmin` for å **speile dagens atferd** (parity). 1a-designet la den under company_admin — å vise fakturerings-innsyn for firma-admin er en **atferdsendring**, ikke avgjort her | F20 | 🟠 krever Kenneth |

> **K8-oppfølger (ikke blokkerende):** legg en linje i `onboarding-veileder.md` om at 1a-huben
> er hjem for «Kom i gang»-innhold — gjøres når huben bygges (steg ii).

### K9-rapport — duplikat prosjekt-rutetre (kartlagt 2026-07-05)

**Metode:** grep av alle UI-lenker/navigasjon i `apps/web/src` mot begge rutetrær.

**Funn:**

| Spor | Kanonisk `/dashbord/[prosjektId]/*` | Legacy `/dashbord/prosjekter/[id]/*` |
|---|---|---|
| Undersider på disk | 18 modul-ruter (full sidebar) | 4 (`page`/oversikt, `maler`, `oppgaver`, `sjekklister`) |
| Egen layout | ja (`[prosjektId]/layout.tsx` — full sidebar) | ja (`prosjekter/[id]/layout.tsx`) |
| Reell navigasjon inn | dashbord-start `page.tsx:148` (`/dashbord/${id}`), auto-redirect `:64/:70`, ProsjektVelger, sidebar | **kun** prosjektlisten `/dashbord/prosjekter/page.tsx:52` |
| Hvem lenker til listen | — | **kun** `components/Toppmeny.tsx:17` |
| `Toppmeny.tsx` importert? | — | **NEI — død komponent** (ingen import noe sted) |
| Intern inkonsistens | — | oversikt-siden lenker blandet: «Faggrupper» → *kanonisk* `/dashbord/${id}/faggrupper`, «Maler» → *legacy* `${basePath}/maler` |

**Konklusjon:** `/dashbord/[prosjektId]/*` er de facto kanonisk. Legacy-treet
(`/dashbord/prosjekter/[id]/*`), prosjektlisten (`/dashbord/prosjekter`) og `Toppmeny.tsx`
er reelt foreldreløse — hele inngangskjeden henger på én ikke-importert komponent.

**Anbefaling (krever Kenneths OK):**
1. `redesign/navigasjon`: sett `/dashbord/prosjekter/[id]/*` + `/dashbord/prosjekter` som
   redirect til de kanoniske rutene (behold ≥1 uke per rename-policy).
2. Slett `Toppmeny.tsx` (død kode) — eller behold og repek til kanonisk hvis den skal gjenbrukes.
3. Fjern legacy-treet etter redirect-vinduet.
Ingen bruker-funksjon mistes (alle 4 legacy-sider har kanonisk ekvivalent).

---

## Tellelinje

**Funksjoner totalt: 109** (+1 vs v1: P31 Kontakter-lesevisning, K6) — fordelt:
Prosjektmoduler (P) 31 · Prosjekt-oppsett (O) 13 · Firma-admin (F) 22 ·
Firmamodul-arbeidsflater (FM) 5 · Sitedoc-admin (A) 6 · Spesialruter (X) 7 ·
Toppbar (T) 9 · Sidebar-gating (G) 12 · Standarder (S) 6 · Mobil (M) 19 = **130 rader**.

- **Plassert (ny inngang tildelt, inkl. vedtatte K-er): 129 / 130**
- **Åpen plassering (blokkert): 1** — kun radene under **K9** (rutetre-kanonikk); alt annet er
  vedtatt eller utsatt uten å blokkere plassering.
- **Verifisert gammel-vs-ny (via `nyNavigasjon`-flagg): 0 / 130** — fylles under flagg-testing.

> **Note:** «130 rader» teller hver selvstendige funksjons-rad; «109 funksjoner» er unike
> bruker-funksjoner (gating- og standard-radene G/S er tverrgående mekanismer, ikke egne
> sider). Bruk rad-tellingen for fremdrift under flagg-test.

---

## Fremdrift (redesign/navigasjon)

| Steg | Status | Detalj |
|---|---|---|
| (i) Paritetssjekkliste | ✅ | Denne fila. Commit `69f36a21`. K1–K11 innarbeidet |
| K9-opprydding | ✅ | `Toppmeny.tsx` + legacy-layout slettet; 7 legacy-sider → redirects |
| Flagg-infra | ✅ | `useNyNavigasjon()` (`apps/web/src/hooks/`) — localStorage + `?nyNav=1`, eneste kilde. Flagg av = eksakt dagens UI. **Brukermeny-toggle (`settNyNavigasjon`, reload) — KUN `sitedoc_admin` nå** (company_admin utvides ved pilotstart, hindrer at kunde-admin skrur på uferdig redesign på prod). Plattform-abstraksjon (AsyncStorage) noteres for 2a |
| (ii) 1a hub | ✅ bygget | `/dashbord/innstillinger` — FIRMA/PROSJEKT-seksjoner, kort m/ underlenke-chips, søk + segmentert filter, gating (kanAdministrereFirma / prosjektId / firmamoduler / manage_field), hjelpetekst, i18n (61 nøkler × 15 språk). **Direkte nåbar via URL uavhengig av flagget.** Justeringer a–e (2026-07-05): (a) seksjonsfarge-headere, (b) chip-dedup Kompetanse/HMS, (c) Mappeoppsett + PSI-mal-innganger (O9/O10), (d) prosjektnavn-interpolasjon, (e) Fakturering-gating-kommentar (K12). **Test-verifisering mot 1a (2026-07-05):** (2) `manage_field`-gating fikk admin/registrator-bypass (`erSitedocAdmin`/`erCompanyAdmin`/`minFlytInfo.erAdmin`) — speiler HovedSidebar; sitedoc_admin så ikke Moduler/Maler/Dokumentflyt før. (1)+(3) var alt i `eca2e571`, ventet på test-deploy |
| (ii) 1b hub-fix (funn 1b) | ✅ bygget | Commit `5b576d25`. Tre-tilstands prosjekt-resolving i huben: undertekst + PROSJEKT-kort + hint nøkles på resolvet `valgtProsjekt`, ikke rå `prosjektId`. Ny `lasterValgtProsjekt` eksponert fra prosjekt-kontekst → «Laster prosjekt …» mens persistert id resolves; feilet fetch → hint (ikke evig lasting). Hindrer tom navn-streng + hint-blink ved fersk økt. **✅ Inkognito-verifisert på test (fabel, 2026-07-05):** nøytral chip+hint ved tom state, «Laster …»→navn uten blink (hard refresh ×3), `?nyNav=0` persistent av. |
| (iii) 1b sidebar + kontekst-chip | ✅ | Bak `useNyNavigasjon`. **NavSidebar** (PROSJEKT-sone: dagens elementer + P31 Kontakter, uendret G1–G12 + fargeaksent · FIRMA-sone admin-gated, speiler alle 15 firma/layout-innganger · Innstillinger fast nederst → huben; gjelder overalt m/flagg på, firma-layout-sidebar + FirmaKontekstVelger droppes da — løser P4). **KontekstChip** «{Firma} / {Prosjekt} ▾» erstatter FirmaVelger+ProsjektVelger, gjenbruker panel-innmater (scope/favoritter/søk bevart), 1b-lastetilstand i teksten. **P31 Kontakter** read-only lesevisning (`/dashbord/[prosjektId]/kontakter`). Gating G1–G12 ekstrahert til delt `sidebar-elementer.tsx` (`useSidebarElementer`) — HovedSidebar (flagg av) konsumerer samme, verbatim. i18n 36 nøkler × 15 språk. **Polish (fabel-gjennomgang):** Maskin flyttet til FIRMA-sonen (K1); c2 dobbel-aktiv fikset (maks én aktiv rad, lengste-prefiks-vinner + prosjekt-rader lyser ikke på firma/hub-ruter); Innstillinger-footer pinned (scroll kun i nav); «Mine timer» interim i PROSJEKT-sone (FM5/K2 → brukermeny i steg iv). Godkjente avvik: brand-blå sidebar, PROSJEKT-etikett uten prosjektnavn. **c3:** chip viser aldri «Velg firma / {prosjekt}» — firma utledes fra prosjektets primaryOrganization når ikke eksplisitt valgt (frittstående prosjekt → kun prosjekt-del). **✅ DESIGNGODKJENT + T/G-verifisert på test (fabel, 2026-07-05).** Restanse: T9 mobil-web-hamburger bruker fortsatt gammel nav m/flagg på (ikke bygget i steg iii). |
| (iv) 1b søkemodal | 🔨 bygget | Bak `useNyNavigasjon`. **SokModal** (Ctrl/Cmd+K + «Søk overalt»-pille i toppbar): 620px sentrert, overlay `rgba(15,23,42,0.42)`, grupper INNSTILLINGER (blå flis) + SIDER (amber flis), brødsmulesti, tastaturnav (↑↓/↵/esc), valgt rad `#eef3fd`, footer. **Underlenker er egne treff** (chip-nivå): «lønnsart» → Lønnsarter — Firma › Timer. **Diakritikk-tolerant** («lonnsart» treffer «Lønnsarter»). **Tom query** = hint + kuraterte vanlige innganger; **ingen treff** = «Ingen treff for '{q}'». Registeret utledes drift-fritt fra delt `useInnstillingerKort` (hub-kort ekstrahert, **hub render byte-identisk** — 7+/230−) + `useSidebarElementer` + ny delt `firma-nav.tsx` (`useFirmaNavElementer`, ekstrahert fra NavSidebar). Gating arves fra kilde-hookene. Ctrl+K-kollisjon sjekket (ingen). i18n 7 nøkler × 15 språk. **Avvik å bekrefte:** SIDER-brødsmule er sone-nivå (flat sidebar) — «attestering» → «Timer-attestering — Prosjekt» (ikke «Prosjekt › Timer»); to-nivå ville krevd per-element-hint. **Venter test-verifisering (skjermbilde «lønnsart» + tom-tilstand mot 1b-mock).** |
| (v) 2b oversettelsespanel | ⏳ | |
| (vi) 2a mobil-tabs | ⏳ | RN-variant av `useNyNavigasjon` (AsyncStorage) |
| (vii) 2c leser | ⏳ | |

## Neste steg

1. **Kenneth godkjenner den oppdaterte lista.** K1/K2/K4/K5/K6/K10 er innarbeidet; K3/K7/K8/K11
   utsatt uten å blokkere; kun K9 (rutetre-kanonikk) gjenstår — og den blokkerer bare
   redirect-strategien for `/dashbord/prosjekter/[id]/*`, ikke selve hub-/sidebar-byggingen.
2. **Valgfritt før steg (ii):** kjør K9-kartleggingen (grep UI-lenker til `/dashbord/prosjekter/[id]`)
   — kan gjøres på forespørsel.
3. Deretter steg (ii): 1a hub bak `nyNavigasjon`-flagg.
4. Hver rad krysses av i «Verifisert»-kolonnen når gammel-vs-ny er sammenlignet under flagget.

## Relaterte dokumenter

- [navigasjon-arkitektur-analyse-2026-05-03.md](navigasjon-arkitektur-analyse-2026-05-03.md) — 🟢 ANKER (ruteinventar A–E)
- [admin-navigasjon-analyse-2026-05-03.md](admin-navigasjon-analyse-2026-05-03.md) — firma↔prosjekt-kobling (P1–P5)
- [ux-arkitektur-agenda.md](ux-arkitektur-agenda.md) — B1–B3 (prosjekt-scope, onboarding-bar, modul-farger)
- [domene-arbeidsflyt.md](domene-arbeidsflyt.md) — 🟢 STYRENDE
- [terminologi.md § 0](terminologi.md) — tre-nivå-anker
- README i design-handoff-pakken (`Sitedoc redesign tips.zip`) — skjerm-spec 1a–2c

# Ordre til redesign-Opus: Firmaorientert admin-oversikt (1a + 1b) — 2026-07-26

> Fra fabel via Kenneth. Design godkjent av Kenneth 2026-07-26 mot mockup `Admin Firmaorientert Oversikt.dc.html` (fabels designprosjekt, skjermbilder relayes ved behov). Kvalitet fremfor tempo: rotårsak, delte kilder, guards. DoD per FABEL-RAMMEVERK: kode → build grønn (`pnpm --filter @sitedoc/web build`) → skjermbilder til fabel for designgodkjenning → dok-sync → cowork-merge. Ikke merge selv, ikke rør STATUS/BACKLOG.

## Hva som bygges (kort)

Admin-flaten dreies firmaorientert: **Firmaer-listen blir inngangen; prosjektoversikt lever PER firma på en ny firma-detaljside.** Global «Prosjekter»-side (`dashbord/admin/prosjekter`) avvikles som nav-punkt — den skalerer ikke når firmaer har mange prosjekter.

## Steg 0 — kodeverifisert nå-rapport (FØR design/koding)

Lever kort rapport: dagens `admin/firmaer/page.tsx` + `admin/prosjekter/page.tsx` (datakilder, tRPC-ruter, kolonner), hvilke admin-ruter som finnes for firma-detaljdata (brukere, moduler, fakturering), og om det finnes paginering/søk server-side i dag. Fabel gater rapporten før koding. Negative påstander med oppgitt søkerom.

## 1a — Firmaer-listen (erstatter dagens `admin/firmaer`)

- Kolonner: Firma (navn + org.nr + EHF-indikator), **Status**, Brukere, **Prosjekter (aktive, + totalt)**, Moduler (chips fra `OrganizationModule`, aktiv=grønn), Sist aktivitet.
- **Status-badge fra produktmodellen:** Kunde (`erKunde=true`) / Prøve (`erKunde=false`, egne prosjekter) / Skall (`erKunde=false`, kun part i andres prosjekt/dokumentflyt). Delt hjelper for klassifiseringen — ikke inline-logikk i siden.
- Filterchips: Kunder / Prøve / Skall / Alle, + søkefelt (navn/org.nr). Client-side holder ved <100 firmaer; noter i rapporten om server-side trengs.
- **Hele raden klikkbar** → firma-detaljside (1b). Rediger-blyanten består.
- «Sist aktivitet»: billigste eksisterende signal (f.eks. nyeste Activity/updatedAt på firmaets prosjekter) — IKKE ny tung aggregering; foreslå kilde i rapporten, fabel gater.

## 1b — Ny firma-detaljside (`dashbord/admin/firmaer/[id]`)

- Header: navn, status-badge, org.nr, faktura-e-post, EHF. Knapper: Rediger firma, + Opprett prosjekt (prefylt organizationId — gjenbruk eksisterende opprett-flyt).
- **Faner: Prosjekter | Brukere | Moduler | Fakturering | Innstillinger.** Denne ordren bygger Prosjekter-fanen fullt; øvrige faner er tynne visninger av EKSISTERENDE data/ruter (brukere = OrganizationMember-liste; moduler = OrganizationModule-status; fakturering = invoiceAddress/invoiceEmail/ehfEnabled + aktive moduler m/aktivertVed som fakturagrunnlag; innstillinger = lenke/gjenbruk av eksisterende firmainnstillinger). Ingen ny forretningslogikk i fanene.
- Prosjekter-fanen:
  - Tellekort: Aktive / Fullført+arkivert / Deaktivert / **Uten aktivitet 30 d** (amber).
  - Søk + statusfilter (Aktive / Arkiverte / Alle) + sortering (default: sist aktivitet).
  - Tabell: Prosjekt, Nr, Medl., Sjekk., Oppg., Sist aktivitet, Status. Rad med inaktivitet ≥30 d får amber bakgrunn + «Inaktiv 30d+»-badge.
  - **Server-side paginering fra dag én** (25/side) — hele poenget er skala.
- Prøveperiode-kolonnen fra gammel side: vises kun der den gjelder (trialExpiresAt satt), ellers utelatt.

## Avvikling av global prosjektliste

- Nav-punktet «Prosjekter» fjernes fra admin-sidemenyen. Ruten erstattes av en ren redirect til `admin/firmaer` i en overgangsperiode.
- **Opprydding (obligatorisk, samme leveranse):** gammel kode fjernes, ikke etterlates død. `admin/prosjekter/page.tsx` slettes (redirect-fila er ny og triviell); komponenter, hooks og tRPC-ruter som KUN den gamle siden brukte fjernes — men mål først at de er ubrukte (alle callsites, oppgitt søkerom i rapporten) før sletting. Delte ruter som også brukes av andre flater består. Ubrukte i18n-nøkler etter slettingen ryddes i samme commit.
- «Rydd utløpte» (gjelder kun orgløse prøveprosjekter, admin.slettUtlopteProsjekter) flyttes til Testsider/vedlikeholds-flaten — IKKE inn i firma-konteksten.
- Tverrgående prosjektsøk dekkes av eksisterende Ctrl+K — ingen ny global liste.

## Rammer

- i18n: alle nye strenger via `t()` + språkgenerering (15 språk).
- Ingen endring i guards/produktmodell — det eies av egne ordrer (sjekklistegrense-interim, firma-produktmodell). Denne ordren er ren lese-/navigasjonsflate.
- Flagg-prinsippet: dette er admin-flate (sitedoc_admin), utenfor `nyNavigasjon`-skallet — bygges flagg-nøytralt.
- Delte kilder: status-klassifisering (Kunde/Prøve/Skall) og «sist aktivitet»-oppslag som gjenbrukbare hjelpere i api-laget, brukt av både liste og detaljside.
- Skjermbilder til fabel: firmaliste m/filtre, detaljside Prosjekter-fane (med og uten inaktiv-rad), tom-tilstand (firma uten prosjekter), én av de tynne fanene.

## Utenfor scope

Guard-/grenseendringer, OrganizationModule("prosjekt")-slug, standalone-avvikling, betalings-/fakturaintegrasjon, endringer i vanlig (ikke-admin) prosjektliste.

## Fabel-gate steg 0 + beslutninger (2026-07-27) — STYRENDE, overstyrer teksten over der de avviker

Steg 0-rapporten godkjent (cowork-gatet rigorøs). Beslutninger fra fabel:

- **§5 «sist aktivitet»:** `Activity` primær + `Project.updatedAt` fallback for **kolonnen** (sorterbar, «—» når intet signal). **DROP «Inaktiv 30d+»-badgen OG tellekortet «Uten aktivitet 30 d»** — signalet skrives ikke av sjekkliste-/oppgaveruter, så et amber-«fakta»-varsel villeder. Badgen kommer tilbake med oppfølgingsordre 1.
- **§7.1 klassifisering:** kun **Kunde-status** nå. Filterchips (Kunder/Prøve/Skall) **utgår**; søkefeltet består. Prøve/Skall venter på produktmodell-ordren.
- **§7.2 — § «Avvikling av global prosjektliste» OVERSTYRT.** Sletting flyttes til **fase 2**. **Fase 1 (denne ordren):** bygg 1a+1b komplett; nav-punktet «Prosjekter» + `admin/prosjekter`-siden **BESTÅR**, ingen sletting, ingen redirect. **Fase 2 (egen ordre):** utvid Ctrl+K med tverrgående prosjekt-treff (admin-scope) → DERETTER fjernes nav-punkt + side i samme leveranse. Ingen kapabilitet fjernes før erstatningen finnes. (Opprydding-avsnittet i § over gjelder altså IKKE i fase 1.)
- **§7.3:** enkeltslett → per-rad i 1b Prosjekter-fanen; «Opprett malprosjekt» → Testsider. `hentProsjektStatistikk`/`slettProsjekt` består.
- **§7.4:** oversikt-statkort re-pekes til firmaer.

**To oppfølgingsordrer født (→ BACKLOG):** (1) Activity-skriving fra kjerne-prosjektruter (sjekkliste/oppgave/HMS) — muliggjør ærlig «sist aktivitet» + gjeninnføring av inaktiv-badge. (2) Ctrl+K tverrgående prosjektsøk (admin-scope) — forutsetning for fase 2-sletting av global prosjektliste.

## Levert — fase 1 (2026-07-27, branch `feat/admin-firmaorientert`)

Bygget flagg-nøytralt. Build grønn (`pnpm --filter @sitedoc/web build`, exit 0). Gammel `admin/prosjekter`-side + nav-punkt uendret (fase 2 avvikler).

**API (`apps/api/src`):**
- `services/firmaOversikt.ts` (ny) — delte hjelpere: `klassifiserFirmaStatus` (fase 1: kun `"kunde"`), `hentFirmaAktivitet` (per firma: Activity `_max.createdAt` primær + Project `_max.updatedAt` fallback), `hentProsjektAktivitet` (per prosjekt).
- `routes/admin.ts` — `hentAlleOrganisasjoner` beriket med `status` + `prosjekterAktive`/`prosjekterTotalt` (på `primaryOrganizationId`) + `sistAktivitet`. Nye prosedyrer: `hentFirmaDetalj` (header/tellekort/brukere/moduler/innstillinger) og `hentProsjekterForFirma` (server-side paginering 25/side, søk + statusfilter + sortering; sort «sistAktivitet» = `updatedAt`-proxy i DB, display merget med Activity per rad).

**Web (`apps/web/src/app/dashbord/admin`):**
- `firmaer/page.tsx` (1a) — omskrevet: kolonner Firma (+EHF-indikator), Status (Kunde-badge), Brukere, Prosjekter (aktive/totalt), Moduler, Sist aktivitet. Client-side søk. Hele raden → detaljside; rediger-blyant + opprett/rediger-modaler (m/Brreg) beholdt.
- `firmaer/[id]/page.tsx` (1b, ny) + faner: `ProsjekterFane.tsx` (full — paginert tabell, 3 tellekort, søk/status/sortering, per-rad slett m/statistikk, prøveperiode-kolonne kun der `trialExpiresAt` satt), `BrukereFane.tsx` (OrganizationMember-liste + Imperser), `ModulerFane.tsx`, `FaktureringFane.tsx` (read-only invoice-felt + aktive moduler m/aktivertVed), `InnstillingerFane.tsx` (read-only OrganizationSetting + integrasjoner-CRUD).
- `firmaer/delte-komponenter.tsx` (ny) — `ModulPiller`, `FirmaStatusBadge`, `formaterSistAktivitet`.
- `admin/page.tsx` — Prosjekter-statkort re-pekt til `firmaer` (§7.4).
- `admin/testsider/page.tsx` — «Opprett malprosjekt»-knapp flyttet hit (§7.3), bruker FirmaVelger som før.
- i18n: 105 nye nøkler i nb+en, generert til 13 språk.

**To beslutninger tatt i implementasjonen (flagges til fabel ved skjermbilde-review):**
1. **Integrasjoner-CRUD** (lå i gammel firmaer-slide-over) plassert under **Innstillinger-fanen** — ikke i 5-fane-lista, men bevarer kapabiliteten uten å bryte fane-strukturen. Endres lett hvis mockup mente annet.
2. **Sekundær-org-tilknytning** (`tilknyttProsjekt`/`fjernProsjektTilknytning`, `ProjectOrganization` m:n) — lå kun i gammel slide-over, er IKKE portert til 1b (ikke i fane-spec). tRPC-prosedyrene består (intet slettet i fase 1), så UI kan gjeninnføres trivielt om ønsket.

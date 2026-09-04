# Designnotat AM 4 — Malarkiv (firma + SiteDoc) — fabel 2026-09-04

**Status:** designsak, venter Kenneth-gate på mockup (`Malarkiv Mockup.dc.html`, designprosjektet) FØR ordre til kode.
**Kilde-krav:** referat Markussen 20.08 ordre 4 — (1) firma-malarkiv som nye prosjekter henter HMS-/sjekkliste-/oppgavemaler fra, (2) sentralt SiteDoc-arkiv å låne fra.

## Fakta — målt av fabel mot lokal repo-kopi 2026-09-04

1. **Datamodellen for firma-arkivet FINNES allerede.** `OrganizationTemplate` + `OrganizationTemplateObject` ligger i `packages/db/prisma/schema.prisma:1032–1099`, og `ReportTemplate` bærer koblingsfeltene `organizationTemplateId` + `promotedToFirma` (schema:992–993, relasjoner `CopiedFromOrgTemplate`/`PromotedTemplate`). Steg 1 av `docs/claude/migrering-reporttemplate.md` er altså bygget.
2. **API og UI finnes IKKE.** Grep `firmamal|organizationTemplate` i `apps/api/src` gir kun timer-domenets eksportOppsett (annet domene, men samme eierskapsmønster) + kommentarer i `mal.ts:429` og `kontrollplanKobling.ts:59`. Ingen treff i `apps/web/src`. Søkerom: hele apps/api/src og apps/web/src. Stemmer med coworks negative kontroll («malarkiv» → 0 treff).
3. **Et sentralt arkiv finnes allerede for sjekklister:** `BibliotekStandard/Kapittel/Mal` + `ProsjektBibliotekValg` (schema:1994–2056, NS 3420-K) med import-UI (`BibliotekPanel.tsx`) og kontrollplan-bruk. `BibliotekMal` har allerede `kategori`/`domene`-felter (E steg 8).
4. **Nye prosjekter får maler fra hardkodede `PROSJEKT_MODULER`-definisjoner** ved modulaktivering (`modul.ts:274–310`, idempotent på `prefix`). Ikke fra noe firma-nivå.
5. **Hull for HMS:** `OrganizationTemplate` mangler `subdomain`/`hmsSynlighet` (kommentaren sier kun "oppgave | sjekkliste"). HMS-maler i arkivet krever additivt kolonnetillegg.

## Forslag (alt under er FORSLAG til Kenneth-vedtak, ikke eksisterende atferd)

### F1. Kopiering med avstamning — aldri referanse
Prosjektmal er alltid en **snapshot-kopi**; `organizationTemplateId` beholdes som avstamningspeker (finnes). Et pågående dokument skal aldri endre seg fordi firmamalen endres. Sletting av firmamal → SetNull på kopiene (allerede schema-semantikk), kopiene lever videre.

### F2. Versjonering: manuell, aldri auto-sync
Som migrering-reporttemplate.md § Mal-versjonering: nytt felt `versjonAvHovedmal` på ReportTemplate (additivt), badge «X versjoner bak» på mal-raden, «Oppdater»-knapp = bevisst handling. Diff/merge ved lokal endring = backlog, ikke fase 1.

### F3. Eierskap
Firma-admin (samme `OrganizationMember.firmaRoller`-mønster som `timer/eksportOppsett.ts`) eier arkivet: opprette, redigere, slette, promotere opp. **Alle prosjektadmin kan hente ned** — henting er gjenbruk, ikke styring (plan-dokumentets anbefaling, spørsmål 3).

### F4. Seeding av nye prosjekter — kundekravets kjerne
Flagg på OrganizationTemplate: `standardForNyeProsjekter` (boolean, additivt). Ved modulaktivering/prosjektopprett seedes firmaets flaggede maler **automatisk, uten dialog** (effektivitets-gate: defaults over valg, 0 ekstra klikk), deretter fylles hull fra PROSJEKT_MODULER som i dag — idempotent på prefix.
**Innstilling ved prefix-kollisjon:** firmamalen VINNER over standardmalen (det er firmaets versjon av standarden). → beslutningspunkt B1.

### F5. SiteDoc-arkivet = generalisering av eksisterende bibliotek
Ikke ny modell. Bibliotek-modellen utvides til å bære oppgave-/HMS-maler (kategorifeltet finnes). Lånevei fase 1: **sentralt → firma-arkiv** (kopi m/avstamning); dagens sentralt → prosjekt (kontrollplan/NS 3420) består urørt. Kuratering: seed-script først, sitedoc_admin-UI i del 10/K11-fasen. → beslutningspunkt B2.

### F6. UI-flater (mockup viser alle)
- **Ny side i FIRMA-sonen (amber):** `/dashbord/oppsett/firma/malarkiv` — tre faner (Sjekklister / Oppgaver / HMS), speiler produksjonssidenes tre-liste-prinsipp (MALBYGGER.md: typene blandes aldri).
- **Malbygger:** knapp «Send til firmaarkiv» (kun firma-admin) + badge «I firmaarkivet» / «Basert på firmamal: …».
- **Ny mal-dialogen:** tre kilder — Tom / Fra firmaarkiv / Fra SiteDoc-arkiv.
- Redigering av firmamal gjenbruker eksisterende MalBygger-komponent i firma-modus — ingen parallell malbygger (gjenbruksregelen).

### F7. Konfliktregel må vedtas i samme ordre
migrering-reporttemplate.md § Konflikt-regel (én mal-rad i både KontrollplanPunkt og DokumentflytMal): anbefaler alternativ 2 (kategori-skille). Prod-audit før implementering står ved lag.

## Klikk-budsjett (DoD, «mange klikk»-kravet fra referatet)
- Nytt prosjekt med firmamaler: **0 ekstra interaksjoner** (auto-seed).
- Hente én firmamal inn i eksisterende prosjekt: **maks 3 klikk** (Ny mal → Fra firmaarkiv → velg mal).
- Promotere prosjektmal til firmaarkiv: **maks 2 klikk** (Send til firmaarkiv → bekreft-fri; angring = slett i arkivet).

## 🟢 Beslutningspunkter — ALLE TRE GATET AV KENNETH 2026-09-04

- **B1 prefix-kollisjon:** ✅ **VEDTATT — firmamalen VINNER** over standardmalen med samme prefix.
  Det er firmaets versjon av standarden; A.Markussen skal ikke ha begge.
  🔴 **Cowork-tilføyelse, bindende for ordren: erstatningen skal være SYNLIG.** En stille
  overstyring er samme feilklasse som kostet tre runder 04.09 (byggeplass-chippen som returnerte
  `null` uten melding, vedlegg som forsvant uten varsel, `_` som lekket til kundedokumentet).
  Malen skal vise at den har erstattet en standardmal — ikke bare oppføre seg som om standarden
  aldri fantes.
- **B2 SiteDoc-lånevei fase 1:** ✅ **VEDTATT — kun sentralt→firma.** Dagens sentralt→prosjekt
  (kontrollplan / NS 3420) består urørt, så ingenting tapes ved å utsette en tredje vei til den
  første virker.
- **B4 bibliotek-avstamning:** ✅ **VEDTATT AV KENNETH 2026-09-04 — strukturert peker, lagt i
  bolk 1.** Femte kolonne `organization_templates.laant_fra_bibliotek_mal_id` (nullable, additiv,
  FK til `BibliotekMal` med `onDelete: SetNull` — samme semantikk som L5).
  **Bakgrunn:** kontrollplan målte at `OrganizationTemplate` har `promotedFromTemplateId` mot
  `ReportTemplate`, men ingen peker mot `BibliotekMal`. L3 krever «kopi m/avstamning», og de fire
  godkjente kolonnene dekket den ikke. Første løsning bar kilden i `description`-teksten, slik
  `bibliotek.ts importerMal` gjør i dag.
  🔴 **Forkastet fordi det er samme feilklasse som `_`-etiketten** ryddet samme døgn: semantikk
  gjemt i en fritekst ingen kode kan spørre på, som hver flate må særhåndtere, og som forsvinner
  hvis noen redigerer teksten. Presedensen i `bibliotek.ts` er en observasjon, ikke et vedtak.
  **Hvorfor bolk 1 og ikke 2:** bolk 1 ER migreringsbolken. Med skjemaet ferdig der blir bolk 2
  ren UI — som var hele grunnen til delingen — og bolk 2 slipper en egen migreringsgate på test.
- **B3 HMS i fase 1:** ✅ **VEDTATT — HMS er med fra start.** Kundekravet nevner HMS eksplisitt.
  🔴 **DB-migreringen er dermed godkjent av Kenneth** (additive kolonner `subdomain` +
  `hmsSynlighet` på `OrganizationTemplate`) — han fikk konsekvensen forelagt før han svarte.
  Den følger to-stegs migrasjons-policyen: kun `ADD COLUMN`, ingen `DROP`, ingen NOT NULL i
  steg 1 ([CLAUDE.md § To-stegs migrations-policy](../../CLAUDE.md)).

## Ordre-rekkefølge etter godkjenning (til redesign-Opus, relayes av Kenneth)
1. `firmamal.*` tRPC-ruter + HMS-kolonner (additiv migrering) 2. Firma-arkivsiden 3. Promote-knapp + badges 4. Ny mal-dialogens kilder 5. Seeding-veien (F4) 6. Versjonering (F2). Ordren skal bære designlås-blokk, funksjonsinventar (rører modul.ts-seedingen) og klikk-budsjettet over.

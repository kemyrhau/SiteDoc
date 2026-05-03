---
name: domene-arbeidsflyt
description: Beskriver den virkelige arbeidsflyten i SiteDoc sett fra brukerens perspektiv.
  Dette er det styrende dokumentet for arkitektur-beslutninger — kode skal alltid kunne
  forklares tilbake til en arbeidsflyt beskrevet her.
status: under-utvikling
sist_oppdatert: 2026-05-03
sist_verifisert_mot_kode: 2026-05-03
---

# Domene-arbeidsflyt — SiteDoc

## Formål
Dette dokumentet beskriver hva SiteDoc faktisk gjør fra brukerens perspektiv.
Det er ikke et teknisk dokument — det er en beskrivelse av virkeligheten systemet skal støtte.
Alle arkitektur-beslutninger skal kunne forklares tilbake til en arbeidsflyt her.

---

## Aktører

| Aktør | Rolle | Primære behov |
|---|---|---|
| Ansatt (feltarbeider) | Utfører arbeid, registrerer | Enkel registrering, tilgang til prosjektinfo |
| Leder/Prosjektleder | Kontrollerer, attesterer, fordeler | Oversikt, godkjenning, rapportering |
| Byggherre | Mottar dokumentasjon, godkjenner | Godkjenning av endringer og leveranser |
| UE (underentreprenør) | Ansatt fra annet firma som arbeider på prosjektet | Tilgang til oppgaver/sjekklister, egne timer i eget firma |
| Firma-admin | Administrerer firma, moduler, brukere | Konfigurasjon, rapportering |
| sitedoc_admin | Systemadministrasjon på tvers av firmaer | Full oversikt alle firmaer |

---

## Arbeidsdag — Ansatt (feltarbeider)

### Morgen — planlegg dagen
1. **Kontrollplan** → sjekk hvilke sjekklister som skal utføres i dag
2. **Fremdriftsplan** → hva og hvor mye må gjøres i dag?
3. **Innboks** → har leder sendt oppgaver som skal utføres?

### Under arbeid — utfør og dokumenter
4. **Tegninger** → verifiser at arbeidet utføres på korrekt lokasjon
5. **Mapper** → les prosjektbeskrivelse og relevante dokumenter ved behov
6. **Sjekkliste** → dokumenter løpende etter hvert som punkter fullføres
7. **RUH/HMS-avvik** → registrer umiddelbart hvis avvik oppstår
8. **Oppgave fra leder** → utfør, ta bilde, skriv kort oppsummering, send tilbake

### Slutt av dag — registrer forbruk
9. **Dagsseddel** (eies av Timer-modulen):
   - Lønnsart per rad → hvilken type arbeid ble utført. Hver rad har **alltid prosjekt**, og kan i tillegg ha **ECO/Underprosjekt** som kostnadsbærer
   - Tillegg → mat og/eller reise
   - Maskin (hvis Maskin-modul aktiv) → hvilken maskin, antall timer/km
   - Vareforbruk (hvis Varelager-modul aktiv) → materialer brukt

### Oppfølging — se hva leder har gjort
10. **Timer-status** → se om leder har attestert, returnert eller flyttet timer

---

## Arbeidsflyt — Leder/Prosjektleder

### Timer-attestering
1. Mottar dagssedler fra ansatte
2. Kontrollerer timer
3. Kan **flytte timer** mellom prosjekt og ECO/tilleggsarbeid (timer-admin — **ikke bygget ennå**, planlagt som del av attestering-flyten)
4. Attesterer → dagsseddel låses (snapshot tas av pris/lønnsart per A.7)
5. Sender til:
   - **Økonomi** → lønnsutbetaling til ansatt
   - **ProAdm** → kostnad registreres per prosjekt

### Dokumentflyt
1. Sender oppgaver til ansatte
2. Mottar tilbake utfylte oppgaver med bilde og beskrivelse
3. Godkjenner eller returnerer

### Fordeling og oppfølging
4. Tildeler oppgaver/sjekklister via dokumentflyt
5. Følger med på «Hvem har ballen» — hvilke dokumenter venter på handling fra hvilken faggruppe (badge planlagt)
6. Genererer prosjekt-rapporter og månedsrapport (Fase 7)

---

## Arbeidsflyt — Byggherre

Byggherre er en faggruppe i prosjektets dokumentflyt — ikke en SiteDoc-bruker som standard.

### Tilgang
1. Inviteres til prosjektet som ekstern faggruppe-deltaker (`DokumentflytMedlem`)
2. Får tilgang via e-post-invitasjon (`ProjectInvitation`, 7 dagers token)
3. Logger inn via samme NextAuth-flyt som interne brukere — ser kun prosjekter de er invitert til

### Hovedhandlinger
4. **Mottar endringsmeldinger** (Godkjenning-dokumenttype) — tilleggsarbeid, regningsarbeid, varsel om avvik. Modell: `Godkjenning` (Fase 0 A.2 — **modell finnes, UI mangler**)
5. **Godkjenner eller avviser** → status-overgang `sent → approved | rejected`. Snapshot lagres på `DocumentTransfer.kostnadSnapshot` så historikk er låst
6. **Mottar månedsrapport / sluttrapport** (Fase 7) som ferdig PDF

### Begrensninger
- Byggherre ser ikke entreprenørens lønnsarter, internkostnader eller timesnapshot
- Byggherre kan ikke initiere oppgaver — kun godkjenne/avvise det entreprenør sender

---

## Arbeidsflyt — UE (underentreprenør)

UE er ansatt fra et annet firma enn prosjekteier. Eksempel: A.Markussen er prosjekteier (via `ProjectOrganization`), Bravida sender en elektriker som UE.

### Datamodell
1. UE-bruker har `User.organizationId = "Bravida"`, ikke A.Markussen
2. Bruker legges til som `ProjectMember` på prosjektet med `role = "underentreprenor"` (vedtatt, ikke bygget — Fase 0 A.9)
3. Faggruppe-tilknytning via `FaggruppeKobling` (Bravida-faggruppe på prosjektet)

### Hva UE ser
4. Tilgang til oppgaver og sjekklister tildelt deres faggruppe
5. Tegninger og mapper på prosjektet (per gruppe-tilgang)
6. **Egne timer registreres mot UE-firmaets katalog** — Bravida-bruker bruker Bravida-lønnsart, ikke A.Markussens
7. Kan referere ECO på prosjektet (kostnadsbærer er prosjekt-eid, ikke firma-eid)

### Eksport
8. Bravidas attesterte timer eksporteres til Bravidas regnskap (Tripletex/PowerOffice)
9. A.Markussen ser ingen timer eller priser fra Bravida (firma-isolering)

---

## Arbeidsflyt — Firma-admin

### Onboarding av nytt firma
1. Sitedoc_admin oppretter `Organization` + tildeler `User.role = "company_admin"` til kundens kontaktperson
2. Firma-admin logger inn → `/dashbord/firma/innstillinger` for å fylle inn firma-master (org.nr, faktura)
3. Firma-admin aktiverer firmamoduler (Timer, Maskin, Kompetanse) — i dag via `harTimerModul`/`harMaskinModul`-flag, fremtidig via `OrganizationModule`

### Konfigurasjon av firmamoduler
4. **Timer:** Velger Nivå 1 (lovpålagt grunnpakke) eller Nivå 1+2 (med bransje-relevant tilleggspakke), eller starter tom katalog (migrering fra annet system). Konfigurerer lønnsarter, aktiviteter, tillegg
5. **Maskin:** Importerer maskinregister (SmartDok-Excel) eller registrerer manuelt. Vegvesen-API beriker kjøretøy-data
6. **Kompetanse:** Definerer kompetansetyper (sertifikater, kurs, HMS-kort) + importerer ansatt-kompetanse (CSV/Excel)

### Bruker- og avdelings-administrasjon
7. Oppretter avdelinger (firma-intern organisatorisk inndeling)
8. Inviterer ansatte (e-post via Resend), tildeler rolle og avdeling
9. Kobler ansatte til prosjekter (`ProjectMember`)

### Onboarding av nytt prosjekt
10. Oppretter `Project` (manuelt eller via mal-bibliotek)
11. Kobler firma som prosjekteier (`ProjectOrganization` + `Project.primaryOrganizationId`)
12. Aktiverer prosjektmoduler per behov (sjekkliste/oppgave/PSI/3D/økonomi)
13. Konfigurerer faggrupper + dokumentflyt + brukergrupper + lokasjoner + tegninger

---

## Arbeidsflyt — Kontrollplan

### Oppsett
1. Firma-admin (eller prosjekt-admin) henter NS 3420-K-bibliotek-maler eller bygger egen kontrollplan
2. Kobler kontrollpunkter til faggrupper og lovkrav
3. Definerer kontrollmatrise (hvilke punkter gjelder hvilke områder/byggeplasser)

### Daglig bruk
4. Ansatt ser dagens kontrollpunkter i kontrollplan-vyen (filtrert på prosjekt/byggeplass)
5. Fullfører sjekklister koblet til kontrollpunkter
6. Status oppdateres på kontrollplan-matrisen i sanntid

### Avslutning
7. Sluttrapport genereres automatisk (PDF) når alle kontrollpunkter er kvittert ut
8. Byggherre mottar sluttrapport som dokumentasjon

---

## Arbeidsflyt — PSI-gjennomføring

PSI (Prosjektspesifikk Sikkerhetsinstruks) er distinkt fra sjekkliste — det er per-person sikkerhetsopplæring.

1. Bruker (eller besøkende) skanner QR-kode på byggeplassen
2. Leser PSI-innhold (lesetekst, bilder, video)
3. Tar quiz med riktige svar
4. Registrerer HMS-kortnummer (eller velger «har ikke HMS-kort» som gjest)
5. Signerer digitalt → `PsiSignatur` opprettes
6. Tilgang til byggeplassen registreres
7. **Fase 4 (planlagt):** PSI utvides med innsjekk/utsjekk-mekanikk + mannskaps-vy som aggregerer §15-liste-data

---

## Arbeidsflyt — Onboarding av ny ansatt

1. Firma-admin inviterer via e-post (eller bruker importeres via fremtidig HR-import-modul)
2. Ny bruker logger inn via Google/Microsoft OAuth — `User`-rad opprettes
3. `User.canLogin` styrer om brukeren kan logge inn (false = data-mottaker uten innlogging, for eldre arbeidere uten smarttelefon — Fase 0 A.10)
4. Firma-admin tildeler:
   - Avdeling
   - Rolle (`company_admin` eller `user`)
   - Kompetansematrise-rader (sertifikater, HMS-kort med utløpsdato — varsling 90/30/7 dager før utløp)
5. Prosjekt-admin kobler til prosjekt(er) via `ProjectMember` med rolle og kapabilitets-felter (`kanAttestere`, `erFirmaansvarlig`)
6. Pedagogisk onboarding-veileder (planlagt, se [onboarding-veileder.md](onboarding-veileder.md)) — sekvensiell første-gangs-flyt

---

## Dataflyten ut av SiteDoc

```
Attestert dagsseddel (snapshot låst per A.7)
├── → Økonomi (lønnsutbetaling til ansatt — Tripletex/Visma/PowerOffice)
└── → ProAdm (kostnad per prosjekt + ECO-referanse)
        ↓
    ProAdm sender tilbake (1×/døgn pull):
    ECO / Endringsmelding / Underprosjekt-katalog
        ↓
    Entreprenør oppretter Godkjenning-dokument med ECO-referanse
        ↓
    Byggherre godkjenner/avviser i SiteDoc
        ↓
    DocumentTransfer.kostnadSnapshot låser kostnaden
        ↓
    Godkjente endringer eksporteres til ProAdm som vedtatt tilleggsarbeid
```

**Skille mellom timer-eksport og kostnads-eksport:**
- **Timer (lønn):** Alle attesterte timer → ansatts firma sin lønnsutbetaling. Uavhengig av byggherre-godkjenning.
- **Kostnad (faktura):** Timer på prosjekt-grunnkontrakt = del av fastpris (ingen separat fakturering). Timer på ECO = krever byggherre-godkjenning før det blir fakturerbart.

---

## Modul-avhengigheter i dagsseddelen

Dagsseddelen er Timer-modulens kjernedokument, men utvides av andre moduler:

| Modul | Bidrag til dagsseddel | Forutsetning | Status |
|---|---|---|---|
| Timer (basis) | Lønnsart, tillegg, prosjekt/ECO-tilknytning per rad | Alltid tilgjengelig | ✅ Implementert (Fase 3 Runde 1A-2.7) |
| Maskin | `SheetMachine`-tabell, maskin brukt + timer/km | Maskin-modul aktivert (`harMaskinModul=true`) | ✅ Implementert (Runde 2.5/C9) |
| Varelager | Vareforbruk per dagsseddel (planlagt: `SheetMaterial`) | Varelager-modul aktivert | ❌ Ikke bygget (Fase 5) |
| Kompetanse | Validering av maskin-velger mot brukerens sertifikater (DO-kobling) | Maskin-modul + Kompetanse-data + Fase 6 | ❌ Ikke bygget (Fase 6) |

---

## Status på tidligere åpne spørsmål

### ✅ Q1: Kompetansematrise — kobling til dagsseddel?
**Svar:** Ikke implementert. Planlagt som **DO-kobling** (Fase 6 per arkitektur-syntese § 1.2): maskin-velger på dagsseddel valideres mot brukerens `AnsattKompetanse`-rader. Eksempel: bruker uten gyldig CAT 325-sertifikat kan ikke velge maskin merket med dette kravet. Bygges når Maskin + Timer er stabilisert og Kompetansetyper har felt for «kreves for maskinbruk».

### ✅ Q2: Timer-admin — BESLUTTET
Timer-admin (flytte timer prosjekt ↔ ECO) er en **egen attesteringsside for ledelse**
— ikke del av den ansattes dagsseddel-flyt. Leder har dedikert side der de kan:
- Se alle innsendte dagssedler per prosjekt
- Flytte timer-rader mellom prosjekt og ECO
- Attestere (låser via snapshot per A.7)

Side: `/dashbord/[prosjektId]/timer/attestering` (eksisterer delvis — utvides)

### ✅ Q3: Vareforbruk — BESLUTTET
Per dagsseddel. Bygges som `SheetMaterial`-tabell i `db-timer`
(samme cross-package-FK-mønster som `SheetMachine`).

### ✅ Q4: HMS hybrid — BESLUTTET
Hybrid: behold `domain="hms"` på Task/Checklist (datalag) + legg til
`ProjectModule`-rad `slug="hms"` for sidebar-synlighet.

Oppfølger: reconcile [arkitektur-syntese.md](arkitektur-syntese.md) vs [terminologi.md](terminologi.md) i neste screening-runde.

---

## Fremdeles åpne spørsmål

- [ ] Skal byggherre kunne logge inn med eksternt e-post-token (uten Google/Microsoft OAuth)?
- [ ] UE-rolle (`role="underentreprenor"`) — hvilke kapabiliteter skal være satt by-default?
- [ ] Onboarding-veileder pedagogisk lag — på toppen av navigasjon eller separat?

### Steg 1c-beslutninger (lukket 2026-05-03)

- [x] **1c Q1 — Per-prosjekt-toggle:** Auto-sync over alle firmaets prosjekter. Per-prosjekt av/på droppet — ingen kjent bruksmønster, ekstra kompleksitet uten gevinst.
- [x] **1c Q2 — Auto-opprett ved nytt prosjekt:** Application-side hook i `prosjekt.opprett` + `prosjekt.opprettTestprosjekt`. Henter brukerens `organizationId` + `har_*_modul`-flagg, oppretter ProjectModule-rader i samme `$transaction` som ProjectOrganization. Implementert.
- [x] **1c Q3 — `active Boolean`-felt på ProjectModule:** Utsatt til Steg 1d. Krever CI-grep for `projectId_moduleSlug`-callsites + ny composite unique-indeks `(projectId, organizationId, moduleSlug)` — uavhengig av OrganizationModule-overgangen.

---

## Prioritert byggerekkefølge

Vedtatt 2026-05-03. Basert på domene-analyse og arkitektur-avhengigheter.
Ingen steg kan hoppes over — hvert steg er forutsetning for neste.

### Steg 1 — Fundament (må på plass FØR sider bygges)

- [x] **1a. Organization.erKunde-felt** (~2-3t) — DEPLOYET TIL PROD 2026-05-03 (`c91d953c`)
  - Ny Boolean-kolonne `Organization.erKunde` (default false) + migrasjon `20260503000001_add_organization_er_kunde` med backfill
  - Heuristikk for backfill: `erKunde=true` hvis `har_maskin_modul` OR `har_timer_modul` OR finnes `Project.primary_organization_id` OR finnes `Avdeling`. `organization_settings` og `users` droppet som signaler (auto-upsert + testdata-misbruk)
  - Forhåndsverifisert mot test-DB (1 kunde: Byggeleder; 4 skall) og prod-DB (3 kunder: A.Markussen/HRP AS/Kenneths testmiljø; 0 skall)
  - Server: `organisasjon.hentTilgjengelige` filtrerer på `erKunde:true` for sitedoc_admin
  - Klient: `Firma`-type i `firma-kontekst.tsx` utvidet med `erKunde:boolean`

- [x] **1b. Firma-kontekst Lag 1+2+3** (~10-12t) — DEPLOYET TIL PROD 2026-05-03 (`045a49b7`)
  - Lag 1: 9 router-filer (~46 endepunkter) tar organizationId — påkrevd for write, valgfri med fallback for read-only katalog
  - Lag 2: 10 klient-sider sender valgtFirma.id
  - Lag 3: «Firmainnstillinger» → «Eier-firma» (avvik fra plan: «Prosjekteier» kolliderte med eksisterende parent-kategori)

- [x] **1c. OrganizationModule-overgang Fase A+B** (~5t) — DEPLOYET TIL PROD 2026-05-03 (`87fb7292` merge, `d581e399` Fase A+B + `6921ffea` mini-Fase C)
  - Fase A: bakfyll-migrasjon `20260503010000_steg_1c_module_backfill` + moduleGate-helpers utvidet med valgfri `projectId`-param
  - Fase B: auto-sync hooks i `prosjekt.opprett` + `prosjekt.opprettTestprosjekt` + ny `services/firmamodul.ts` + `organisasjon.settFirmamodul`-mutation + timer-onboarding-refaktor + `HovedSidebar` migrert til ProjectModule-sjekk
  - Mini-Fase C (kommentar-rens, 2026-05-03): `har_*_modul`-kolonnene beholdes som firma-master-bryter; full drop til `OrganizationModule`-tabell utsatt til Steg 1e (kreves for at firma uten prosjekter fortsatt kan onboarde lønnsarter — A.Markussen-flow ville brutt med rent ProjectModule-avledet aktivering)

- [x] **1d. ProjectModule final cleanup (forkortet)** (~30min) — IMPLEMENTERT 2026-05-03
  - Migrasjon `20260503020000_drop_project_module_active`: DROP COLUMN `active`. Verifisert via grep at 0 kode-callsites bruker `ProjectModule.active` (eneste treff er `Project.status`-enum, ulik modell).
  - Schema-rens i `schema.prisma`: `active Boolean`-feltet fjernet, kommentar oppdatert til endelig modell.
  - Cross-org-unique `(projectId, organizationId, moduleSlug)` flyttet til Steg 1e — krever konkret cross-org-design (oversettelse/PSI/kontrollplan har ikke meningsfull cross-org-aktivering, kun timer/maskin har).

- [ ] **1e. OrganizationModule-tabell + cross-org-aktivering** (~5-8t, fremtidig)
  - Egen tabell `(organizationId, moduleSlug, status)` for firma-master-aktivering
  - Erstatter `Organization.har_timer_modul`/`har_maskin_modul`-kolonnene
  - Bakfyll fra eksisterende flagg, drop kolonner, alle firma-bredte callsites bytter
  - Vurder samtidig: ProjectModule unique → `(projectId, organizationId, moduleSlug)` for slugs der cross-org gir mening (timer/maskin); behold `(projectId, moduleSlug)` for prosjektmoduler (oversettelse/PSI/kontrollplan/etc.) — krever distinksjon mellom firmamoduler og prosjektmoduler i schema/runtime
  - Tas når en av disse drivene oppstår: (a) flere enn 2 firmamoduler å spore, (b) behov for status-historikk per firma-modul, (c) konkret cross-org-policy med UE-firma som har egen Timer-katalog på samme prosjekt

### Steg 2 — Firma-admin-sider (bygges på solid fundament)

- [ ] **2a. Firmainformasjon** — navn, org.nr, faktura (read-only fra prosjekt)
- [ ] **2b. Firmamodul-styring** — Timer, Maskin, Kompetanse, Fremdrift (av/på)
- [ ] **2c. Firma/organisasjonsinnstillinger** — OrganizationSetting-UI
- [ ] **2d. Prosjekt → nytt prosjekt** — fra firma-kontekst

### Steg 3 — Maskin-import (med riktig firma-kontekst)

- [ ] **3a. Koble import til FirmaVelger** + erKunde-filter
- [ ] **3b. Fil-upload UI** — klikkbar drag-and-drop sone

### Steg 4 — Dagsseddel-utvidelser

- [ ] **4a. Timer-admin** — attestering med flytt prosjekt ↔ ECO (egen side for leder)
- [ ] **4b. Vareforbruk** — SheetMaterial-tabell i db-timer
- [ ] **4c. Godkjenning UI** — byggherre-flyt (modell finnes, UI mangler)

---

## Koblinger til tekniske dokumenter

| Arbeidsflyt-element | Teknisk dokument |
|---|---|
| Dagsseddel | [dagsseddel-design.md](dagsseddel-design.md) |
| Maskin-kobling | [maskin.md](maskin.md) |
| Mannskap-vy + PSI-utvidelser (Fase 4) | [mannskap.md](mannskap.md) |
| Kompetansematrise (kjerne, Fase 0.5 KOMPLETT) | Implementert i `packages/db` (`Kompetansetype` + `AnsattKompetanse`) — egen detalj-fil mangler |
| Timer-katalog (lønnsart/tillegg/aktivitet) | [timer.md](timer.md) |
| Dokumentflyt (oppgave/sjekkliste) | [dokumentflyt.md](dokumentflyt.md) |
| Godkjenning (byggherre-flyt) | [fase-0-beslutninger.md § A.2](fase-0-beslutninger.md) — modell finnes, UI mangler |
| ECO / Endringsmelding (Underprosjekt) | [fase-0-beslutninger.md § E.11](fase-0-beslutninger.md) |
| ProAdm-integrasjon | [okonomi.md](okonomi.md) |
| Kontrollplan + sluttrapport | [kontrollplan.md](kontrollplan.md) |
| PSI-gjennomføring | [terminologi.md § 8](terminologi.md) |
| HMS-kort + utløpsvarsel | [varsling.md](varsling.md) |
| Onboarding-pedagogikk | [onboarding-veileder.md](onboarding-veileder.md) |
| Prosjekt-oppsett-flyt | [prosjektoppsett-veileder.md](prosjektoppsett-veileder.md) |
| Navigasjons-struktur (innstillingssider) | [navigasjon-arkitektur-analyse-2026-05-03.md](navigasjon-arkitektur-analyse-2026-05-03.md) |
| Helhetlig produktarkitektur | [arkitektur-syntese.md](arkitektur-syntese.md) |
| Tre-nivå-anker (Firma → Firmaadmin → Prosjekter) | [terminologi.md § 0](terminologi.md) |

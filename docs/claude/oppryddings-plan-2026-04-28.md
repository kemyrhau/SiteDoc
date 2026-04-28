---
status: aktiv
opprettet: 2026-04-28
slettes: når alle TODO-punkter er kvitterte (siste avsjekk-runde nederst)
kilde: Bunke 3A.1-screening 2026-04-28 (forretningslogikk.md, okonomi.md, mobil.md, web.md, arkitektur-syntese.md)
---

# Oppryddings-plan etter Bunke 3A.1-screening

> 🟡 **Status:** Aktiv anker for oppryddings-arbeidet. Brukes som inngang for fremtidige sesjoner. Ikke commit annet enn det som er listet her uten Kenneth-godkjenning.

## Kontekst

Bunke 3A.1 (drift-screening 2026-04-28) avdekket mer drift og flere svakheter enn én sesjon kan håndtere. De viktigste funnene:

- **arkitektur-syntese.md har strukturell drift mot fase-0-beslutninger** (anker-fil — størst blast radius)
- **Faggruppe-rename er ufullstendig i 3 av 5 filer** (mobil.md, web.md, okonomi.md)
- **Race conditions ikke beskrevet** i auto-mottatt, import-konflikt, offline-sync, feltvis merge
- **3 nye TIMER-FUNN-kandidater** krever Kenneth-bekreftelse før registrering

Denne fila er strukturert i fem prioritets-nivåer + Parkert + Utenfor-scope. Anker-rensing først (P1), deretter rename-rensing (P2), drift-detaljer (P3), strukturelle drøftinger (P4), svakhet-reparering (P5).

Sannhetskilder: [fase-0-beslutninger.md](fase-0-beslutninger.md), [arkitektur.md](arkitektur.md), [terminologi.md](terminologi.md), [dokumentflyt.md](dokumentflyt.md), [timer-funn-fra-screening-2026-04-27.md](timer-funn-fra-screening-2026-04-27.md), CLAUDE.md.

---

## Dokument-samhandlings-lukking (Nivå 1-4)

> **Mål:** Lukke dokument-samhandlings-konflikter avdekket i utvidet sammenligningsanalyse 2026-04-28 (arkitektur-syntese.md vs 5 modul-filer + kode). Bruker CLAUDE.md § «Tre nivåer» (linje 407-427) som arkitektur-anker — etablert som styrende sannhetskilde 2026-04-28. Strekker seg over 5-7 sesjoner med compact mellom.
>
> **Status-konvensjon:** `[ ]` = ikke startet, `[x]` = ferdig, `[~]` = pågående. Krysser av etter hver commit. Mellom nivåer: pause for Kenneth-vurdering.

### Nivå 1 — Etabler anker (gjøres først)

- [x] **1A. Formell flagging av CLAUDE.md § Tre nivåer som arkitektur-sannhetskilde** — note tilføyet i CLAUDE.md som peker på treet som styrende referanse for modul-nivåer. Krysshenvisning fra § Dokumentasjons-disiplin. *(Utført 2026-04-28)*
- [ ] **1B. Verifiser anker mot kode** — sjekk at `ProjectModule` i kode (10 aktive moduler) matcher prosjektmoduler-listen i treet. Identifiser avvik (moduler i kode som ikke er i treet, eller motsatt). Rapport-leveranse, ingen handling før Kenneth har vurdert.

### Nivå 2 — Reconciliation av motsigelser mot anker

> Krever 1B fullført så vi vet anker er korrekt.

- [ ] **2A. C-1: Mannskap-modul-nivå** — `mannskap.md` sier «prosjektmodul», CLAUDE.md-anker sier firmamodul (HR/Mannskap). Handling: rens `mannskap.md` til å matche anker.
- [ ] **2B. C-2: PSI-arkitektur** — arkitektur-syntese § 3.4 sier PSI er firma-eid, CLAUDE.md-anker sier PSI er prosjektmodul. Handling: reconciliation — vurder om PSI har både firma- og prosjekt-aspekt, eller rett dokumentene mot anker. Kan kreve Kenneth-beslutning om PSI er hybrid.
- [ ] **2C. C-3: Mannskap/PSI separasjon** — arkitektur-syntese § 1.2 sier «slått sammen», CLAUDE.md-anker skiller dem. Handling: rens arkitektur-syntese § 1.2. Kan bakes med 2A eller 2B.
- [ ] **2D. C-4: Kompetanseregister-plassering** — `timer.md` mangler det, syntese sier det er del av Timer. Ikke nevnt i CLAUDE.md-anker. Handling: Kenneth-beslutning kreves (Timer-modul, egen modul, eller del av Mannskap?). Ingen commit nå — åpen beslutning.

### Nivå 3 — Innholds-rens av arkitektur-syntese

> Krever Nivå 1+2 fullført så syntesen kan utvides konsistent.

- [ ] **3A. Løft 8 manglende prinsipper til arkitektur-syntese** (NY-5):
  - § 3.8 Datadrevne kataloger og 3-nivå-onboarding
  - § 3.9 Snapshot-pattern ved attestering/assignment
  - § 3.10 Eksport-kode-policy (NULL → migrering 1:1)
  - § 6.5 Rate-limit-kö-mønster
  - § 7.4 Adapter-mønster (BilagsKilde, GPS, lønnssystem)
  - Onboarding-modi (nytt firma vs migrerer)
  - Cross-modul-konflikt-regler
  - Områder/soner-modell

  Verifiser hvert prinsipp mot kode før innskudd. Sannsynligvis 1-2 commits.
- [ ] **3B. STATUS.md tag-utvidelse for arkitektur-syntese.md** — oppdater kommentar-tag basert på faktisk dekning etter 3A. Kan bakes med 3A.

### Nivå 4 — Drift-rens (parallell, lav prioritet)

- [ ] **4A. NY-7: `Psi.eksternSystem`-felt + Fase 0 § E** — `Psi.eksternSystem`-utvidelsen må inn i fase-0 § E migrerings-rekkefølge.
- [ ] **4B. NY-8: Mannskap-modeller-status i fase-0 § E** — avklare når Mannskap-tabellene tas inn (Fase 4 eller delvis Fase 0?).

### Tidligere på agenda — adresseres separat

Følgende oppgaver er ikke del av Nivå 1-4-planen, men kan flettes inn i Nivå 3 hvor det gir mening:

- P-KRITISK-1: Sentralbibliotek-seed prod
- P-KRITISK-2: FtdChangeEvent-tabeller prod
- P-KRITISK-3: BibliotekMal 4 felt
- P1: anker-rensing arkitektur-syntese (5 inkonsistenser)
- P2: web.md/mobil.md/okonomi.md drift-rens

### Gjennomførings-mønster per nivå

For hver oppgave:
1. Beskriv handling med ord før utførelse
2. Verifiser mot kode der relevant
3. Vis FULL diff før commit
4. Vent på Kenneth-bekreftelse
5. Commit + push
6. Rapporter commit-hash

Mellom nivåer: pause for Kenneth-vurdering.

### Compact-strategi

Ved hver compact: bekreft hvor i listen vi er (sjekk `[~]`/`[x]`-merker), fortsett. Planen er lagret her i kodebasen som tilbakefall hvis samtale-historikk mistes.

---

## P0 — Strukturelt grunnlag (gjøres FØR P1)

> **Kjerneformål:** Vi trenger transparent status på hvilke `docs/claude/`-filer som er verifisert mot kode FØR Fase 0-koding starter. Avhengigheter mellom filer må være synlige slik at endring i fil X varsler om hvilke filer som er berørt. YAML-headeren leverer begge funksjoner distribuert. Sentralisert matrise-fil ble vurdert og forkastet 2026-04-28 — se § Utenfor scope.

### [ ] P0.1 — YAML-header-standard
- **Fil:** Standarden defineres i denne seksjonen; appliseres på alle filer i `docs/claude/`
- **Type:** Strukturell (etablering av meta-standard)
- **Fase-0-relevans:** Generell — standarden brukes i alle fremtidige rens-runder
- **TIMER-FUNN:** Ingen
- **Kompleksitet:** Lav (definisjon); fordeles over bunkene via P0.2

**YAML-skjema (godkjent 2026-04-28):**

```yaml
---
status: aktiv                              # aktiv | utdatert | arkivert | midlertidig
sist_verifisert_mot_kode: 2026-04-28        # ISO-dato; "ukjent" hvis aldri verifisert
sist_endret: 2026-04-28                     # ISO-dato; oppdateres ved hver content-endring
gjelder_versjon: Fase 0                     # Fase 0 | Fase 0.5 | Fase 1 | post-Fase 0 | tverrgående
avhenger_av:                                # Andre docs/claude/-filer denne forutsetter
  - terminologi.md
  - arkitektur.md
påvirkes_av_beslutninger:                   # A./B./C.-koder fra fase-0-beslutninger.md
  - A.4
  - B.7
slettes_når: <kriterium>                    # KUN på midlertidige filer; utelat på permanente
---
```

**Justeringer fra Del B-forslag (besluttet av Kenneth 2026-04-28):**
- `eier_modul` fjernet — dupliserer informasjon i `avhenger_av`
- `slettes_når` kun på midlertidige filer (utelat på permanente)
- Bunkevis retro-fylling — ikke big-bang (se P0.2)

**Plassering:** Øverst i filen, før første overskrift.

**Oppdaterings-regler:**

| Endring | Hva må oppdateres |
|---|---|
| Innholds-rens | `sist_endret` |
| Verifisert mot kode | `sist_verifisert_mot_kode` (og oftest `sist_endret`) |
| Ny avhengighet (referanse til annen fil) | `avhenger_av` |
| Ny beslutning som påvirker innhold | `påvirkes_av_beslutninger` |
| Modulfase endret | `gjelder_versjon` |
| Filen blir foreldet | `status` → `utdatert` (ikke slett umiddelbart) |
| Filen er ferdig brukt | `status` → `arkivert` + flytt til `docs/arkiv/` |

**Hard regel:** Hvis en agent endrer innhold uten å oppdatere `sist_endret` og/eller `sist_verifisert_mot_kode` — det er en feil og skal fanges av neste screening.

### [ ] P0.2 — Bunkevis retro-fylling
- **Fil:** Alle filer i `docs/claude/` uten YAML-header
- **Type:** Strukturell (retro-fylling)
- **Fase-0-relevans:** Generell
- **Kompleksitet:** Lav per fil; total kompleksitet høy (mange filer)

**Strategi (besluttet 2026-04-28 — alternativ B):** Header legges som del av første rens-PR per fil. Naturlig kontekst (agenten har allerede lest filen), én PR per fil, ingen separat header-etablerings-runde.

**For Bunke 3A.1-filer:**
- web.md, mobil.md, okonomi.md → header tilføyes som del av P2.1, P2.2, P2.3 (samme PR som faggruppe-rens)
- forretningslogikk.md → header tilføyes som del av P3.3 / P3.4 / P3.5-rens
- arkitektur-syntese.md → header tilføyes som del av P1.1 (anker-rensing)

**For filer ikke i Bunke 3A.1:** Header tilføyes som del av første screening-bunke som berører filen. Inntil header eksisterer, behandles filen som `status: aktiv`, `sist_verifisert_mot_kode: ukjent`. Agenter må eksplisitt verifisere mot kode før de stoler på innholdet.

**Filer som allerede har YAML-frontmatter (per 2026-04-28):**
- `timer-funn-fra-screening-2026-04-27.md` — egen frontmatter-stil (status/opprettet/slettes), bør migreres til standard ved første berøring
- `oppryddings-plan-2026-04-28.md` (denne) — samme

### [ ] P0.3 — Verifisert-mot-kode-register 2026-04-28
- **Fil:** Register dokumentert her; appliseres når fil-headere etableres per P0.2
- **Type:** Strukturell (sporbarhet)
- **Fase-0-relevans:** Direkte — Fase 0-koding må vite hvilke filer som er pålitelige
- **TIMER-FUNN:** Ingen
- **Kompleksitet:** Lav

**Følgende filer ble verifisert mot kode i Bunke 3A.1-screening 2026-04-28:**

| Fil | Drift identifisert |
|---|---|
| forretningslogikk.md | Byggeplan-rekkefølge motsigelse, Godkjenning-status, lestAv ved gruppe-mottaker |
| okonomi.md | 4 faggruppe-forekomster, FtdNotaComment mangler i tabell, ECO/Godkjenning-kobling mangler |
| mobil.md | 5 faggruppe-forekomster, Provider-tre-motsigelser (3 ulike) |
| web.md | 21 faggruppe-forekomster, ruter feil (`/entrepriser` → `/faggrupper`), API-navn feil |
| arkitektur-syntese.md | OrganizationModule-tabell vs ProjectModule-utvidelse, Avdeling-flagg vs tabell, Godkjenning «Eksisterer» feil |

**Når header etableres på disse filene (per P0.2-strategi), settes:**
```yaml
sist_verifisert_mot_kode: 2026-04-28
```

**Verifikasjonsgrunnlag:** Bunke 3A.1-rapporten (samtaleloggen i sesjonen 2026-04-28, ikke commitet som egen fil). Hvis Kenneth ønsker permanent register, kan rapporten arkiveres som egen fil i fremtidig commit. Ikke del av nåværende oppgave.

**Filer IKKE verifisert i Bunke 3A.1 (krever fremtidig screening):** Resten av `docs/claude/`-filer (timer.md, maskin.md, mannskap.md, planlegger.md, varsling.md, ai-sok.md, byggeplass-strategi.md, kontrollplan.md, infrastruktur.md, og flere). Header settes med `sist_verifisert_mot_kode: ukjent` ved første berøring inntil de screenes.

---

## P-KRITISK — Prod-blokkere fra utvidet verifikasjon (gjøres FØR P1)

> **Begrunnelse:** Utvidet verifikasjon av bibliotek.md og db-naming-audit-2026-04-25.md 2026-04-28 (per Sannhetskilde-prinsippets utvidelse «Verifisering betyr ikke bare at innhold samsvarer med kode, men også at koden er god») avdekket tre konkrete prod-blokkere. Disse er ikke doc-drift — de er empiriske kode/DB-state-feil med direkte produksjonskonsekvens. Ryddes FØR P1 anker-rensing.

### [ ] P-KRITISK-1 — Sentralbiblioteket er ikke seedet i prod (B-1)
- **Fil:** `packages/db/prisma/seed-bibliotek.ts` (12 maler i kildekoden) + bibliotek-tabellene i prod-DB
- **Type:** Empirisk prod-state-feil (deploy-mismatch)
- **Berører:** Prod-DB har 0 standarder, 0 kapitler, 0 maler. Test-DB har 6 av 12 maler (kun NS3420-K, ikke F). UI «Hent fra bibliotek» vil vise tomt panel for prod-brukere
- **Fase-0-relevans:** Indirekte — sentralbibliotek må fungere før funksjonalitet bygger på `ProsjektBibliotekValg`
- **TIMER-FUNN:** Ingen
- **Kompleksitet:** Lav (re-kjør seed) — men krever sjekk for eksisterende `ProsjektBibliotekValg` først (cascade-tap)
- **Åpne spørsmål:** Skal seed gjøres idempotent (upsert per `kode`/`referanse`) før re-kjøring? Anbefales for å unngå datatap ved fremtidige seed-kjøringer
- **Kilde:** Utvidet verifikasjon bibliotek.md 2026-04-28, funn B-1

### [ ] P-KRITISK-2 — FtdChangeEvent og FtdTnotaChangeLink-tabeller mangler i prod (B-8 / D-1)
- **Fil:** `packages/db/prisma/schema.prisma` linje 887 (FtdChangeEvent) og linje 907 (FtdTnotaChangeLink) + manglende migrasjon
- **Type:** Schema-migrasjon-mismatch
- **Berører:** Schema.prisma definerer modellene, men **ingen migrasjon i kildekoden** lager tabellene `ftd_change_events` / `ftd_tnota_change_links`. Test-DB har dem (sannsynligvis fra `prisma db push` eller manuell SQL). Prod-DB har dem IKKE (verifisert 2026-04-28). Spørringer mot disse modellene i prod vil kaste P2021 Prisma-error
- **Fase-0-relevans:** Ingen direkte (FTD-modul, ikke fase-0-fundament). Men **må ryddes før neste FTD-deploy til prod**
- **TIMER-FUNN:** Ingen direkte
- **Kompleksitet:** Medium — krever sammenligning av test-DDL vs prod-DDL for å bygge migration manuelt. Mistanke om at `prisma db push` ble brukt mot test og aldri formalisert
- **Åpne spørsmål:** Hvordan ble tabellene opprettet på test? Krever sporing av PR/commit/deploy-historikk for å forstå hvor migrasjonen ble glemt
- **Kilde:** Utvidet verifikasjon db-naming-audit 2026-04-28, funn B-8/D-1. Audit-fila § 5.3 flagget allerede avviket («bør verifiseres med ny query») — nå empirisk bekreftet

### [ ] P-KRITISK-3 — BibliotekMal mangler 4 fase-0-besluttede felt i schema (B-2)
- **Fil:** `packages/db/prisma/schema.prisma` linje 1200-1216 (BibliotekMal)
- **Type:** Drift mellom plan og kode (planlagt arbeid, ikke utført)
- **Berører:** Fase-0-beslutninger § E steg 8 lister `kategori`, `domene`, `kobletTilModul`, `verifisert` som planlagte felter. Verifisert 2026-04-28: feltene finnes IKKE i schema.prisma. Drift mellom plan og kode er reell. `bibliotek.ts importerMal` hardkoder `category: "sjekkliste"` / `domain: "kvalitet"` (linje 106-107) — vil bli erstattet av disse feltene
- **Fase-0-relevans:** Direkte — § E steg 8
- **TIMER-FUNN:** Ingen direkte
- **Kompleksitet:** Lav (én Prisma-migrasjon med defaults siden eksisterende rader finnes i test)
- **Åpne spørsmål:** Defaults for eksisterende rader — `kategori = "sjekkliste"`, `domene = "kvalitet"` (basert på dagens hardkoding), `kobletTilModul = null`, `verifisert = false`?
- **Kilde:** Utvidet verifikasjon bibliotek.md 2026-04-28, funn B-2. Note tilføyd i fase-0-beslutninger § E steg 8 i samme commit

---

## P1 — Anker-rensing (gjøres først)

> **Begrunnelse:** arkitektur-syntese.md er anker for Fase 0-koding per CLAUDE.md. Drift her påvirker neste code-instans direkte. Rens denne FØR Timer/Maskin-revurdering går videre.

### [ ] P1.1 — Erstatt `OrganizationModule` med `ProjectModule.organizationId`-utvidelse
- **Fil:** arkitektur-syntese.md
- **Type:** Drift-rens (strukturell rename)
- **Berører:** § 2.3 (linje ~114), § 4 (linje ~254), § 5 Fase 0 datamodell-liste, § 10 memory-oppdateringer
- **Fase-0-relevans:** A.4 (vedtatt — utvid `ProjectModule`, ikke ny tabell)
- **TIMER-FUNN:** Ingen direkte
- **Kompleksitet:** Lav (rename i én fil)
- **Åpne spørsmål:** Ingen — A.4 er låst

### [ ] P1.2 — Erstatt «Avdeling via flagg» med «Avdeling-tabell i Fase 0.5»
- **Fil:** arkitektur-syntese.md
- **Type:** Drift-rens (strukturell)
- **Berører:** § 1.3 firma-instillinger-tabell, § 4 «Manglende firma-modeller»-tabell, § 5 Fase 0 datamodell-liste
- **Fase-0-relevans:** C.11 (vedtatt — egen tabell, bygges i Fase 0.5)
- **TIMER-FUNN:** Indirekte (Avdeling brukes i Timer-eksport-filtrering — relevant for Funn 2 i TIMER-FUNN-fila)
- **Kompleksitet:** Lav
- **Åpne spørsmål:** Ingen — C.11 er låst

### [ ] P1.3 — Korriger status «Eksisterer» for `Godkjenning` og `EquipmentChecklist`
- **Fil:** arkitektur-syntese.md
- **Type:** Drift-rens (faktasjekk)
- **Berører:** § 1.1 KS-dokumentasjon-rad, § 3.6 maskin-koblede sjekklister-tabell
- **Fase-0-relevans:** A.2 (Godkjenning bygges Fase 0), Fase 1 (EquipmentChecklist bygges sammen med modul-gateway)
- **TIMER-FUNN:** Ingen direkte
- **Kompleksitet:** Lav
- **Åpne spørsmål:** Ingen

### [ ] P1.4 — Lukk intern motsigelse Fase 0.5 «Tre åpne prinsipper»
- **Fil:** arkitektur-syntese.md
- **Type:** Drift-rens (intern konsistens)
- **Berører:** § 5 Fase 0.5-seksjon (default-byggeplass listet som både åpent OG besluttet)
- **Fase-0-relevans:** Ingen direkte (Fase 0.5-tema)
- **TIMER-FUNN:** Ingen
- **Kompleksitet:** Lav
- **Åpne spørsmål:** Hvor mange av de tre prinsippene er faktisk besluttet? Krever lesing av byggeplass-strategi.md for å avklare

### [ ] P1.5 — Synk multi-firma-bruker (§ 2.5) med B.7 Modell A
- **Fil:** arkitektur-syntese.md
- **Type:** Drift-rens (presiser med referanse til vedtak)
- **Berører:** § 2.5 «Multi-firma-bruker | Ikke prioritert — duplikat User per firma som default»
- **Fase-0-relevans:** B.7 (vedtatt 2026-04-27 — Modell A: én User per person×firma med reaktivering)
- **TIMER-FUNN:** Ingen
- **Kompleksitet:** Lav
- **Åpne spørsmål:** Ingen

### [ ] P1.6 — Verifiser § 11 referanse-lenker
- **Fil:** arkitektur-syntese.md
- **Type:** Drift-rens (lenke-sjekk)
- **Berører:** § 11 Referanser-liste (mistenkt brutt: `arkitektur-oppsummering-2026-04-25.md`)
- **Fase-0-relevans:** Ingen
- **TIMER-FUNN:** Ingen
- **Kompleksitet:** Lav
- **Åpne spørsmål:** Hvis brutt — slett lenken eller opprett filen

### [ ] P1.7 — Erstatt § 5 byggeplan med peker til fase-0-beslutninger § E
- **Fil:** arkitektur-syntese.md
- **Type:** Strukturell (én sannhet for migrasjons-rekkefølge)
- **Berører:** § 5 Fase 0 datamodell-liste (egen liste i dag, drifter mot § E sin 13-stegs rekkefølge)
- **Fase-0-relevans:** § E i fase-0-beslutninger er sannhetskilde
- **TIMER-FUNN:** Ingen direkte
- **Kompleksitet:** Medium (vurder om hele § 5 omstruktureres)
- **Åpne spørsmål:** Skal § 5 beholdes som høy-nivå-oversikt og § E være detalj, eller skal § 5 erstattes helt?

---

## P2 — Faggruppe-rename-rens (kode-doc-synkronisering)

> **Begrunnelse:** Faggruppe-rename er gjennomført i kode (test+prod april 2026). Doc-drift gir feil mental modell for ny utvikling. Bør ryddes systematisk.

### [ ] P2.1 — Systematisk faggruppe-rename i web.md
- **Fil:** web.md (**21 reelle drift-forekomster, verifisert 2026-04-28**)
- **Type:** Drift-rens (rename + rute-fakta) + header-etablering per P0.2
- **Berører — komplett linjenummer-liste:**
  - Linje 44: `/dashbord/[prosjektId]/entrepriser` — rute heter `faggrupper/` (verifisert)
  - Linje 65: `/dashbord/oppsett/produksjon/entrepriser` — rute heter `kontakter/` (verifisert)
  - Linje 178: `EntrepriserPanel` — komponent heter `FaggrupperPanel.tsx` (verifisert)
  - Linje 187: `Bestiller-entreprise … (showEnterprise)` — schema-felt heter `showFaggruppe` (`schema.prisma:468`)
  - Linje 193: `Entreprise-dropdown … brukerens entrepriser (hentMineEntrepriser)` — API heter `medlem.hentMineFaggrupper`
  - Linje 198: `Bestiller-entreprise: Første fra hentMineEntrepriser`
  - Linje 199: `Utfører-entreprise: Utledes fra dokumentflyt … bestiller-entreprisen`
  - Linje 220: kolonne-tabell `Prefix, …, Entrepriser, Mal, Datoer`
  - Linje 227: `responderEnterprise` (0 treff i kode — ren prosa-drift)
  - Linje 256: `(entreprise først, deretter person/gruppe …)`
  - Linje 261: `Data: dokumentflyt.medlemmer med … enterprise, projectMember, group` — relasjon heter `faggruppe` i Prisma
  - Linje 272: `[Send ▾] (entrepriser + send tilbake)`
  - Linje 278: `Primærmottaker (entreprisenavn fra byggVideresendValg())`
  - Linje 280: `Separator + andre entrepriser (videresend)`
  - Linje 291: `entrepriseIder` — API returnerer `faggruppeIder` (`gruppe.ts:76`)
  - Linje 293: `utforerEnterpriseId` — schema-felt heter `utforerFaggruppeId` (`schema.prisma:515`)
  - Linje 381: `bestillerEnterprise.projectId` — relasjon heter `bestillerFaggruppe` (`schema.prisma:585`)
  - Linje 759: `(ikke entreprise)`
  - Linje 760: `Dokumentflyt kobles til entreprise via forvalgtEntrepriseId`
  - Linje 761: `Entrepriser fjernet fra sidebar`
  - Linje 763: `Entreprise fargevelger` (overskrift)
- **I tillegg (ikke i 21-tellingen):** «Feltarbeid» → «Produksjon» (linje 487), `produksjon/mapper` vs `produksjon/box` (linje 73 — avklar faktisk navn ved start av PR)
- **Header (per P0.2):** Tilføy YAML-frontmatter i samme PR. Sett `sist_verifisert_mot_kode: 2026-04-28`, `påvirkes_av_beslutninger: [A.8]`
- **Fase-0-relevans:** A.8 (faggruppe-terminologi låst)
- **TIMER-FUNN:** Ingen
- **Kompleksitet:** Medium (21 forekomster + tilleggsfunn + header)
- **Åpne spørsmål:** Linje 73 — `produksjon/mapper` vs `produksjon/box`: kjør `ls apps/web/src/app/dashbord/oppsett/produksjon/` ved start av PR for å avklare
- **Anbefaling:** Egen avgrenset bunke «P2.1: faggruppe-rename i web.md» med eksplisitt scope

### [ ] P2.2 — Faggruppe-rename i mobil.md
- **Fil:** mobil.md (**5 reelle drift-forekomster, verifisert 2026-04-28**)
- **Type:** Drift-rens + header-etablering per P0.2
- **Berører — komplett linjenummer-liste:**
  - Linje 14: `Entreprise: Auto-velges hvis bruker kun er i 1 entreprise`
  - Linje 46: `received/in_progress/rejected | [Send ▾] (ActionSheet med entrepriser)`
  - Linje 51: `Send-dropdown: primærmottaker, …, videresend til andre entrepriser`
  - Linje 72: `Auto-fill: …, company→entreprise, drawing_position→…`
  - Linje 413: `Dokumentflyt-filtrering: kun entrepriser med flyt for valgt mal`
- **Header (per P0.2):** Tilføy YAML-frontmatter. Sett `sist_verifisert_mot_kode: 2026-04-28`, `påvirkes_av_beslutninger: [A.8]`
- **Fase-0-relevans:** A.8
- **TIMER-FUNN:** Ingen
- **Kompleksitet:** Lav
- **Åpne spørsmål:** Ingen

### [ ] P2.3 — Faggruppe-rename i okonomi.md
- **Fil:** okonomi.md (**4 reelle drift-forekomster, verifisert 2026-04-28**)
- **Type:** Drift-rens + header-etablering per P0.2
- **Berører — komplett linjenummer-liste:**
  - Linje 36: `entreprise-velger.tsx # Dropdown for entrepriser` — filnavn er `faggruppe-velger.tsx` (verifisert)
  - Linje 60: `Container for økonomi-dokumenter per entreprise`
  - Linje 62: `Relasjon til byggeplass, entrepriser, dokumenter, mapper, notaPerioder`
  - Linje 167: `Slett kontrakt (kaskade, fjern fra entrepriser/dokumenter)`
- **Header (per P0.2):** Tilføy YAML-frontmatter. Sett `sist_verifisert_mot_kode: 2026-04-28`, `påvirkes_av_beslutninger: [A.8]`
- **Fase-0-relevans:** A.8
- **TIMER-FUNN:** Ingen
- **Kompleksitet:** Lav
- **Åpne spørsmål:** Ingen

---

## P3 — Drift-detaljer (mindre alvorlig)

> **Begrunnelse:** Hvert punkt er lite, men kumulativt påvirker mental modell. Ryddes når P1+P2 er ferdig.

### [ ] P3.1 — Tilføy `FtdNotaComment` til okonomi.md Database-modeller
- **Fil:** okonomi.md
- **Type:** Drift-rens (manglende modell)
- **Berører:** «Database-modeller»-seksjon (sier 11 modeller, faktisk 13 i schema)
- **Fase-0-relevans:** Ingen
- **Kompleksitet:** Lav

### [ ] P3.2 — Presiser at `DraggableModal` er inline-funksjon
- **Fil:** okonomi.md (linje 225)
- **Type:** Drift-rens (faktasjekk)
- **Berører:** «Nota-forside modal er flyttbar — dra i header-baren (DraggableModal)» — bør presiseres at funksjonen er inline i `okonomi/page.tsx:1166`, ikke separat komponent
- **Fase-0-relevans:** Ingen
- **Kompleksitet:** Lav

### [ ] P3.3 — Synk byggeplan-rekkefølge mellom forretningslogikk.md og arkitektur-syntese.md
- **Filer:** forretningslogikk.md (linje 256–266), arkitektur-syntese.md § 5
- **Type:** Drift-rens (intern konsistens på tvers av filer)
- **Berører:** Forretningslogikk sier «Maskin → Varsling → Timer → Mannskap → Planlegger», arkitektur-syntese sier «Fase 1 Maskin → Fase 2 Mal-promotering → Fase 3 Timer → Fase 4 Mannskap → Fase 5 Varelager → Fase 6 Avansert → Fase 7 Prosjekthotell-utvidelser inkl. Varsling»
- **Fase-0-relevans:** Ingen direkte (post-Fase 0)
- **TIMER-FUNN:** Indirekte (rekkefølge påvirker når Timer kan bygges)
- **Kompleksitet:** Lav (én av filene må vinne)
- **Åpne spørsmål:** Hvilken rekkefølge gjelder? Krever Kenneth-svar (se P4.6)

### [ ] P3.4 — Marker `Godkjenning` som «vedtatt, bygges i Fase 0» i forretningslogikk.md
- **Fil:** forretningslogikk.md (linje 80)
- **Type:** Drift-rens (presiser status fra «planlagt» til «vedtatt»)
- **Berører:** Tabell «Sjekkliste, Oppgave, Godkjenning (planlagt), SHA-avvik (planlagt)»
- **Fase-0-relevans:** A.2
- **Kompleksitet:** Lav

### [ ] P3.5 — Verifiser «Workflow/WorkflowStepMember beholdt i DB»
- **Fil:** forretningslogikk.md (linje 71–74 «Bakoverkompatibilitet»)
- **Type:** Drift-rens (faktasjekk mot schema)
- **Berører:** Hvis tabellene er fjernet, slett seksjonen
- **Fase-0-relevans:** Ingen
- **Kompleksitet:** Lav

### [ ] P3.6 — Flytt «ALDRI flytt TreDViewerProvider tilbake»-regel til CLAUDE.md
- **Fil:** web.md (linje 586–601), CLAUDE.md (Viktige regler-seksjon)
- **Type:** Strukturell (regel-nivå-løft)
- **Berører:** 3D-viewer-isolering er kritisk arkitekturbeslutning — bør være i CLAUDE.md som regel, ikke gjemt i web.md
- **Fase-0-relevans:** Ingen
- **Kompleksitet:** Lav

### [ ] P3.7 — Konsolider Provider-hierarki i mobil.md
- **Fil:** mobil.md (linje 167, 207, 357 — tre ulike rekkefølger)
- **Type:** Drift-rens (intern konsistens)
- **Berører:** Auth/Spraak/Prosjekt/Database/Byggeplass-providers — én sann diagram
- **Fase-0-relevans:** Ingen
- **Kompleksitet:** Medium (krever lesing av faktisk Provider-tre i `apps/mobile/`)
- **Åpne spørsmål:** Hvilken rekkefølge brukes faktisk i `apps/mobile/src/providers/`? (les koden)

### [ ] P3.8 — Marker mobil.md TODO-er med dato/status
- **Fil:** mobil.md (linje 182, 351–354)
- **Type:** Drift-rens (TODO-housekeeping)
- **Berører:** «TODO: implementer pivot-logikk i `kallOversettelsesServer()`», «Gjenstår: Oppgaver: API-ruten `oppgave.hentForProsjekt` mangler `buildingId`-filter»
- **Fase-0-relevans:** Ingen
- **Kompleksitet:** Lav (verifiser om TODOene fortsatt er åpne)

### [ ] P3.9 — Avklar `produksjon/mapper` vs `produksjon/box`
- **Fil:** web.md (linje 73)
- **Type:** Drift-rens (faktasjekk)
- **Berører:** web.md sier «`/dashbord/oppsett/produksjon/mapper`» — kode har `produksjon/box/`. Avklar om internt rute-rewrite finnes
- **Fase-0-relevans:** Ingen
- **Kompleksitet:** Lav

---

## P4 — Strukturelle Kenneth-drøftinger

> **Begrunnelse:** Disse er ikke drift, men reelle designspørsmål som krever Kenneth-beslutning før dokumentasjonen kan rettes.

### [ ] P4.1 — Skal FtdKontrakt.byggherre/entreprenor bli FK til ProjectOrganization?
- **Fil:** okonomi.md (Database-modeller § FtdKontrakt)
- **Type:** Strukturell drøfting
- **Berører:** Datamodell-design — i dag fritekst-felter, fase-0 § E steg 3 introduserer `ProjectOrganization` med `rolle` (hovedeier/byggherre/konsulent/underentreprenor)
- **Fase-0-relevans:** A.5 (ProjectOrganization-rename + rolle)
- **TIMER-FUNN:** Indirekte (relevant for ProAdm-eksport-flyt)
- **Kompleksitet:** Høy (DB-migrasjon + UI-konsekvenser)
- **Åpne spørsmål:** Hvis ja — hvordan håndteres legacy-rader uten matchende Organization?

### [ ] P4.2 — Skal autobudsjettoppdatering >50% trigge Activity-rad?
- **Fil:** okonomi.md (linje 254 «Viktige mønstre»)
- **Type:** Svakhet-reparering + Kenneth-drøfting
- **Berører:** Audit-spor for masse-overskriving av budsjett-poster
- **Fase-0-relevans:** A.3 (Activity-tabell)
- **TIMER-FUNN:** Ingen direkte
- **Kompleksitet:** Medium
- **Åpne spørsmål:** Ja — anbefales av screening, men ikke besluttet

### [ ] P4.3 — Hvordan modelleres Firma-HMS-rolle? (User.role utvidelse vs egen tabell)
- **Fil:** arkitektur-syntese.md § 4 punkt 9, § 2.2 Lag 5b
- **Type:** Strukturell drøfting (Fase 0-prerequisite)
- **Berører:** Datamodell-valg — utvider User.role-enum eller egen `OrganizationRole`-tabell
- **Fase-0-relevans:** Påvirker tilgangskontroll i Fase 0
- **TIMER-FUNN:** Ingen direkte
- **Kompleksitet:** Medium
- **Åpne spørsmål:** Bør avklares før Fase 0-koding starter

### [ ] P4.4 — Hvordan håndterer modul-gateway byggeplass-scope før Fase 0.5?
- **Fil:** arkitektur-syntese.md § 2.3 (Steg 4 «prosjekt/byggeplass-scope»)
- **Type:** Strukturell drøfting
- **Berører:** modulProcedure-implementasjon — byggeplass-medlemskap finnes ikke før Fase 0.5
- **Fase-0-relevans:** Påvirker tRPC-wrappers
- **Kompleksitet:** Medium
- **Åpne spørsmål:** Faller tilbake til prosjekt-scope i Fase 0?

### [ ] P4.5 — Avklar `lestAvMottakerVed`-mekanikk for gruppe-mottaker
- **Fil:** forretningslogikk.md (linje 39), dokumentflyt.md
- **Type:** Strukturell drøfting (manglende spec)
- **Berører:** Når `recipientGroupId` er satt (ikke `recipientUserId`), hvilken person utløser «Lest»?
- **Fase-0-relevans:** Ingen direkte
- **Kompleksitet:** Lav
- **Åpne spørsmål:** Første person i gruppen som åpner? Ledelsens leder? Aldri (kun når person-mottaker)?

### [ ] P4.6 — Hvilken byggeplan-rekkefølge gjelder? (forretningslogikk vs arkitektur-syntese)
- **Filer:** forretningslogikk.md, arkitektur-syntese.md, CLAUDE.md
- **Type:** Strukturell drøfting (én sannhet)
- **Berører:** Varsling-modul-plassering (Fase 5 i forretningslogikk vs Fase 7 i arkitektur-syntese), Mal-promotering-plassering, Varelager
- **Fase-0-relevans:** Ingen direkte (post-Fase 0)
- **TIMER-FUNN:** Indirekte
- **Kompleksitet:** Lav (én avgjørelse, må reflekteres tre steder)
- **Åpne spørsmål:** Hvilken rekkefølge ønsker Kenneth?

### [ ] P4.7 — Skal web.md splittes i web-ruter.md + web-arkitektur.md?
- **Fil:** web.md (768 linjer)
- **Type:** Strukturell drøfting
- **Berører:** Vedlikeholdsbyrde — én stor fil drifter raskere enn to fokuserte
- **Fase-0-relevans:** Ingen
- **Kompleksitet:** Medium (splitting + indeks-oppdatering)
- **Åpne spørsmål:** Foretrekker Kenneth én oversiktlig fil eller to spesialiserte?

---

## P5 — Svakhet-reparering (race conditions, edge cases)

> **Begrunnelse:** Ikke kritisk i dag (kunder bruker ikke disse i prod ennå), men bør designes inn i Fase 0-implementasjon.

### [ ] P5.1 — Race på auto-mottatt (`sent → received`)
- **Fil:** forretningslogikk.md (linje 56), dokumentflyt.md
- **Type:** Svakhet-reparering
- **Berører:** To ledere åpner samme dokument samtidig — begge utløser `received`?
- **Fase-0-relevans:** Ingen direkte
- **Kompleksitet:** Lav (dokumenter mutation-guard)

### [ ] P5.2 — Import-konflikt-håndtering (samme `(kontraktId, periodeNr)`)
- **Fil:** okonomi.md (linje 246)
- **Type:** Svakhet-reparering (UX-spec)
- **Berører:** Hvilken feilmelding får brukeren? Retry-mekanisme?
- **Fase-0-relevans:** Ingen
- **Kompleksitet:** Lav

### [ ] P5.3 — Audit-spor ved autobudsjett-overskriving
- **Fil:** okonomi.md
- **Type:** Svakhet-reparering
- **Berører:** Se P4.2 (krever Kenneth-beslutning først)
- **Fase-0-relevans:** A.3
- **Kompleksitet:** Medium

### [ ] P5.4 — UI-flyt for `gapFlagg` (manglende mellomperioder)
- **Fil:** okonomi.md (linje 86)
- **Type:** Svakhet-reparering
- **Berører:** «krever bruker-godkjenning» (linje 191) — ingen UI-flyt beskrevet
- **Fase-0-relevans:** Ingen
- **Kompleksitet:** Lav

### [ ] P5.5 — Offline-sync race (server-wins per A.22, pending edits-modal per A.23)
- **Fil:** mobil.md (linje 195)
- **Type:** Svakhet-reparering (synk med fase-0-vedtak)
- **Berører:** Konflikt-håndtering ved samtidig redigering offline + online
- **Fase-0-relevans:** A.22 (server-wins), A.23 (pending edits-modal Fase 3)
- **TIMER-FUNN:** Indirekte (timer-rader er offline-førlig)
- **Kompleksitet:** Lav (dokumentasjons-oppdatering — implementasjon i Fase 3)

### [ ] P5.6 — Sesjon-rotasjon-recovery ved nettverksbrudd
- **Fil:** mobil.md (linje 213)
- **Type:** Svakhet-reparering
- **Berører:** Klient har gammel token, server har ny — hvordan recover?
- **Fase-0-relevans:** Ingen direkte
- **Kompleksitet:** Medium (kan kreve kode-endring, ikke bare doc)

### [ ] P5.7 — Fragment-cache invalidation ved partiell oppdatering
- **Fil:** mobil.md (linje 248–255)
- **Type:** Svakhet-reparering (edge case)
- **Berører:** IFC-fragments cached i `sitedoc-fragments/` — hva ved gradvis modell-oppdatering?
- **Fase-0-relevans:** Ingen
- **Kompleksitet:** Lav (kanskje ikke et reelt problem i dag)

### [ ] P5.8 — WebSocket token-fornyelse ved sesjonsrotasjon
- **Fil:** web.md (linje 622–639)
- **Type:** Svakhet-reparering
- **Berører:** Auth via `?token=...` i URL — token-rotasjon mellom join og reconnect
- **Fase-0-relevans:** Ingen direkte
- **Kompleksitet:** Medium

### [ ] P5.9 — Feltvis merge ved nye nøkler (repeater-rader)
- **Fil:** web.md (linje 612–619)
- **Type:** Svakhet-reparering
- **Berører:** Samtidig opprettelse av samme repeater-rad — `{ ...eksisterende, ...input.data }` kan miste én side
- **Fase-0-relevans:** Ingen direkte
- **Kompleksitet:** Medium

### [ ] P5.10 — Tabelloppsett JSON-migrering ved schema-endring
- **Fil:** web.md (linje 235)
- **Type:** Svakhet-reparering (langsiktig vedlikehold)
- **Berører:** `User.tabelloppsett` JSON — hva ved nytt felt-format?
- **Fase-0-relevans:** Ingen
- **Kompleksitet:** Lav

---

## TIMER-FUNN-kandidater (krever Kenneth-bekreftelse før registrering)

> Disse er identifisert i Bunke 3A.1, men IKKE lagt inn i [timer-funn-fra-screening-2026-04-27.md](timer-funn-fra-screening-2026-04-27.md) ennå. Kenneth bestemmer om de skal registreres som Funn 7/8/9.

### [ ] T-K1 — Økonomi → Godkjenning → ECO → ProAdm-integrasjons-spec mangler
- **Filer berørt:** okonomi.md, fase-0-beslutninger.md, timer.md
- **Beskrivelse:** A.1 (ECO) og A.2 (Godkjenning) er konseptuelt designet, men hvordan FtdSpecPost/FtdNotaPost kobler til ECO og Godkjenning er ikke spesifisert. Tre moduler, ingen integrasjons-spec.
- **Implikasjon:** Timer registrerer mot ECO, Godkjenning genererer kostnad mot byggherre, FTD aggregerer i nota — men dataflyten mellom dem mangler design.
- **Anbefaling:** Drøftes i Timer-revurdering eller etterfølgende Økonomi-revurderings-runde.
- **Spørsmål til Kenneth:** Skal dette registreres som Funn 7 i TIMER-FUNN-fila?

### [ ] T-K2 — Mobil-UI for timer-attestering ikke designet
- **Filer berørt:** mobil.md, timer.md
- **Beskrivelse:** Dagsseddel + attestering er beskrevet i timer.md, men mobil-UI for timer-flyt (hovedinngang for arbeider) er ikke i mobil.md. Dokumentasjons-hull mellom de to filene.
- **Implikasjon:** Når Timer Fase 3 starter, mangler mobil-UI-design.
- **Anbefaling:** Tas i Timer-revurdering.
- **Spørsmål til Kenneth:** Skal dette registreres som Funn 8?

### [ ] T-K3 — «godkjenningsflyt» i arkitektur-syntese § 1.2 krasjer med A.8
- **Fil:** arkitektur-syntese.md § 1.2 («Timer | Dagsseddel, lønnsarter, arbeidstidskalender, Kompetanseregister, godkjenningsflyt»)
- **Beskrivelse:** A.8 låser «attestering» for Timer og «godkjenning» for Dokumentflyt. Bruken av «godkjenningsflyt» i Timer-rad er feil terminologi.
- **Implikasjon:** Mindre, men prinsipiell. Kan løses som del av P1-anker-rensing.
- **Anbefaling:** Rettes som del av P1.7 (eller egen liten rens-PR).
- **Spørsmål til Kenneth:** Trengs egen TIMER-FUNN-rad, eller fanges av P1?

---

## Parkert (ikke prioritert nå)

### [ ] PARKERT-1 — GPS-fallback-policy i Mannskap-flyter (§15-liste)
- **Fil:** mobil.md
- **Begrunnelse:** Mannskap er Fase 4 — ikke aktuelt før modulen designes
- **Re-vurder når:** Mannskap-modul-runde startes

### [ ] PARKERT-2 — Timer-prototype-rute-dokumentasjon
- **Fil:** web.md (mangler omtale av `apps/web/src/app/dashbord/[prosjektId]/timer/`)
- **Begrunnelse:** Prototypen slettes når Timer Fase 3 bygges (per CLAUDE.md). Ingen verdi i å dokumentere demo-kode.
- **Re-vurder når:** Aldri (utgår med prototype-sletting)

### [ ] PARKERT-3 — ProAdm-import backoff-strategi
- **Fil:** arkitektur-syntese.md § 7.1
- **Begrunnelse:** ProAdm-integrasjon avventer designpartner-status. Detaljer avgjøres når faktisk integrasjon planlegges.
- **Re-vurder når:** ProAdm-integrasjons-runde starter

---

## Fremtidig arbeid (registrert under konsolidering)

> Modul-planer som har dukket opp under konsolideringssesjonen 2026-04-28. Dokumentert nå (per sannhetskilde-prinsippet) for å bevare beslutningsgrunnlag. Implementasjon planlagt etter Fase 0.

### [ ] Onboarding-veileder for firma
- **Fil:** [onboarding-veileder.md](onboarding-veileder.md) (opprettet 2026-04-28)
- **Status:** Idé-stadium, ikke startet
- **Tidshorisont:** ~1 måned frem (post-Fase 0)
- **Innhold:** Sekvensiell logikk (6 steg: tilgang → grupper → dokumentflyt → sjekkliste/oppgave → byggeplass → tegninger), idempotens-krav (kunne kjøres på nytt uten datatap), pedagogisk lag (forklaringer av hvorfor rekkefølge er kritisk)
- **Avhengigheter:** ProjectGroup, Dokumentflyt, ReportTemplate (eksisterende); Byggeplass (Fase 0.5)
- **Åpne spørsmål:** Wizard-state-strategi (DB vs UI-detection); delvis-fullført-håndtering; målgruppe (firma-admin vs sluttbrukere)

---

## Utenfor scope (kun rapportering)

> Disse er flagget i screening eller drøfting, men løses IKKE som del av denne planen.

- **`entreprise: faggruppeRouter`-alias i `apps/api/src/trpc/router.ts:36`** — dødt alias (0 mobil-kall verifisert). Kan ryddes ved fremtidig mobil-deploy-syklus, men er ikke skadelig nå.
- **Andre filer i `apps/web/src/components/mengde/`-mappen** — ikke screenet i Bunke 3A.1. Kan inneholde lignende drift; egen runde hvis ønsket.
- **Annen dokumentasjon i `docs/claude/`** — Bunke 3A.1 dekket kun 5 filer. Resterende filer (timer.md, maskin.md, mannskap.md, planlegger.md, varsling.md, ai-sok.md, etc.) kan ha tilsvarende drift. Egne screening-bunker.
- **Sentralisert matrise-fil (`dokument-matrise.md`)** — VURDERT OG FORKASTET 2026-04-28. Begrunnelse: Header-feltene `avhenger_av` og `påvirkes_av_beslutninger` (P0.1) gir samme funksjon distribuert, uten sentralisert vedlikeholds-byrde. Reverse-lookup («hvilke filer påvirkes av A.4?») løses med grep: `grep -l "A.4" docs/claude/*.md`. Hvis sentralisert oversikt savnes senere — vurder script som genererer matrise fra header-data automatisk; aldri manuelt vedlikeholdt fil.

---

## Avsjekk-prosedyre (slettes-når)

Denne fila kan slettes når:

1. ✅ **Alle P1-punkter er kvitterte** (anker-rensing) — minimum-krav før Fase 0-koding
2. ✅ **Alle P2-punkter er kvitterte** (faggruppe-rename ferdig)
3. ✅ **Alle P3-punkter er kvitterte** (drift-detaljer ryddet)
4. ✅ **Alle P4-punkter har Kenneth-beslutning** (eller flyttet til Parkert)
5. ✅ **Alle P5-punkter er kvitterte ELLER eksplisitt utsatt** (svakhet-reparering)
6. ✅ **Alle TIMER-FUNN-kandidater (T-K1, T-K2, T-K3) har Kenneth-beslutning** (registrert i TIMER-FUNN-fila eller forkastet)
7. ✅ **Parkert-seksjon er gjennomgått** og hvert punkt har eksplisitt re-vurder-når-tidspunkt
8. ✅ **CLAUDE.md indeks oppdatert** — fjern referanse til denne fila

Når alle 8 er ✅: slett denne filen og fjern referansen i `CLAUDE.md`-indeksen. Skriv kort oppsummering i commit-meldingen om hva som ble ryddet.

---

## Sesjons-tracking (oppdateres ved hver oppryddings-sesjon)

| Dato | Sesjon | Punkter kvittert | Kommentar |
|---|---|---|---|
| 2026-04-28 | Bunke 3A.1 screening + plan-opprettelse | (planlegging) | Ingen punkter løst — kun strukturert. |

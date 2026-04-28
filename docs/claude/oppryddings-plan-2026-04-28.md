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
- **Fil:** web.md (~25–30 forekomster)
- **Type:** Drift-rens (rename + rute-fakta)
- **Berører:** Rute-tabell (linje 44, 65), `EntrepriserPanel` → `FaggrupperPanel`, `hentMineEntrepriser` → `hentMineFaggrupper`, alle «entreprise»-omtaler i FlytIndikator/Send-dropdown/Bestiller-entreprise-seksjoner, «Feltarbeid» → «Produksjon» (linje 487), `produksjon/mapper` vs `produksjon/box` (avklar faktisk navn)
- **Fase-0-relevans:** A.8 (faggruppe-terminologi er låst)
- **TIMER-FUNN:** Ingen
- **Kompleksitet:** Medium (stor mengde, ren mekanisk rename + verifikasjon mot kode)
- **Åpne spørsmål:** Ingen
- **Anbefaling:** Egen avgrenset bunke «P2.1: faggruppe-rename i web.md» med eksplisitt scope

### [ ] P2.2 — Faggruppe-rename i mobil.md
- **Fil:** mobil.md (~5–10 forekomster)
- **Type:** Drift-rens
- **Berører:** Linje 15 (Entreprise auto-velges), linje 46–48 (Send-ActionSheet), linje 51 (videresend), linje 72 (auto-fill `company→entreprise`), linje 414 (Dokumentflyt-filtrering)
- **Fase-0-relevans:** A.8
- **TIMER-FUNN:** Ingen
- **Kompleksitet:** Lav
- **Åpne spørsmål:** Ingen

### [ ] P2.3 — Korriger filnavn-referanse i okonomi.md
- **Fil:** okonomi.md
- **Type:** Drift-rens
- **Berører:** Linje 36 (`entreprise-velger.tsx` → `faggruppe-velger.tsx`), linje 60 (Relasjon til `entrepriser` → `faggrupper`)
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

## Utenfor scope (kun rapportering)

> Disse er flagget i screening, men løses IKKE som del av denne planen.

- **`entreprise: faggruppeRouter`-alias i `apps/api/src/trpc/router.ts:36`** — dødt alias (0 mobil-kall verifisert). Kan ryddes ved fremtidig mobil-deploy-syklus, men er ikke skadelig nå.
- **Andre filer i `apps/web/src/components/mengde/`-mappen** — ikke screenet i Bunke 3A.1. Kan inneholde lignende drift; egen runde hvis ønsket.
- **Annen dokumentasjon i `docs/claude/`** — Bunke 3A.1 dekket kun 5 filer. Resterende filer (timer.md, maskin.md, mannskap.md, planlegger.md, varsling.md, ai-sok.md, etc.) kan ha tilsvarende drift. Egne screening-bunker.

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

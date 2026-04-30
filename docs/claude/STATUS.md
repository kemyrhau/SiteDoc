# STATUS — docs/claude/-filer

> **Vedlikeholdsregel:** STATUS.md oppdateres av Opus i samme commit som endrer fil-status. Aldri separat commit.
>
> **Status oppdateres ved:** (1) ny verifikasjon/screening fullført, (2) drift rettet, (3) fil opprettet/slettet/arkivert.
>
> **Konsolidering ≠ verifikasjon:** Når en fil får tilført en ny seksjon med besluttede regler/policy (markert med `K{n}.x YYYY-MM-DD`), endrer det IKKE filens verifikasjons-status. Eksisterende innhold er ikke re-verifisert mot kode. Status forblir som var.
>
> **Kommentar-kolonne-tagger:**
> - `Sannhetskilde:` — innholds-aktiv (peker-mål for andre filer)
> - `Arbeidsanker:` — bruks-aktiv (pågående arbeid, endres ofte)
> - Hvis ingen av delene: kort fri beskrivelse (eller tom)

**Sist oppdatert:** 2026-04-28
**Antall filer dekket:** 35 (komplett oversikt)

## Sammendrag

| Status | Antall |
|---|---:|
| ✅ Verifisert mot kode | 4 |
| ⚠️ Drift identifisert | 5 |
| 🔄 Under arbeid | 4 |
| ❌ Ikke screenet | 19 |
| 📦 Arkivert | 3 |
| **Totalt** | **35** |

---

## ✅ Verifisert mot kode

| Fil | Sist verifisert | Kommentar |
|---|---|---|
| arkitektur.md | 2026-04-27 | **Sannhetskilde:** Fundament |
| dokumentflyt.md | 2026-04-27 | **Sannhetskilde:** Fundament. **2026-04-29:** § 2.3 HMS-tabell utvidet med firma-HMS-ansvarlig-lese-tilgang (per A.27) |
| fase-0-beslutninger.md | 2026-04-27 | **Sannhetskilde:** Anker for Fase 0-koding. K1 2026-04-28: C.13 + 2 § G-rader (QA-runde-2). § E steg 8: B-2-note 2026-04-28. **2026-04-29:** A.25 OrganizationRole + A.26 Smart modulProcedure + A.27 Firma-HMS-lese-tilgang (Alt A) + A.28 Kompetansematrise (Kompetansetype + AnsattKompetanse, SmartDok-verifisert) tilføyd. § E utvidet med steg 14 (OrganizationRole). C.14 Fase 0.5-rad for kompetanse. A.29 Offline sync-konflikt-strategi (conflict-modal + 60s grace-periode) tilføyd, A.23 utvidet med peker til A.29. **2026-04-30:** A.30 byggeplassId-NULL-semantikk vedtatt (A1: NULL = «gjelder hele prosjektet», allerede implementert i kode) |
| terminologi.md | 2026-04-27 | **Sannhetskilde:** Fundament |

## ⚠️ Drift identifisert (Bunke 3A.1, 2026-04-28)

| Fil | Sist verifisert | Drift-omfang |
|---|---|---|
| arkitektur-syntese.md | 2026-04-28 | **Sannhetskilde:** Gjenstående inkonsistenser: Godkjenning-status, EquipmentChecklist — P1.3-arbeid. K3.1 2026-04-28: firma-admin tabs-UI ny § 1.5. **2026-04-29:** P1.7 lukket (§ 5 Fase 0-listen erstattet med peker til § E). **2026-04-29 (commit fd63600):** P1.1 lukket (OrganizationModule → ProjectModule.organizationId per A.4/A.17), P1.2 lukket (Avdeling flyttet fra § 1.3-instillinger til § 5 Fase 0.5), P1.5 lukket (§ 2.5 multi-firma-bruker oppdatert til Modell A per B.7). **2026-04-29 (commit e23e67d):** §§ 3.8/3.9/3.10/7.4 tilføyd (3A-A — 4 manglende arkitektur-prinsipper). **2026-04-30:** § 6.2 asynkron arbeid kø-og-job-mønster tilføyd. § 5 Fase 0.5 oppdatert: NULL-betydning vedtatt A1 per A.30. P1.4 lukket (intern motsigelse) |
| forretningslogikk.md | 2026-04-28 | Byggeplan-rekkefølge motsigelse mot arkitektur-syntese, Godkjenning-status, lestAv-mekanikk for gruppe-mottaker |
| mobil.md | 2026-04-28 | 5 faggruppe-forekomster + 3 ulike Provider-tre-rekkefølger |
| okonomi.md | 2026-04-28 | 4 faggruppe-forekomster + FtdNotaComment mangler i tabell + ECO/Godkjenning-kobling mangler |
| web.md | 2026-04-28 | 21 faggruppe-forekomster + feil ruter (`/entrepriser` → `/faggrupper`, `/produksjon/entrepriser` → `/kontakter`) + feil API-navn (`hentMineEntrepriser` → `hentMineFaggrupper`) |

## 🔄 Under arbeid

| Fil | Sist verifisert | Kommentar |
|---|---|---|
| onboarding-veileder.md | ikke aktuelt | Idé-stadium, planlagt ~1 måned frem (post-Fase 0). Etablert 2026-04-28 |
| mannskap.md | 2026-04-28 | **Vy-beskrivelse i PSI-konteksten** etter 1D-presisering (N2.1-revidert). Datamodell forkastet (Mannskapsmedlem dupliserer User per memory). §15-felt-mapping bevart i tekstform. Endelig datamodell designes Fase 4 (PSI-utvidelse) |
| oppryddings-plan-2026-04-28.md | 2026-04-29 | **Arbeidsanker:** Aktiv anker for oppryddings-arbeidet etter Bunke 3A.1. P-KRITISK-seksjon (3 prod-blokkere) tilføyd 2026-04-28. Dokument-samhandlings-lukking Nivå 1-4 etablert 2026-04-28. Mini-Nivå 1D 2026-04-28: anker korrigert. Bunke N2.1-revidert (strammet) 2026-04-28: 2A+2B+2C kvittert. Bunke N2.2 registrert som etter-funn + A.Markussen-research-infeksjons-prinsipp. **2026-04-29:** P1.7 + P4.3 + P4.4 lukket. Screening-funn 2026-04-29 registrert: C.15 (24 indekser mangler), SCREENING-29-1 (sikkerhet — medlem.oppdater organizationId), SCREENING-29-2 (type-cast oppgave-detaljside). P1.1 + P1.2 + P1.5 lukket (commit fd63600). P5.6 utvidet og lukket strategisk — sammenslått med concurrent editing per A.29. SCREENING-29-2 delvis lukket via felles harBallen i shared, SCREENING-29-3 ny rad (commit e23e67d). 3A-A 4 prinsipper lukket. **2026-04-30:** P1.4 lukket (A.30 vedtatt). 3A komplett — alle 8 prinsipper enten implementert, slått inn i andre § eller dropp |
| timer-funn-fra-screening-2026-04-27.md | 2026-04-28 | **Arbeidsanker:** Midlertidig, slettes etter Timer/Maskin-revurdering |

## ❌ Ikke screenet

| Fil | Sist verifisert | Kommentar |
|---|---|---|
| adaptiv-sok-plan.md | — | Skal drøftes (per CLAUDE.md) |
| ai-integrasjon.md | — | — |
| ai-sok.md | — | — |
| api.md | — | — |
| bibliotek.md | — | Peker til kontrollplan.md (konsolidert) |
| byggeplass-strategi.md | — | Planlagt fase (per CLAUDE.md). K2.3 2026-04-28: slette-policy |
| db-naming-audit-2026-04-25.md | — | Datert audit 2026-04-25 |
| db-opprydning.md | — | **Arbeidsanker:** Markert AKTIV (per CLAUDE.md). K3.2 2026-04-28: åpne audit-spørsmål mot prod. U.2 D-6 2026-04-28 (utvidet verifikasjon) |
| infrastruktur.md | — | — |
| kontrollplan.md | — | — |
| maskin.md | — | Krever justering for fase-0 (per CLAUDE.md). K2.4+K2.5 2026-04-28: jsonb-format + service-varsel-trigger |
| migrering-reporttemplate.md | — | Ikke implementert (per CLAUDE.md). K2.1+K2.2 2026-04-28: mal-versjonering + delt mal-bruk-regel |
| planlegger.md | — | Planlagt fase (per CLAUDE.md) |
| shared-pakker.md | — | — |
| smartdok-undersokelse-2026-04-25.md | — | Arkivert v1 (per CLAUDE.md) |
| smartdok-undersokelse.md | — | **Sannhetskilde:** SmartDok UI-research 2026-04-26 (per CLAUDE.md) |
| timer-input-katalog.md | — | — |
| timer.md | 2026-04-29 | Beslutninger 2026-04-29: P1, P2 #3/#6/#7/#8/#13/#14. YAML-header tilføyd. Screening 2026-04-29 utført: 23 indekser tilføyd (Funn F.12), AnsattKompetanse-referanse tilføyd (F.7), YAML utvidet med A.28+C.14 (F.9). Klar for Fase 3-koding etter Fase 0+0.5-deploy. Åpen kunde-blokker: godkjenningsflyt-detaljer (krever A.Markussen-input) |
| varsling.md | — | — |

## 📦 Arkivert

| Fil | Arkivert | Kommentar |
|---|---|---|
| arkitektur-oppsummering-2026-04-25.md | 2026-04-28 | Datert arkitektur-snapshot 2026-04-25 → [docs/arkiv/](../arkiv/arkitektur-oppsummering-2026-04-25.md). Innhold dekt av arkitektur-syntese.md før arkivering |
| arkitektur-qa-runde-2-2026-04-25.md | 2026-04-28 | Opus QA-runde 2 (2026-04-25) → [docs/arkiv/](../arkiv/arkitektur-qa-runde-2-2026-04-25.md). Beslutninger konsolidert til fase-0-beslutninger.md C.13 + § G-rader (K1) før arkivering |
| audit-data-2026-04-25.md | 2026-04-28 | Read-only audit av dev-DB (2026-04-25) → [docs/arkiv/](../arkiv/audit-data-2026-04-25.md). Åpne audit-spørsmål konsolidert til db-opprydning.md (K3.2) før arkivering |

---

## Forklaring av status-koder

- **✅ Verifisert mot kode** — Innhold sammenlignet mot Prisma-schema/API-routere/UI på datert kjøring. Drift rettet eller ikke funnet. **+ Kode-kvalitet vurdert. + Eventuelle svakheter dokumentert i screening-rapport eller oppryddings-plan.** Behandles som pålitelig.
- **⚠️ Drift identifisert** — Innhold sammenlignet mot kode på datert kjøring. **Avvik funnet og dokumentert** (typisk i screening-rapport eller oppryddings-plan), men **ennå ikke rettet**. Behandles som upålitelig på drift-punktene; resten kan brukes med varsomhet.
- **🔄 Under arbeid** — **Aktiv arbeidsfil** (oppryddings-plan, midlertidig screening-funn, idé-stadium-modul) hvor innholdet endres aktivt og status-spørsmålet ikke er meningsfylt før arbeidet er ferdig. Skal slettes eller flyttes til ✅/⚠️/📦 når arbeidet er ferdig.
- **❌ Ikke screenet** — **Aldri verifisert mot kode i en planlagt screening-runde.** Innhold kan stemme — eller ikke. Behandles som upålitelig inntil det motsatte er bevist. **Filer berørt av K1/K2/K3-konsolidering 2026-04-28 forblir ❌** — konsolideringen tilførte beslutninger i ny seksjon, men eksisterende innhold er ikke re-verifisert mot kode.
- **📦 Arkivert** — Filen er flyttet til `docs/arkiv/` etter at innholdet er overført til aktive sannhetskilder. Hjemløse beslutninger fanget før arkivering. Beholdes for historikk, ikke aktiv referanse.

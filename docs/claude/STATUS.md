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
| 🔄 Under arbeid | 3 |
| ❌ Ikke screenet | 23 |
| 📦 Arkivert | 0 |
| **Totalt** | **35** |

---

## ✅ Verifisert mot kode

| Fil | Sist verifisert | Kommentar |
|---|---|---|
| arkitektur.md | 2026-04-27 | **Sannhetskilde:** Fundament |
| dokumentflyt.md | 2026-04-27 | **Sannhetskilde:** Fundament |
| fase-0-beslutninger.md | 2026-04-27 | **Sannhetskilde:** Anker for Fase 0-koding. K1 2026-04-28: C.13 + 2 § G-rader (QA-runde-2). § E steg 8: B-2-note 2026-04-28 (utvidet verifikasjon) |
| terminologi.md | 2026-04-27 | **Sannhetskilde:** Fundament |

## ⚠️ Drift identifisert (Bunke 3A.1, 2026-04-28)

| Fil | Sist verifisert | Drift-omfang |
|---|---|---|
| arkitektur-syntese.md | 2026-04-28 | **Sannhetskilde:** 5 inkonsistenser mot fase-0 (OrganizationModule, Avdeling-flagg, Godkjenning-status, EquipmentChecklist, Fase 0.5 motsigelse) — P1-arbeid. K3.1 2026-04-28: firma-admin tabs-UI ny § 1.5 |
| forretningslogikk.md | 2026-04-28 | Byggeplan-rekkefølge motsigelse mot arkitektur-syntese, Godkjenning-status, lestAv-mekanikk for gruppe-mottaker |
| mobil.md | 2026-04-28 | 5 faggruppe-forekomster + 3 ulike Provider-tre-rekkefølger |
| okonomi.md | 2026-04-28 | 4 faggruppe-forekomster + FtdNotaComment mangler i tabell + ECO/Godkjenning-kobling mangler |
| web.md | 2026-04-28 | 21 faggruppe-forekomster + feil ruter (`/entrepriser` → `/faggrupper`, `/produksjon/entrepriser` → `/kontakter`) + feil API-navn (`hentMineEntrepriser` → `hentMineFaggrupper`) |

## 🔄 Under arbeid

| Fil | Sist verifisert | Kommentar |
|---|---|---|
| onboarding-veileder.md | ikke aktuelt | Idé-stadium, planlagt ~1 måned frem (post-Fase 0). Etablert 2026-04-28 |
| oppryddings-plan-2026-04-28.md | 2026-04-28 | **Arbeidsanker:** Aktiv anker for oppryddings-arbeidet etter Bunke 3A.1. P-KRITISK-seksjon (3 prod-blokkere) tilføyd 2026-04-28 fra utvidet verifikasjon |
| timer-funn-fra-screening-2026-04-27.md | 2026-04-28 | **Arbeidsanker:** Midlertidig, slettes etter Timer/Maskin-revurdering |

## ❌ Ikke screenet

| Fil | Sist verifisert | Kommentar |
|---|---|---|
| adaptiv-sok-plan.md | — | Skal drøftes (per CLAUDE.md) |
| ai-integrasjon.md | — | — |
| ai-sok.md | — | — |
| api.md | — | — |
| arkitektur-oppsummering-2026-04-25.md | — | Datert snapshot 2026-04-25 |
| arkitektur-qa-runde-2-2026-04-25.md | — | Datert QA-rapport 2026-04-25 |
| audit-data-2026-04-25.md | — | Datert read-only audit 2026-04-25 |
| bibliotek.md | — | Peker til kontrollplan.md (konsolidert) |
| byggeplass-strategi.md | — | Planlagt fase (per CLAUDE.md). K2.3 2026-04-28: slette-policy |
| db-naming-audit-2026-04-25.md | — | Datert audit 2026-04-25 |
| db-opprydning.md | — | **Arbeidsanker:** Markert AKTIV (per CLAUDE.md). K3.2 2026-04-28: åpne audit-spørsmål mot prod. U.2 D-6 2026-04-28 (utvidet verifikasjon) |
| infrastruktur.md | — | — |
| kontrollplan.md | — | — |
| mannskap.md | — | — |
| maskin.md | — | Krever justering for fase-0 (per CLAUDE.md). K2.4+K2.5 2026-04-28: jsonb-format + service-varsel-trigger |
| migrering-reporttemplate.md | — | Ikke implementert (per CLAUDE.md). K2.1+K2.2 2026-04-28: mal-versjonering + delt mal-bruk-regel |
| planlegger.md | — | Planlagt fase (per CLAUDE.md) |
| shared-pakker.md | — | — |
| smartdok-undersokelse-2026-04-25.md | — | Arkivert v1 (per CLAUDE.md) |
| smartdok-undersokelse.md | — | **Sannhetskilde:** SmartDok UI-research 2026-04-26 (per CLAUDE.md) |
| timer-input-katalog.md | — | — |
| timer.md | — | Krever refaktor for fase-0 (per CLAUDE.md) — venter på Timer-revurdering |
| varsling.md | — | — |

---

## Forklaring av status-koder

- **✅ Verifisert mot kode** — Innhold sammenlignet mot Prisma-schema/API-routere/UI på datert kjøring. Drift rettet eller ikke funnet. **+ Kode-kvalitet vurdert. + Eventuelle svakheter dokumentert i screening-rapport eller oppryddings-plan.** Behandles som pålitelig.
- **⚠️ Drift identifisert** — Innhold sammenlignet mot kode på datert kjøring. **Avvik funnet og dokumentert** (typisk i screening-rapport eller oppryddings-plan), men **ennå ikke rettet**. Behandles som upålitelig på drift-punktene; resten kan brukes med varsomhet.
- **🔄 Under arbeid** — **Aktiv arbeidsfil** (oppryddings-plan, midlertidig screening-funn, idé-stadium-modul) hvor innholdet endres aktivt og status-spørsmålet ikke er meningsfylt før arbeidet er ferdig. Skal slettes eller flyttes til ✅/⚠️/📦 når arbeidet er ferdig.
- **❌ Ikke screenet** — **Aldri verifisert mot kode i en planlagt screening-runde.** Innhold kan stemme — eller ikke. Behandles som upålitelig inntil det motsatte er bevist. **Filer berørt av K1/K2/K3-konsolidering 2026-04-28 forblir ❌** — konsolideringen tilførte beslutninger i ny seksjon, men eksisterende innhold er ikke re-verifisert mot kode.
- **📦 Arkivert** — Filen er flyttet til `docs/arkiv/` etter at innholdet er overført til aktive sannhetskilder. Hjemløse beslutninger fanget før arkivering. Beholdes for historikk, ikke aktiv referanse.

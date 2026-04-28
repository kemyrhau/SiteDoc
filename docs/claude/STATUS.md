# STATUS — docs/claude/-filer

> **Vedlikeholdsregel:** STATUS.md oppdateres av Opus i samme commit som endrer fil-status. Aldri separat commit.

**Sist oppdatert:** 2026-04-28
**Antall filer dekket:** 35 (komplett oversikt)

## Sammendrag

| Status | Antall |
|---|---:|
| ✅ Verifisert mot kode | 4 |
| ⚠️ Drift identifisert | 5 |
| 🔄 Under arbeid | 3 |
| ❌ Ikke screenet | 23 |
| **Totalt** | **35** |

---

## ✅ Verifisert mot kode

| Fil | Sist verifisert | Kommentar |
|---|---|---|
| arkitektur.md | 2026-04-27 | Fundament |
| dokumentflyt.md | 2026-04-27 | Fundament |
| fase-0-beslutninger.md | 2026-04-27 | Anker for Fase 0-koding. C.13 + 2 § G-rader konsolidert 2026-04-28 fra QA-runde-2 |
| terminologi.md | 2026-04-27 | Fundament |

## ⚠️ Drift identifisert (Bunke 3A.1, 2026-04-28)

| Fil | Sist verifisert | Drift-omfang |
|---|---|---|
| arkitektur-syntese.md | 2026-04-28 | 5 inkonsistenser mot fase-0 (OrganizationModule, Avdeling-flagg, Godkjenning-status, EquipmentChecklist, Fase 0.5 motsigelse) |
| forretningslogikk.md | 2026-04-28 | Byggeplan-rekkefølge motsigelse mot arkitektur-syntese, Godkjenning-status, lestAv-mekanikk for gruppe-mottaker |
| mobil.md | 2026-04-28 | 5 faggruppe-forekomster + 3 ulike Provider-tre-rekkefølger |
| okonomi.md | 2026-04-28 | 4 faggruppe-forekomster + FtdNotaComment mangler i tabell + ECO/Godkjenning-kobling mangler |
| web.md | 2026-04-28 | 21 faggruppe-forekomster + feil ruter (`/entrepriser` → `/faggrupper`, `/produksjon/entrepriser` → `/kontakter`) + feil API-navn (`hentMineEntrepriser` → `hentMineFaggrupper`) |

## 🔄 Under arbeid

| Fil | Sist verifisert | Kommentar |
|---|---|---|
| onboarding-veileder.md | ikke aktuelt | Idé-stadium, planlagt ~1 måned frem (post-Fase 0). Etablert 2026-04-28 |
| oppryddings-plan-2026-04-28.md | 2026-04-28 | Aktiv anker for oppryddings-arbeidet etter Bunke 3A.1 |
| timer-funn-fra-screening-2026-04-27.md | 2026-04-28 | Midlertidig, slettes etter Timer/Maskin-revurdering |

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
| byggeplass-strategi.md | — | Planlagt fase (per CLAUDE.md). K2.3 (slette-policy) konsolidert 2026-04-28 |
| db-naming-audit-2026-04-25.md | — | Datert audit 2026-04-25 |
| db-opprydning.md | — | Markert AKTIV (per CLAUDE.md) |
| infrastruktur.md | — | — |
| kontrollplan.md | — | — |
| mannskap.md | — | — |
| maskin.md | — | Krever justering for fase-0 (per CLAUDE.md). K2.4 (jsonb-format) + K2.5 (service-varsel-trigger) konsolidert 2026-04-28 |
| migrering-reporttemplate.md | — | Ikke implementert (per CLAUDE.md). K2.1 (mal-versjonering) + K2.2 (delt mal-bruk-regel) konsolidert 2026-04-28 |
| planlegger.md | — | Planlagt fase (per CLAUDE.md) |
| shared-pakker.md | — | — |
| smartdok-undersokelse-2026-04-25.md | — | Arkivert v1 (per CLAUDE.md) |
| smartdok-undersokelse.md | — | Markert AKTIV 2026-04-26 (per CLAUDE.md) |
| timer-input-katalog.md | — | — |
| timer.md | — | Krever refaktor for fase-0 (per CLAUDE.md) — venter på Timer-revurdering |
| varsling.md | — | — |

---

## Forklaring av status-koder

- **✅ Verifisert mot kode** — Innhold sammenlignet mot Prisma-schema, API-routere og UI-kode på dato angitt. Drift rettet eller ikke funnet.
- **⚠️ Drift identifisert** — Innhold sammenlignet mot kode på dato angitt. Avvik funnet og dokumentert (typisk i screening-rapport eller oppryddings-plan), men ennå ikke rettet.
- **🔄 Under arbeid** — Aktiv arbeidsfil eller midlertidig fil. Status endres når arbeidet er ferdig (typisk slettes eller migreres til ✅).
- **❌ Ikke screenet** — Aldri verifisert mot kode i en planlagt screening-runde. Innhold kan stemme — eller ikke. Behandle som upålitelig inntil det motsatte er bevist.

---
name: DOC-MAP
description: Kart over hvilken dokumentasjonsfil som skal oppdateres ved hvilken type hendelse. Bruk ved usikkerhet.
sist_verifisert_mot_kode: 2026-05-16
---

# Dokumentasjonskart — hvilken fil oppdateres når

| Hendelse | Fil(er) som MÅ oppdateres |
|---|---|
| Ny arkitektur-/designbeslutning | `fase-0-beslutninger.md` |
| Feature deployet til prod | `STATUS.md` (prod-deploys) + `historikk-YYYY-MM.md` — fjernes fra STATUS-AKTUELT.md |
| PR merget til develop | `STATUS-AKTUELT.md` § Pågående arbeid (maks 3 aktive) |
| Ny planlagt/deprioritert oppgave | `BACKLOG.md` (ikke STATUS-AKTUELT.md) |
| Halvferdig feature parkeres | `BACKLOG.md` |
| Ny prosess-/arbeidsregel | `CLAUDE.md` |
| Parallell-arbeid / worktree-koordinering / frossen sone endres | `parallell-arbeid-lock.md` |
| Tvil om hvem gjør hva / meldingsflyt | `SAMARBEIDSREGLER.md` |
| Fil opprettet/arkivert/slettet | `STATUS.md` (fil-register) |
| Kundeønske-status endres | `STATUS-AKTUELT.md` § Kundeønsker |
| Timer-modul spec endres | `timer.md` |
| Timer/GPS/prosjekt-utredning (dag-flyt, T.8 m.fl.) | `timer-gps-prosjekt-utredning.md` |
| Maskin-modul spec endres | `maskin.md` |
| Dokumentflyt-regler endres | `dokumentflyt.md` |
| Domeneflyt/arbeidsflyt endres | `domene-arbeidsflyt.md` |
| Mobil-spec endres | `mobil.md` |
| EAS-bygg/credentials-endring | `eas-build-veileder.md` |
| Dev-login/agent-testing-endring (testbrukere, `/dev-login`, secrets) | `dev-login-agent.md` |
| Simulator-oppstart/feilsøking (Metro, tunnel, brukerbytte, symptom→fiks) | `simulator-runbook.md` |
| Web-spec endres | `web.md` |
| Terminologi/hierarki endres | `terminologi.md` |
| Arkitektur-syntese endres | `arkitektur-syntese.md` |
| Navigasjonsredesign — paritet/funksjon flyttes | `redesign-paritetssjekkliste.md` |
| Redesign-handoff / designreferanse / strategi endres | `docs/redesign/redesign-handoff.md` |

## Regel

Ingen PR-commit uten at riktig doc er oppdatert i samme commit. Se også
[CLAUDE.md § Funksjonsendrings-commits](../../CLAUDE.md) — status-dokumenter
som oppdateres i egen commit etterpå blir glemt eller drifter.

Ved tvil om hvor noe dokumenteres: les denne tabellen først.

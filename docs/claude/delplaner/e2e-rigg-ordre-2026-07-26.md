# Ordre: E2E-rigg mot test.sitedoc.no (CI trinn 2) — fabel, 2026-07-26

> Til cowork via Kenneth. Bakgrunn: klikktesting er blitt flaskehals (manuelle Chrome-Opus-økter, debugger-kollisjoner, stale agent). Grunnmuren finnes: dev-login (✅ `dev-login-agent.md`), test-stack, klikktest-veiledere. Dette er det bevisst utsatte «senere trinn» fra `spor1-ci-ordre.md` — nå satt i drift. Kvalitet foran kvantitet: liten røyk-suite som ALLTID er grønn, ikke bred suite som flaker.

## Hva
Playwright-basert e2e-suite som kjører headless mot test.sitedoc.no, autentisert via dev-login-token (INGEN OAuth-runde, INGEN deling av Kenneths Chrome — det eliminerer debugger-kollisjonen og stale-økt-problemet).

## Scope trinn 2 (bevisst smalt — 5–8 røyk-tester)
Konverter de mest gjentatte klikktest-punktene fra veilederne til kode:
1. Innlogging via dev-login-token → dashbord laster.
2. Opprett sjekkliste (registrator, standard flyt) → status Utkast.
3. Send → status-kollaps til Mottatt, ballen hos neste ledd.
4. Flytposisjon-headeren rendrer FULL ledd-rad (antall bokser = flytens ledd; aktiv boks matcher «Venter på») — regresjonsvern for byggLedd-fiksen.
5. Besvar → Besvart; Godkjenn → Godkjent.
6. Videresend-synlighet per rolle (regresjonsvern for H3 når den er merget).
7. Gjenåpne fra Lukket.

## Rammer
- **Testdata:** eget agentprosjekt i `sitedoc_test` (gjenbruk `test-arbeider`-mønsteret); hver kjøring oppretter sine dokumenter med kjørings-prefiks og rydder etter seg (soft-delete er ok). ALDRI mot prod.
- **Kjøring:** lokalt/worktree med `pnpm e2e` først; GitHub Actions-kobling (nightly eller PR-label, IKKE hver PR — test-miljøet er delt) som eget beslutningspunkt etter at suiten har vært stabil en uke.
- **Selektorer:** `data-testid` på de flatene testene trenger (ledd-rad, handlingsknapper, status-pill) — små additive UI-endringer tillatt.
- **Flake-policy:** en test som flaker fikses eller fjernes samme dag — suiten skal være troverdig eller ikke finnes.
- Playwright-config i repoet (`tests/e2e/`), dev-login-detaljer fra `docs/claude/dev-login-agent.md`; secrets aldri i repo.

## Rolleeffekt
Chrome-Opus-klikktester reserveres etter dette til NYE flater og utforskende testing — regresjonene eies av suiten. Veilederne består som kilde for nye testkandidater.

## DoD
- Suite grønn 3 kjøringer på rad mot test. README i `tests/e2e/` (oppsett + kjøring + flake-policy). Vis diff, push egen gren, ikke merge, ikke rør STATUS/BACKLOG. Dok-sync (dev-login-agent.md + spor1-ci-ordre.md status) i egen docs-commit ved merge.

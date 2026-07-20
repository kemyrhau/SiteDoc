---
name: spor1-ci-ordre
status: 🟢 KLAR — fabel-godkjent 2026-07-20, cowork-skrevet. Fil-disjunkt fra spor 2
eier: fabel (vedtak) · cowork (ordre + merge-rekkefølge) · kode-Opus «CI» (ledd 3)
sist_verifisert_mot_kode: 2026-07-20
---

# Ordre — Spor 1: CI trinn 1 (lint + typecheck + tester på PR mot develop)

## 0. For deg som koder (les først)

**Hvem du er:** kode-Opus «CI», **ledd 3 (koding)**, egen parallell økt. Du jobber **kun** i `.github/workflows/` og eventuelt `package.json`-scripts. **Du rører ikke app-kode** — en annen kode-Opus arbeider samtidig i `apps/api/src` (spor 2). Du gater ikke, tester ikke med brukere, merger ikke, deployer ikke.

**Branch:** `chore/ci-trinn1` fra develop. Du pusher kun denne.

**Bakgrunn:** repoet har i dag **ingen CI**. Alt er verifisert manuelt, én gang, av en Opus i en nettleser. Denne saken gir automatisk regresjonsvern fra dag én.

**Ditt neste svar:** resultatet av Steg 0 (baseline) + forslag til scope — ikke ferdig workflow.

## 1. Vedtak (fabel 2026-07-20)
Scope for trinn 1 er **bevisst smalt**: GitHub Actions-workflow som kjører **lint + typecheck + eksisterende tester** på PR mot `develop`. **Ikke** test-DB, **ikke** deploy, **ikke** e2e — det er senere trinn. Smalt trinn 1 gir verdi dag én og null risiko.

## 2. Steg 0 — etabler baseline FØRST (leveres før workflow skrives)

Cowork kunne **ikke** verifisere testtilstanden (sandkassen mangler `rolldown`s native binding for linux-arm64; `node_modules` er installert for darwin). Det er en måle-begrensning, ikke et funn. **Du kjører derfor baselinen selv** på Mac-en:

```
pnpm lint
pnpm typecheck
pnpm test
```

Rapporter for hver: grønn eller rød, og ved rød **hvilke** filer/tester.

**Kjent signal:** kode-Opus rapporterte to ganger pre-eksisterende feil i `packages/shared/src/utils/carveArbeidstid.test.ts` og `feltLaasing.test.ts` (i filer han ikke rørte). Bekreft eller avkreft.

**Scope-forgrening ut fra baselinen — velg og begrunn:**
- **Alle tre grønne** → workflow kjører alle tre. Ferdig.
- **`test` rød, øvrige grønne** → to lovlige veier: (a) workflow kjører lint + typecheck nå, `test` legges til når den er grønn; eller (b) feilene rettes som del av denne saken (kun hvis de er trivielle og i testfilene selv — **ikke** hvis de avdekker ekte produksjonsfeil, da flagges det som egen sak). **Anbefaling: (a)** — en rød CI dag én blir ignorert, og da er vernet verdiløst.
- **`lint`/`typecheck` rød** → stopp og flagg. Det er et større funn enn denne saken.

## 3. Oppdraget (etter cowork-gate av Steg 0)
Workflow `.github/workflows/ci.yml`:
- **Trigger:** `pull_request` mot `develop`.
- **Runner:** ubuntu-latest. **Node ≥ 20** (`engines.node` i root `package.json`), **pnpm 9.15.4** (`packageManager`-feltet — bruk det, ikke en hardkodet versjon).
- **Steg:** checkout → pnpm/action-setup → node-setup med pnpm-cache → `pnpm install --frozen-lockfile` → de kommandoene Steg 0 klarerte.
- **Ikke** bygg Docker-images, **ikke** rør deploy, **ingen** hemmeligheter.

## 4. Ufravikelig
- **Ingen app-kode.** Berører du noe under `apps/` eller `packages/` utover et `test`-script, **stopp og flagg** — spor 2 arbeider der samtidig.
- Ingen secrets, ingen deploy-steg, ingen test-DB.
- Turbo-cache i CI er **utenfor scope** (senere trinn).

## 5. DoD
Steg 0 rapportert + cowork-gatet → workflow skrevet → **verifisert grønn på en faktisk PR** (ikke bare «ser riktig ut») → cowork-review → merge. **Merges FØR spor 2**, slik at spor 2 sine tester kjører i CI fra første PR.

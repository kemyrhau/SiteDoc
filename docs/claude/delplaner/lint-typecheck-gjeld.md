---
name: lint-typecheck-gjeld
status: 🟡 GJELD — målt 2026-07-20 (CI-Opus Steg 0). Trinn 1 (mobil eslint-config) UTFØRT 2026-07-20. Resten blokkerer CI trinn 2
eier: fabel (prioritering) · kode-Opus (rydding)
sist_verifisert_mot_kode: 2026-07-20
---

# Lint- og typecheck-gjeld — blokkerer CI trinn 2

> Målt av CI-Opus i spor 1s Steg 0 (2026-07-20). **Grunnen til at CI trinn 1 kun kjører `test`:** lint og typecheck er bredt røde, og en rød CI dag én blir ignorert. Denne saken rydder gjelden slik at de kan legges inn som gater.

## Målt tilstand

| Kommando | Resultat | Fordeling |
|---|---|---|
| `pnpm test` | 🟢 GRØNN | shared 77 tester (7 filer) + web 37 (3 filer) — **er nå CI-gate** |
| `pnpm lint` | 🔴 RØD | `@sitedoc/api` **57** · `@sitedoc/mobile` **28** (var 12 — se trinn 1 under) · `@sitedoc/pdf` **7** · `@sitedoc/web` **2+** |
| `pnpm typecheck` | 🔴 RØD | `@sitedoc/shared` **2** · `@sitedoc/mobile` **8** |

**Viktig avklaring:** `carveArbeidstid.test.ts` og `feltLaasing.test.ts` feiler **typecheck** (TS2532, TS2345) men kjører **grønt i test** — vitest transpilerer uten å typesjekke. Det forklarer kode-Opus' gjentatte «pre-eksisterende testfeil»: han så typecheck-siden, ikke test-siden. Feilene er ekte og ligger i testfilene selv.

**Miljø-felle (ikke gjeld):** uten `prisma generate` for de fire db-pakkene «false-failer» typecheck i tillegg i web/api/db-timer (`.prisma/*-client` mangler). Db-pakkene har **ingen build-script**, så turbos `^build`-avhengighet genererer dem aldri. CI trinn 1 løser dette med et eksplisitt generate-steg — men en fersk lokal checkout treffer samme felle.

## Feilkategorier (fra CI-Opus' måling)
- `@typescript-eslint/no-unused-vars` — ubrukte variabler/imports (må prefikses `_` per kodestilen)
- `@typescript-eslint/no-require-imports` — `require()`-stil import
- `prefer-const`
- `no-control-regex`
- `@typescript-eslint/ban-ts-comment`
- **`@sitedoc/mobile`: konfigurasjonshull — RYDDET (trinn 1, se under).**

## Trinn 1 — mobil eslint-config (UTFØRT 2026-07-20, branch `chore/ci-harding`)

Config-hullet var: root `.eslintrc.json` (`root: true`) laster aldri `eslint-plugin-react-hooks`, men tre mobil-filer har `// eslint-disable-next-line react-hooks/exhaustive-deps`. Ikke-eksisterende regel → «rule not found». Pluginen fantes ikke installert (kun transitivt under `eslint-config-next` i web, ikke resolverbar fra mobil).

**Fiks (kun config, scoped til mobil — rører ikke root/api/shared):**
- `apps/mobile/.eslintrc.json` (ny): `extends` root + `plugin:react-hooks/recommended`, `plugins: ["react-hooks"]`
- `eslint-plugin-react-hooks@^4.6.2` lagt til `apps/mobile` devDependencies (eslint 8 / React 18-kompatibel)

**Ærlig tall — før → etter:**

| | Før (phantom-config) | Etter (regel aktiv) |
|---|---|---|
| «rule not found» | 3 (feil rapportert som errors) | **0** |
| `@typescript-eslint/no-unused-vars` | 9 errors | 9 errors (uendret) |
| `react-hooks/exhaustive-deps` | 0 synlige | **18 warnings** (ekte, var usynlige) |
| `react-hooks/rules-of-hooks` | 0 synlige | **1 error** (ekte) |
| **Sum** | 12 problems | **28 problems (10 errors, 18 warnings)** |

Config-hullet skjulte **19 ekte react-hooks-funn**. Mest alvorlig: `rules-of-hooks`-error i `apps/mobile/src/components/TegningsCapture.tsx:38` — `useCallback` kalt betinget etter en tidlig return. Det er en reell React-korrekthetsbug, ikke stil.

**Ikke rettet** (per ordre — retting er egne runder): de 19 react-hooks-funnene + de 9 `no-unused-vars`. Rapportert her som ærlig baseline.

## FABEL-VEDTAK 2026-07-20: lint-ryddingen STOPPER etter trinn 1

**Kun ett unntak: `@sitedoc/shared` typecheck (2 feil i testfiler)** — den har forvirret to økter og koster nesten ingenting.

Resten (`api` 57, `mobile` 28, `pdf` 7, `web` 2+, `mobile` typecheck 8) **ryddes ikke nå**. Begrunnelse: kosmetisk gjeld har lavere verdi enn køen (spor 2 regresjonsvern, sak 2, A-3b). En økt som rydder `prefer-const` mens tilgangslaget mangler varig testdekning, jobber på feil sted. Gjelden er **målt og dokumentert** — den er ikke glemt, den er nedprioritert bevisst, og tallene her er gyldig utgangspunkt når den tas opp igjen.

**Konsekvens:** CI trinn 2 (lint + typecheck som gater) er utsatt på ubestemt tid. CI trinn 1 (`pnpm test` på PR + push til develop) står.

**Unntaket som ble skilt ut som egen sak:** `rules-of-hooks`-erroren er **ikke** lint-gjeld — se [tegningscapture-hooks-bug.md](tegningscapture-hooks-bug.md) (pilot-kritisk, mobil-økt med simulator-DoD).

## Opprinnelig foreslått rekkefølge (arkivert — kun trinn 1 utført)
1. ~~**Mobil eslint-config**~~ — ✅ utført (se over). Ga riktig tall: mobil lint 12 → 28.
2. ~~`@sitedoc/pdf` (7)~~ — stoppet per vedtak.
3. **`@sitedoc/shared` typecheck (2)** — ✅ eneste unntak, skal gjøres.
4. ~~`@sitedoc/web` (2+) og `@sitedoc/mobile` typecheck (8)~~ — stoppet.
5. ~~`@sitedoc/api` (57)~~ — stoppet.

**Etter hvert trinn:** legg den nå-grønne kommandoen inn som CI-gate for den pakken, slik at gjelden ikke gjenoppstår. Målet er `pnpm lint` + `pnpm typecheck` som fulle gater i CI trinn 2.

## Ufravikelig
- **Én pakke om gangen, egen branch.** 57 api-feil i én PR er ikke reviewbart.
- **Ingen atferdsendring.** Lint-rydding som «forbedrer» logikk underveis er en skjult refaktor — stopp og flagg.
- Koordineres mot aktive spor i [parallell-arbeid-lock.md](../parallell-arbeid-lock.md) — `apps/api/src` er berørt av spor 2 og sak 2.

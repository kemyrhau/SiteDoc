---
name: f2-trekktilbake-ordre
status: 🟢 BYGGEORDRE for kode-Opus — F2 Trekk tilbake → kladd. Ren kode, INGEN migrering. 2026-07-25
eier: cowork (ordre + gating) · kode-Opus (bygger)
base: origin/develop (med F0 + F1)
spec: docs/claude/delplaner/statusmaskin-redesign-spec-2026-07-25.md (rev.2 — LES § 2, § 3, § 6; D-1 i § 0)
---

# Byggeordre F2 — Trekk tilbake → redigerbar kladd

Retter D-1: «Trekk tilbake» er død i dag (den ligger på status `sent`, men `sent` persisteres aldri — `effektivStatus` konverterer sent→received umiddelbart). Flyttes til `received→draft`: en sendt hendelse trekkes tilbake til avsender **før mottaker har svart**, og lander som redigerbar kladd. Dette er Kenneths modell (send → oppdag feil → trekk tilbake → rett → send).

**LES FØRST:** spec rev.2 § 0 (D-1), § 2 (VALID_TRANSITIONS), § 3 (matrise), § 6 (mikrotekst). Hold deg til F2-scope.

## Ufravikelig

- **INGEN migrering.** Ren kode — ingen skjema/data-endring.
- **Ikke gjør § 0 delt-kilde-refaktoren** — legg til i dagens strukturer. cowork gater triple-koherensen manuelt.
- **Koherens (STYRENDE):** trekk-tilbake-cellen skal ha matrise-rad ↔ hover ↔ VALID_TRANSITIONS-overgang som beskriver nøyaktig samme ting. Verifiser selv før push.
- Norsk bokmål, `t()`-i18n, ingen `any`. **Ikke rør** STATUS-AKTUELT/BACKLOG. **Ikke merge** — push feature-branch.

## Scope

1. **VALID_TRANSITIONS** (`packages/shared/src/utils/index.ts`): legg til `draft` i `received`-lista (`received: ["in_progress", "responded", "cancelled", "dismissed", "draft"]`). La `sent`-lista stå (`["received"]`, kun auto).
2. **Flytt handlingen** (`statusHandlinger.ts`): flytt `trekkTilbake` fra `sent`-blokken til `received`-blokken, og endre `nyStatus` fra `cancelled` til `draft`. `sent`-blokken blir tom (transient status uten handlinger — la den stå tom eller fjern, per hva som er reneste; ingen andre handlinger bor der).
3. **Matrise** (`flytmatrise-def.ts`): erstatt dagens `sent → cancelled` (Trekk tilbake)-rad med `received → draft` (Trekk tilbake). Default-roller: **registrator + bestiller + prosjektadmin** (avsender-siden — de som sendte, spec § 3). `sent`-seksjonen utgår (transient).
4. **Mikrotekst** (`flythjelp.handling.trekkTilbake`, spec § 6): «Henter dokumentet tilbake fra {{mottaker}} før de har begynt. Det blir redigerbar kladd hos deg — rett og send på nytt.» Oppdater nb+en, auto-oversett 13 (`generate.ts`).
5. **Fallback-benevnelse:** trekk-tilbake-mottakeren er den du sendte til → bruk `flythjelp.fallback.mottakerDin` (finnes fra mikrotekst-runden), ikke `avsender`.

## Merknad om «før mottaker har svart»

Ingen egen gate trengs: `received→draft` er kun gyldig fra status `received`, og et dokument i `received` er per definisjon ikke besvart ennå (besvart = status `responded`). Så «før svar» er iboende i kilde-statusen. (Kenneth vurderte en «før lest»-gate men valgte denne enklere modellen.)

## DoD

- [ ] `received→draft` i VALID_TRANSITIONS; trekkTilbake flyttet til received-blokk med `nyStatus: draft`; sent-blokk tømt.
- [ ] Matrise: `received→draft` (Trekk tilbake, Reg+Best+P-adm); gammel `sent→cancelled`-rad fjernet. Koherens-trippel bekreftet.
- [ ] Mikrotekst oppdatert (mottakerDin-fallback), 15 språk.
- [ ] `pnpm --filter @sitedoc/shared build` + web/api typecheck + test grønt.
- [ ] Vis diff. Push `feat/f2-trekktilbake`. Ikke merge. Ikke rør STATUS-AKTUELT/BACKLOG.

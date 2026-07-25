---
name: f1-avvist-ordre
status: 🟢 BYGGEORDRE for kode-Opus — F1 Avvist (dismissed). Ren kode, INGEN migrering. 2026-07-25
eier: cowork (ordre + gating) · kode-Opus (bygger)
base: origin/develop
spec: docs/claude/delplaner/statusmaskin-redesign-spec-2026-07-25.md (rev.2 — LES § 1, § 2, § 3, § 6, § 7)
---

# Byggeordre F1 — Avvist (`dismissed`)

Ny distinkt «Avvist»-status atskilt fra Trukket tilbake. I dag ruter `avvis → cancelled` (smelter sammen med trekk tilbake); F1 gir avvis sin egen terminal-aktige status med påkrevd begrunnelse.

**LES FØRST:** spec rev.2 (`statusmaskin-redesign-spec-2026-07-25.md`) § 1–3, § 6–7. Denne ordren er ÉN fase av redesignet — hold deg til F1-scope.

## Ufravikelig

- **INGEN migrering.** `status` er en String-kolonne (Checklist/Task), ikke enum — «dismissed» er en ny strengverdi. Ikke rør Prisma-skjema.
- **Ikke gjør § 0 delt-kilde-refaktoren her.** Legg til i dagens strukturer (`flytmatrise-def.ts`, `statusHandlinger.ts`, `perspektivEtikett.ts`, i18n). cowork gater triple-koherensen manuelt. § 0-unifiseringen er en egen senere fase.
- **Koherens-krav (Kenneth STYRENDE):** for avvis-cellen skal matrise-rad ↔ hover-tekst ↔ VALID_TRANSITIONS-overgang beskrive NØYAKTIG samme ting. Verifiser trippelen selv før push.
- Norsk bokmål, `t()`-i18n, ingen `any`, named exports.
- **Ikke rør** STATUS-AKTUELT.md / BACKLOG.md (cowork-filer). **Ikke merge** — push feature-branch, cowork gater fra origin.

## Scope

1. **Ny status `dismissed`** (etikett «Avvist»). VALID_TRANSITIONS (`packages/shared/src/utils/index.ts`): legg til `received: [..., "dismissed"]` og `dismissed: []` (terminal i F1 — gjenåpne `dismissed→draft` kommer i F4; noter at avviste dokumenter er terminale til F4, admin/sitedoc-bypass dekker interim).
2. **Avvis ruter til dismissed:** endre avvis-handlingen fra `received→cancelled` til `received→dismissed` i `statusHandlinger.ts`. Fjern den gamle `received→cancelled`-avvis-mappingen i `flytmatrise-def.ts`.
3. **Begrunnelse PÅKREVD ved Avvis** (gate-JA #2): avvis-mutasjonen krever en ikke-tom kommentar/begrunnelse. Bryter bevisst «fritekst = valgfritt»-presedensen — Kenneth-vedtatt. Server-validering (Zod) + klient-validering.
4. **Perspektiv-etikett** (`perspektivEtikett.ts`): `dismissed` → «Avvist» danger i NOEYTRAL. Perspektiv-flat (ingen ball) — kun NOEYTRAL-celle + fallback, ingen aktiv/venter-split (spec § 7).
5. **Matrise-rad:** `received → dismissed` (Avvis) med default-roller **Utfører + Prosjektadmin** (spec § 3).
6. **Mikrotekst** (`flythjelp.handling.avvis`, spec § 6): «Avviser dokumentet med begrunnelse. Flyten stopper; {{mottaker}} ser det som Avvist med begrunnelsen din. Kan gjenåpnes.» Oppdater nb+en, auto-oversett 13 språk (`generate.ts` fra `packages/shared`).
7. **Etikett + kvittering:** `status.avvist` = «Avvist» (nb+en+13). Kvittering (`kvitteringEtikett`): «Avvist ✓» (verifiser om nøkkelen finnes; legg til om ikke).

## DoD

- [ ] `dismissed` i VALID_TRANSITIONS + statusHandlinger + perspektivEtikett + matrise-rad + i18n, koherent (trippelen for avvis-cellen bekreftet).
- [ ] Avvis krever begrunnelse (server Zod + klient); test som verifiserer at tom begrunnelse avvises.
- [ ] Gammel `received→cancelled`-avvis fjernet; ingen dobbelt-mapping.
- [ ] `pnpm --filter @sitedoc/web typecheck` + `pnpm --filter @sitedoc/api typecheck` + `pnpm --filter @sitedoc/shared build` + relevante `test` grønt.
- [ ] Vis diff. Push `feat/f1-avvist`. Ikke merge. Ikke rør STATUS-AKTUELT/BACKLOG.

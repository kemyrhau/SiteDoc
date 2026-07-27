---
name: f4-gjenapne-ordre
status: 🟢 BYGGEORDRE for kode-Opus — F4 Samlet gjenåpne. Ren kode, INGEN migrering. 2026-07-25
eier: cowork (ordre + gating) · kode-Opus (bygger)
base: origin/develop (med F0+F1+F2+F3 — `cac9473e` e.l.)
spec: docs/claude/delplaner/statusmaskin-redesign-spec-2026-07-25.md (rev.2 — LES § 4, § 2, § 3, § 6)
---

# Byggeordre F4 — Samlet gjenåpne

Én Gjenåpne-handling fra alle avsluttede statuser (Lukket, Avvist, Trukket tilbake) → kladd hos oppretter. Samme regel overalt. (Slettet dekkes IKKE her — det er Gjenopprett i F0/papirkurven, egen semantikk.)

**LES FØRST:** spec rev.2 § 4 (gjenåpne-avgjørelser), § 2 (VALID_TRANSITIONS), § 3 (matrise), § 6 (mikrotekst). Hold deg til F4-scope.

## Ufravikelig

- **INGEN migrering** — ren kode.
- **Ikke gjør § 0 delt-kilde-refaktoren** — legg til i dagens strukturer. cowork gater triple-koherensen manuelt.
- **Koherens (STYRENDE):** hver gjenåpne-celle skal ha matrise-rad ↔ hover ↔ VALID_TRANSITIONS-overgang som beskriver samme ting.
- Norsk bokmål, `t()`-i18n, ingen `any`. **Ikke rør** STATUS-AKTUELT/BACKLOG. **Ikke merge** — push feature-branch.

## Scope

1. **VALID_TRANSITIONS** (`packages/shared/src/utils/index.ts`): sørg for `closed: ["draft"]`, `dismissed: ["draft"]` (var `[]` terminal i F1 — F4 åpner den), `cancelled: ["draft"]` (legacy). Verifiser gjeldende tilstand først; legg kun til det som mangler.
2. **statusHandlinger.ts:** legg til Gjenåpne-handling (`nyStatus: "draft"`) i blokkene for `closed`, `dismissed`, `cancelled`. Bruk eksisterende `statushandling.gjenapne`-tekstnøkkel. Oppdater rolle-/overgangs-settene.
3. **Matrise** (`flytmatrise-def.ts`, spec § 3): rad(er) `closed/dismissed/cancelled → draft` (Gjenåpne). Default-roller: **registrator + prosjektadmin** (spec § 4 — godkjenner-ledd kan mangle; gjenåpne lander hos oppretter = registrator). Merk: en `cancelled→draft`-gjenåpne-rad kan alt finnes fra tidligere runde — konsolider, ikke dupliser.
4. **Ruting → kladd hos oppretter:** gjenåpne setter `status = "draft"`. Draft-redigerbarhet/ball keyer alt på `bestillerUserId` (bekreftet i F2 via `beregnHarBallen`), så dokumentet havner automatisk hos oppretteren. **Verifiser** at ingen stale `recipientUserId`/`eierUserId` overstyrer — ellers rett det. Ingen egen ruting-mutasjon skal trengs.
5. **Mikrotekst** (`flythjelp.handling.gjenapne`, spec § 6): «Henter et avsluttet dokument tilbake til start: det blir kladd hos oppretteren, klart til redigering og ny sending.» (oppdater om ordlyden avviker). nb+en + auto-oversett 13.
6. **Avvist-spesifikt:** gjenåpne fra `dismissed` — begrunnelse **valgfri** (nudge, ikke påkrevd — motsatt av selve Avvis). Ikke innfør påkrevd-krav her.

## DoD

- [ ] `closed/dismissed/cancelled → draft` i VALID_TRANSITIONS + Gjenåpne-handling i statusHandlinger + matrise-rad(er) (Reg+P-adm). Koherens-tripler bekreftet.
- [ ] Gjenåpnet dokument havner som kladd hos oppretter (bestillerUserId har ballen) — verifisert, ingen stale ruting.
- [ ] Mikrotekst oppdatert, 15 språk.
- [ ] `pnpm --filter @sitedoc/shared` typecheck+test + web/api typecheck + test grønt.
- [ ] Vis diff. Push `feat/f4-gjenapne`. Ikke merge. Ikke rør STATUS-AKTUELT/BACKLOG.

---
name: f0-softdelete-ordre
status: 🟢 BYGGEORDRE for kode-Opus — F0 Soft-delete / 90-dagers papirkurv. Migrering = eget godkjent steg. 2026-07-25
eier: cowork (ordre + gating) · kode-Opus (bygger) · Kenneth (godkjenner migrering)
base: origin/develop
spec: docs/claude/delplaner/statusmaskin-redesign-spec-2026-07-25.md (rev.2 — LES § 5, § 3, § 6)
---

# Byggeordre F0 — Soft-delete + 90-dagers papirkurv

Slett blir myk: dokumentet legges i en papirkurv (kan gjenopprettes i 90 dager), i stedet for hard `delete()`. Mer i tråd med data-disiplinen. Uavhengig av øvrige faser.

**LES FØRST:** spec rev.2 § 5 (soft-delete-modell), § 3 (matrise-rader), § 6 (mikrotekst). Hold deg til F0-scope.

## Ufravikelig

- **MIGRERING ER ET EGET STEG SOM KENNETH GODKJENNER FØR KJØRING.** Skriv migrasjonen (additiv, nullable), vis SQL-en til cowork/Kenneth, og **kjør den IKKE mot test/prod uten eksplisitt go**. Lokal sandkasse er ok for å verifisere at den genererer.
- **Additiv migrering kun:** `deletedAt DateTime?` + `deletedById String?` (nullable) på Checklist + Task. ALDRI DROP/rename. Følg to-stegs-policy.
- **Ikke gjør § 0 delt-kilde-refaktoren her** — legg til i dagens strukturer; cowork gater koherens manuelt. § 0-unifisering er egen senere fase.
- Norsk bokmål, `t()`-i18n, ingen `any`. **Ikke rør** STATUS-AKTUELT/BACKLOG. **Ikke merge** — push feature-branch.

## Scope

1. **Skjema (migrering — godkjennes før kjøring):** `deletedAt DateTime?` + `deletedById String?` på `Checklist` + `Task` (`packages/db/prisma/schema.prisma`). Indeks på `deletedAt` for papirkurv-spørring. Generér migrasjon, IKKE kjør mot test/prod uten go.
2. **Slett blir myk:** endre hard-slett til soft. I dag: `checklist.delete()` (`apps/api/src/routes/sjekkliste.ts:1419`), `task.delete()` (`apps/api/src/routes/oppgave.ts:1559`) → sett `deletedAt = now()`, `deletedById = ctx.userId`.
3. **Guard-filter (KRITISK — én kilde, ingen lekkasje):** ALLE `findMany`/`findFirst`/`count`/`aggregate` for Checklist/Task filtrerer `deletedAt: null`. Lag én delt where-hjelper og bruk den overalt — et glemt sted lekker slettede dokumenter inn i lister. **Gjelder også HMS-lister** (`domain="hms"` bruker samme tabeller — fabels verifiseringspunkt b). Papirkurv-visningen er inversen (`deletedAt: { not: null }`).
4. **Papirkurv-visning:** ny rute/side som lister slettede dokumenter med **dager igjen** (90 − dager siden `deletedAt`). **Tilgang: prosjektadmin (prosjekt-bredt — alle slettede i prosjektet) + oppretteren (egne slettede)** (Kenneth 2026-07-25).
5. **Gjenopprett:** nuller `deletedAt`/`deletedById`. Rett: **registrator + prosjektadmin** (spec § 3–4).
6. **Slett endelig:** faktisk `delete()` (dagens hard-slett-oppførsel), egen handling med bekreftelses-modal. Rett: **kun prosjektadmin (+ sitedoc-bypass)** (gate-JA #3).
7. **90-dagers auto-hardslett:** daglig jobb som `delete()`-er rader med `deletedAt < now() − 90 dager`. Undersøk hvor planlagte jobber bor i api-en (cron/scheduler); hvis ingen infrastruktur finnes, **flagg det til cowork** før du bygger noe nytt jobb-rammeverk — da tas jobben som eget del-steg.
8. **Matrise-rader** (spec § 3): `draft → slett` (Slett), `slettet → gjenopprett` (Gjenopprett), `slettet → slett endelig` (Slett endelig) med rollene i § 3.
9. **Mikrotekst** (spec § 6): `slett` (én nøkkel, «Legger dokumentet i slettede. Det kan gjenopprettes i 90 dager — deretter slettes det endelig.»), `slettEndelig` (ny), `gjenopprett` (ny). nb+en + auto-oversett 13.

## DoD

- [ ] Migrasjon skrevet (additiv, nullable, indeks) — SQL vist, **IKKE kjørt mot test/prod uten Kenneths go**.
- [ ] Slett → soft; hard-slett kun via «Slett endelig» (prosjektadmin).
- [ ] Guard-filter dekker ALLE Checklist/Task-spørringer inkl. HMS — verifisert (grep-bevis: ingen ufiltrert findMany/count). Test som bekrefter at et soft-slettet dokument ikke vises i lister, men i papirkurv.
- [ ] Papirkurv-visning tilgangs-gatet (prosjektadmin prosjekt-bredt + oppretter egne); dager-igjen korrekt.
- [ ] 90-dagers sweep implementert ELLER flagget som eget del-steg om jobb-infra mangler.
- [ ] typecheck (web+api) + `shared build` + test grønt. Vis diff. Push `feat/f0-softdelete`. Ikke merge. Ikke rør STATUS-AKTUELT/BACKLOG.

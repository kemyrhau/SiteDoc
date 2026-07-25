---
name: f3-merge-underarbeid-ordre
status: 🟢 BYGGEORDRE for kode-Opus — F3 Merge «Under arbeid». Data-migrering = egen godkjent gate. 2026-07-25
eier: cowork (ordre + gating) · kode-Opus (bygger) · Kenneth (godkjenner migrering)
base: origin/develop (med F0 + F1 + F2 — `50c7b544` e.l.)
spec: docs/claude/delplaner/statusmaskin-redesign-spec-2026-07-25.md (rev.2 — LES § 2, § 3, § 6, § 7, § 8, § 9)
---

# Byggeordre F3 — Merge «Under arbeid» (fjern rejected-splitten)

`rejected` («Returnert») og `in_progress` («Under arbeid») smelter til ÉN tilstand med label «Under arbeid». Send tilbake ruter DIREKTE dit — den manuelle Gjenoppta forsvinner (det var forstyrrelsen). Fantom-raden `received→in_progress` fjernes.

**LES FØRST:** spec rev.2 § 2 (VALID_TRANSITIONS), § 3 (matrise), § 6 (mikrotekst), § 7 (perspektiv-etiketter), § 8 (HMS-grense), § 9 (migrering). Dette er den mest inngripende fasen — hold deg til F3-scope.

## Ufravikelig

- **DATA-MIGRERING ER EGEN GATE.** `UPDATE ... status rejected→in_progress` skrives (som Prisma-migrasjon med rå SQL, eller dokumentert SQL), men **KJØRES IKKE mot test/prod uten Kenneths eksplisitte go**. Lokal sandkasse ok for verifisering.
- **Ikke gjør § 0 delt-kilde-refaktoren** — legg til/endre i dagens strukturer. cowork gater triple-koherensen manuelt.
- **Koherens (STYRENDE):** for hver endret celle (Send tilbake, in_progress-handlingene) skal matrise-rad ↔ hover ↔ VALID_TRANSITIONS-overgang beskrive nøyaktig samme ting.
- **Bevar data:** `status` er String — «fjern rejected» betyr fjern fra VALID_TRANSITIONS/handlinger/etiketter, IKKE en enum-drop. Eksisterende `rejected`-rader MÅ migreres til `in_progress` (ellers blir de foreldreløse). Migreringen kjøres ved deploy sammen med koden.
- Norsk bokmål, `t()`-i18n, ingen `any`. **Ikke rør** STATUS-AKTUELT/BACKLOG. **Ikke merge** — push feature-branch.

## Scope (kode)

1. **VALID_TRANSITIONS** (`packages/shared/src/utils/index.ts`) per spec § 2:
   - `responded: [...] ` → `["approved", "in_progress", "sent"]` (Send tilbake → in_progress direkte).
   - `in_progress: [...]` → `["responded", "sent", "closed"]` (Besvar / Send på nytt / Lukk; + Videresend pseudo).
   - **Fjern `rejected`-oppføringen helt.**
2. **statusHandlinger.ts:**
   - **Fjern Gjenoppta** (var `rejected→in_progress`).
   - «Send tilbake» (`sendTilbakeUtforer`): `responded→rejected` → `responded→in_progress`.
   - `in_progress`-blokk: Besvar (→responded), Send på nytt (→sent), Lukk (→closed), Videresend. Fjern gammel `sendTilbake` (in_progress→sent uten svar) om den finnes.
   - **Fjern `rejected`-blokken.** Oppdater rolle-/overgangs-settene som refererer rejected.
3. **perspektivEtikett.ts** (spec § 7):
   - `in_progress` = «Under arbeid» — arver ballinnehaver-grammatikken (warning til ballinnehaver, dekker både førstegangsarbeid og utbedring etter retur). Oppdater NOEYTRAL/BASE_AKTIV/BASE_VENTER.
   - **Fjern `rejected`-cellene** (Til revisjon/Til utbedring) fra ALLE perspektiv-kart (inkl. HMS-kartene — se § 8).
4. **flytmatrise-def.ts** (spec § 3):
   - `responded → in_progress` (Send tilbake)-rad.
   - `in_progress`-seksjon: Besvar / Send på nytt / Lukk / Videresend med rollene i § 3.
   - **Fjern `rejected`-seksjonen.** **Fjern fantom-raden `received→in_progress` fra `AUTO_OVERGANGER`** (kun `sent→received` består).
5. **Mikrotekst** (`flythjelp.*`, spec § 6):
   - `gjenoppta` og `sendTilbake` (in_progress→sent uten svar) UTGÅR.
   - `sendTilbakeUtforer` (nå responded→in_progress): «Flytter dokumentet ett ledd tilbake: fra deg til {{mottaker}}, for utbedring. Hos dem står det som Under arbeid.»
   - Kvittering (`kvitteringEtikett`): fjern `statushandling.gjenoppta`-raden.
   - nb+en + auto-oversett 13.

## Scope (data-migrering — GATE)

6. **`UPDATE`** som setter `status = 'in_progress'` der `status = 'rejected'`, på `checklists` OG `tasks` (dekker HMS også — samme tabeller). Skriv den, vis SQL-en, **KJØR IKKE uten Kenneths go**. Kjøres ved deploy sammen med koden så ingen rad står som `rejected` etter at statusen er fjernet fra maskinen.

## HMS-verifisering (spec § 8)

Før du fjerner rejected-cellene: bekreft om HMS-perspektivkartene (`HMS_AKTIV`/`HMS_VENTER`) har `rejected`-celler, og om noen HMS-rad faktisk står i `rejected` (sannsynlig døde). Migreringen (punkt 6) dekker HMS-rader også. HMS-*rutingen* ellers urørt.

## DoD

- [ ] VALID_TRANSITIONS: responded/in_progress oppdatert, rejected fjernet. statusHandlinger: Gjenoppta bort, Send tilbake→in_progress, rejected-blokk bort. perspektivEtikett: in_progress merged, rejected-celler bort (inkl. HMS). flytmatrise-def: responded→in_progress-rad, in_progress-seksjon, rejected-seksjon + fantom-rad bort. Koherens-tripler bekreftet.
- [ ] Mikrotekst oppdatert (gjenoppta/sendTilbake ut, sendTilbakeUtforer «Under arbeid»), 15 språk.
- [ ] Data-migrering skrevet (rejected→in_progress, checklists+tasks) — **SQL vist, IKKE kjørt uten Kenneths go**.
- [ ] `pnpm --filter @sitedoc/shared build` + web/api typecheck + test grønt.
- [ ] Vis diff. Push `feat/f3-merge-underarbeid`. Ikke merge. Ikke rør STATUS-AKTUELT/BACKLOG.

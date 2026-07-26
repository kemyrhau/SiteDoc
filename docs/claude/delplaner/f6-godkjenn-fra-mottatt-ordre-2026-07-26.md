---
name: f6-godkjenn-fra-mottatt-ordre
status: 🟢 BYGGEORDRE for kode-Opus — Godkjenn direkte fra Mottatt (2-boks Reg→Godkjenner). Ren kode. 2026-07-26
eier: cowork (ordre + gating) · kode-Opus (bygger)
base: origin/develop (F0–F5 + klikktest-fikser inne)
opphav: H1-manifestasjon — en Registrator→Godkjenner-flyt (ingen utfører) kan ikke godkjenne i dag. Kenneth-vedtak: må fungere.
---

# Byggeordre — Godkjenn direkte fra Mottatt (`received→approved`)

En «opprett → godkjenn»-flyt (kun registrator + godkjenner) står fast i dag: registrator sender → dokumentet er «Mottatt» hos godkjenneren, men `received→approved` finnes ikke — godkjenning krever «Besvart» (responded), som er utførers handling. Uten utfører når dokumentet aldri godkjent. Denne ordren gir godkjenneren en direkte Godkjenn-vei fra Mottatt.

## Ufravikelig
- **INGEN migrering** — ren kode. **Ikke gjør § 0-refaktoren.** Ikke rør STATUS-AKTUELT/BACKLOG. Ikke merge — push feature-branch.
- Norsk bokmål, `t()`-i18n, ingen `any`.
- **Koherens (STYRENDE):** den nye Godkjenn-fra-Mottatt-cellen skal ha matrise-rad ↔ hover ↔ VALID_TRANSITIONS-overgang som beskriver samme ting.
- **Ikke rør** eksisterende `responded→approved` (Godkjenn etter Besvart) — den består. Dette er en TILLEGGS-vei, ikke en erstatning.

## Scope
1. **VALID_TRANSITIONS** (`packages/shared/src/utils/index.ts`): legg til `approved` i `received`-lista (`received: [..., "approved"]`).
2. **statusHandlinger.ts:** legg til Godkjenn-handling (`handling.godkjenn`, `nyStatus: "approved"`) i `received`-blokken. `responded`-blokkens Godkjenn står uendret.
3. **ROLLE_HANDLINGER_DEFAULTS:** `godkjenner.received` += `"approved"` (godkjenner eier Godkjenn fra Mottatt). Utfører/registrator får den IKKE.
4. **Matrise** (`flytmatrise-def.ts`): rad `received → approved` (Godkjenn), default-roller **Godkjenner + Prosjektadmin**. Tittel rendrer «Godkjenn → Godkjent».
5. **Mikrotekst:** gjenbruk `flythjelp.handling.godkjenn`. **Merk:** dagens tekst sier «Godtar svaret …» — i en opprett→godkjenn-flyt finnes intet «svar». Hvis ordlyden skurrer for fra-Mottatt-tilfellet, **flagg til cowork** (vi vurderer en nøytral omformulering som dekker begge veier), IKKE lag en tvillingtekst.

## Merknad (ikke i scope, kun kontekst)
Dette patcher 2-boks-tilfellet. Den generelle variabel-flytlengde-saken (H1 i evalueringen — status koder ikke posisjon, matrisen er rolle × status) består og hører til posisjons-modell-reconciliation med fabel. Ikke forsøk å løse H1 her.

## DoD
- [ ] `received→approved` i VALID_TRANSITIONS; Godkjenn i received-blokken; `godkjenner.received += approved`; matrise-rad (Godkjenner + P-adm). Koherens-trippel bekreftet.
- [ ] `responded→approved` uendret; utfører/registrator får ikke Godkjenn på received.
- [ ] Mikrotekst-nyansen vurdert (flagget hvis den skurrer, ingen tvillingtekst).
- [ ] `pnpm --filter @sitedoc/shared` typecheck+test + web/api typecheck grønt.
- [ ] Vis diff. Push `feat/f6-godkjenn-fra-mottatt`. Ikke merge. Ikke rør STATUS/BACKLOG.

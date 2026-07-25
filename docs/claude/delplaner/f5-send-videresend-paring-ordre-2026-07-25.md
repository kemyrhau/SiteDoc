---
name: f5-send-videresend-paring-ordre
status: 🟢 BYGGEORDRE for kode-Opus — F5 Send/Videresend-paring (SISTE fase). Ren kode. 2026-07-25
eier: cowork (ordre + gating) · kode-Opus (bygger)
base: origin/develop (med F0+F1+F2+F3+F4 — `4227d0a2` e.l.)
spec: docs/claude/delplaner/statusmaskin-redesign-spec-2026-07-25.md (rev.2 — LES § 2, § 3, § 6, beslutning 6)
---

# Byggeordre F5 — Send/Videresend-paring (siste fase)

Beslutning 6: **Send aktiveres overalt der Videresend aktiveres.** Send = alltid fram i flyten (mot neste ledd); Videresend = ut til en annen flyt (kryssflyt). Vi gjenbruker den eksisterende Send-funksjonen — ingen ny handling. Denne fasen plukker også opp `responded→sent`-for-stagingen fra F3.

**LES FØRST:** spec rev.2 § 2 (VALID_TRANSITIONS), § 3 (matrise), § 6 (mikrotekst), beslutning 6. Siste fase — etter denne er hele redesignet på develop.

## Ufravikelig

- **INGEN migrering** — ren kode.
- **Ikke gjør § 0 delt-kilde-refaktoren** — legg til i dagens strukturer. cowork gater triple-koherensen manuelt.
- **Koherens (STYRENDE):** hver ny Send-celle skal ha matrise-rad ↔ hover ↔ VALID_TRANSITIONS-overgang som beskriver samme ting.
- Norsk bokmål, `t()`-i18n, ingen `any`. **Ikke rør** STATUS-AKTUELT/BACKLOG. **Ikke merge** — push feature-branch.

## Scope

1. **VALID_TRANSITIONS** (`packages/shared/src/utils/index.ts`): sørg for `sent` som mål der Videresend finnes: `received`, `responded`, `approved`. `responded→sent` ble for-staget i F3 — bekreft den, ikke dupliser. `in_progress→sent` finnes alt (Send på nytt). Legg kun til det som mangler (trolig `received→sent` + `approved→sent`).
2. **statusHandlinger.ts:** legg til Send-handling (gjenbruk `handling.send`, `nyStatus: "sent"`) i blokkene for `received`, `responded`, `approved`. Oppdater rolle-/overgangs-settene.
3. **Matrise** (`flytmatrise-def.ts`, spec § 3): rader `received→sent` (Send), `responded→sent` (Send), `approved→sent` (Send). Default-roller per § 3: **received→sent = Utfører + P-adm; responded→sent = Godkjenner + P-adm; approved→sent = Godkjenner + P-adm.** (`in_progress→sent` = «Send på nytt» finnes alt fra F3 — ikke rør.)
4. **Videresend — kun verifiser:** den er alt kryssflyt, og hover-teksten sier alt «på tvers av dokumentflyter» (mikrotekst-runden). Ingen endring med mindre noe mangler; bekreft.
5. **Mikrotekst:** Send gjenbruker `flythjelp.handling.send` («Flytter dokumentet ett ledd fram: fra deg til {{mottaker}}. Hos dem står det som Til behandling.») — ingen ny nøkkel nødvendig. Bekreft at teksten passer «Send fram» fra alle de nye statusene; hvis en status trenger en nyanse, flagg heller til cowork enn å lage tvillingtekst.

## DoD

- [ ] `received/responded/approved → sent` i VALID_TRANSITIONS (responded var for-staget); Send-handling i statusHandlinger for de tre; matrise-rader med rollene i § 3. Koherens-tripler bekreftet.
- [ ] Videresend bekreftet uendret (kryssflyt + «på tvers av dokumentflyter»-hover).
- [ ] Ingen ny mikrotekst-nøkkel med mindre cowork-flagget; `handling.send` gjenbrukt.
- [ ] `pnpm --filter @sitedoc/shared` typecheck+test + web/api typecheck + test grønt.
- [ ] Vis diff. Push `feat/f5-send-videresend-paring`. Ikke merge. Ikke rør STATUS-AKTUELT/BACKLOG.
